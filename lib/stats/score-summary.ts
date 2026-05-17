/**
 * Score-based stats aggregation for Deep Dive scoring.
 * Used by /api/stats/score-summary (client refresh) and /stats page (SSR).
 *
 * Always filters `reviews.score IS NOT NULL` so pre-migration reviews are hidden.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_SAMPLES_PER_MATERIAL = 3;
const WEAKEST_WINDOW_DAYS = 30;
const WEAKEST_LIMIT = 10;
const SPARKLINE_POINTS = 20;

interface ReviewRow {
  material_id: string;
  item_id: string;
  score: number;
  created_at: string;
}

export interface PerMaterial {
  material_id: string;
  title: string;
  category: string;
  samples: number;
  avg_recent: number;
  avg_overall: number;
  trend: { t: string; score: number }[];
}

export interface WeakestItem {
  item_id: string;
  question: string;
  material_id: string;
  material_title: string;
  worst_score: number;
  latest_score: number;
  latest_at: string;
}

export interface ScoreSummary {
  per_material: PerMaterial[];
  weakest_items: WeakestItem[];
}

export async function computeScoreSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<ScoreSummary> {
  const { data: rows, error } = await supabase
    .from("reviews")
    .select("material_id, item_id, score, created_at")
    .eq("user_id", userId)
    .not("score", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`reviews query failed: ${error.message}`);

  const reviews = (rows ?? []) as ReviewRow[];
  if (reviews.length === 0) return { per_material: [], weakest_items: [] };

  const materialIds = Array.from(new Set(reviews.map((r) => r.material_id))).filter(Boolean);
  const { data: materialRows } = await supabase
    .from("materials")
    .select("id, title, category")
    .in("id", materialIds);

  const materialById = new Map<string, { title: string; category: string }>();
  for (const m of (materialRows ?? []) as { id: string; title: string; category: string }[]) {
    materialById.set(m.id, { title: m.title, category: m.category });
  }

  // Group by material → trend
  const byMaterial = new Map<string, ReviewRow[]>();
  for (const r of reviews) {
    if (!r.material_id) continue;
    const list = byMaterial.get(r.material_id) ?? [];
    list.push(r);
    byMaterial.set(r.material_id, list);
  }

  const per_material: PerMaterial[] = [];
  for (const [mid, list] of byMaterial) {
    if (list.length < MIN_SAMPLES_PER_MATERIAL) continue;
    const meta = materialById.get(mid);
    if (!meta) continue;

    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = sorted.slice(-SPARKLINE_POINTS);
    const recent10 = sorted.slice(-10);

    per_material.push({
      material_id: mid,
      title: meta.title,
      category: meta.category,
      samples: sorted.length,
      avg_recent: Number(
        (recent10.reduce((s, r) => s + r.score, 0) / recent10.length).toFixed(2),
      ),
      avg_overall: Number(
        (sorted.reduce((s, r) => s + r.score, 0) / sorted.length).toFixed(2),
      ),
      trend: last.map((r) => ({ t: r.created_at, score: r.score })),
    });
  }
  per_material.sort((a, b) => b.avg_recent - a.avg_recent);

  // Weakest items in last N days
  const cutoff = new Date(Date.now() - WEAKEST_WINDOW_DAYS * 86_400_000).toISOString();
  const recentScored = reviews.filter((r) => r.created_at >= cutoff);

  type ItemAgg = { worst: number; latest: number; latest_at: string };
  const itemAgg = new Map<string, ItemAgg>();
  for (const r of recentScored) {
    const cur = itemAgg.get(r.item_id);
    if (!cur) {
      itemAgg.set(r.item_id, { worst: r.score, latest: r.score, latest_at: r.created_at });
    } else {
      cur.worst = Math.min(cur.worst, r.score);
      if (r.created_at > cur.latest_at) {
        cur.latest = r.score;
        cur.latest_at = r.created_at;
      }
    }
  }

  const candidateIds = Array.from(itemAgg.entries())
    .sort((a, b) => a[1].worst - b[1].worst)
    .slice(0, WEAKEST_LIMIT * 2)
    .map(([id]) => id);

  let weakest_items: WeakestItem[] = [];
  if (candidateIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, question, material_id")
      .in("id", candidateIds);

    for (const it of (itemRows ?? []) as { id: string; question: string; material_id: string }[]) {
      const agg = itemAgg.get(it.id);
      if (!agg) continue;
      const meta = materialById.get(it.material_id);
      weakest_items.push({
        item_id: it.id,
        question: it.question,
        material_id: it.material_id,
        material_title: meta?.title ?? "—",
        worst_score: agg.worst,
        latest_score: agg.latest,
        latest_at: agg.latest_at,
      });
    }
    weakest_items.sort((a, b) => a.worst_score - b.worst_score);
    weakest_items = weakest_items.slice(0, WEAKEST_LIMIT);
  }

  return { per_material, weakest_items };
}
