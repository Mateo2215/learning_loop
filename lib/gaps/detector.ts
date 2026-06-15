/**
 * Rule-based knowledge gap detection (M2 Phase 4).
 *
 * Four gap types per CLAUDE.md, each as a discrete query over `reviews` and
 * `items`. Detectors return GapCandidate objects — Sonnet ranks them and
 * picks severity in `lib/ai/detect-gaps.ts`.
 *
 * No AI here — these are deterministic SQL aggregates so they're cheap and
 * runnable in cron. Sonnet only enters at the ranking step.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GapType } from "@/lib/db/types";

export interface GapCandidate {
  gap_type: GapType;
  /** Tags or material titles that capture what the gap is about. */
  affected_tags: string[];
  affected_materials: string[];
  /** Numeric stat the rule fired on, used by ranker to compare candidates. */
  metric: number;
  /** Human-readable rationale (for debugging + Sonnet context). */
  rationale: string;
}

const LOW_CORRECT_RATE_THRESHOLD = 0.6;
const LOW_CORRECT_RATE_WINDOW = 20;
const STALE_DAYS = 30;
const RISING_FAILURE_WINDOW = 10;
const NEVER_CONSOLIDATED_MIN_REVIEWS = 4;

/**
 * Tags whose recent open-question correct rate is below 60%.
 * Cloze ratings 1 (Again) count as incorrect; Good/Easy as correct.
 */
export async function detectLowCorrectRate(
  supabase: SupabaseClient,
  userId: string
): Promise<GapCandidate[]> {
  const { data: reviews } = await supabase
    .from("reviews")
    .select("ai_evaluation, fsrs_rating, items!inner(tags)")
    .eq("user_id", userId)
    .eq("is_audit", false) // self-grade audytu nie zaśmieca correct-rate
    .order("created_at", { ascending: false })
    .limit(LOW_CORRECT_RATE_WINDOW * 10); // pull plenty, group client-side

  if (!reviews) return [];

  type Row = {
    ai_evaluation: string | null;
    fsrs_rating: number | null;
    items: { tags: string[] | null } | { tags: string[] | null }[];
  };

  const perTag = new Map<string, { correct: number; total: number }>();
  for (const r of reviews as Row[]) {
    const items = Array.isArray(r.items) ? r.items[0] : r.items;
    const tags = items?.tags ?? [];
    const isCorrect = r.ai_evaluation === "correct" || (r.fsrs_rating !== null && r.fsrs_rating >= 3);
    const isCounted = r.ai_evaluation !== null || r.fsrs_rating !== null;
    if (!isCounted) continue;
    for (const tag of tags) {
      const stat = perTag.get(tag) ?? { correct: 0, total: 0 };
      stat.total += 1;
      if (isCorrect) stat.correct += 1;
      perTag.set(tag, stat);
    }
  }

  const candidates: GapCandidate[] = [];
  for (const [tag, stat] of perTag.entries()) {
    if (stat.total < 5) continue; // need a minimum sample
    const rate = stat.correct / stat.total;
    if (rate < LOW_CORRECT_RATE_THRESHOLD) {
      candidates.push({
        gap_type: "low_correct_rate",
        affected_tags: [tag],
        affected_materials: [],
        metric: rate,
        rationale: `tag "${tag}": ${stat.correct}/${stat.total} correct (${Math.round(rate * 100)}%)`,
      });
    }
  }
  return candidates;
}

/**
 * Materials with no review in the last 30 days that previously had ≥3 reviews
 * (so it was "active" not "never touched").
 */
export async function detectStaleTopics(
  supabase: SupabaseClient,
  userId: string
): Promise<GapCandidate[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  // 1. all materials with at least 3 reviews
  const { data: activeMats } = await supabase
    .from("reviews")
    .select("material_id, materials!inner(title)")
    .eq("user_id", userId);

  if (!activeMats) return [];

  type Row = { material_id: string; materials: { title: string } | { title: string }[] };
  const byMaterial = new Map<string, { count: number; title: string }>();
  for (const r of activeMats as Row[]) {
    const mat = Array.isArray(r.materials) ? r.materials[0] : r.materials;
    const cur = byMaterial.get(r.material_id) ?? { count: 0, title: mat?.title ?? "?" };
    cur.count += 1;
    byMaterial.set(r.material_id, cur);
  }

  const eligible = Array.from(byMaterial.entries()).filter(([, v]) => v.count >= 3).map(([k]) => k);
  if (eligible.length === 0) return [];

  // 2. for those, find ones whose latest review is older than cutoff
  const { data: latestRows } = await supabase
    .from("reviews")
    .select("material_id, created_at")
    .eq("user_id", userId)
    .in("material_id", eligible)
    .order("created_at", { ascending: false });

  if (!latestRows) return [];

  type Latest = { material_id: string; created_at: string };
  const latestByMat = new Map<string, string>();
  for (const r of latestRows as Latest[]) {
    if (!latestByMat.has(r.material_id)) latestByMat.set(r.material_id, r.created_at);
  }

  const candidates: GapCandidate[] = [];
  for (const [matId, latest] of latestByMat.entries()) {
    if (latest < cutoff) {
      const meta = byMaterial.get(matId);
      const days = Math.floor((Date.now() - new Date(latest).getTime()) / 86_400_000);
      candidates.push({
        gap_type: "stale_topic",
        affected_tags: [],
        affected_materials: [matId],
        metric: days,
        rationale: `"${meta?.title}" — ${days} dni bez powtórki (poprzednio ${meta?.count} reviews)`,
      });
    }
  }
  return candidates;
}

/**
 * Tags whose failure rate in the last RISING_FAILURE_WINDOW reviews is higher
 * than in the previous window of the same size. Catches degrading topics
 * before low_correct_rate would flag them.
 */
export async function detectRisingFailures(
  supabase: SupabaseClient,
  userId: string
): Promise<GapCandidate[]> {
  const { data } = await supabase
    .from("reviews")
    .select("ai_evaluation, fsrs_rating, created_at, items!inner(tags)")
    .eq("user_id", userId)
    .eq("is_audit", false) // self-grade audytu nie zaśmieca trendu porażek
    .order("created_at", { ascending: false })
    .limit(RISING_FAILURE_WINDOW * 4);

  if (!data) return [];

  type Row = {
    ai_evaluation: string | null;
    fsrs_rating: number | null;
    items: { tags: string[] | null } | { tags: string[] | null }[];
  };

  const perTag = new Map<string, { recent: number[]; older: number[] }>();
  const rows = data as Row[];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const items = Array.isArray(r.items) ? r.items[0] : r.items;
    const tags = items?.tags ?? [];
    const failed =
      r.ai_evaluation === "incorrect" || (r.fsrs_rating !== null && r.fsrs_rating === 1);
    const counted = r.ai_evaluation !== null || r.fsrs_rating !== null;
    if (!counted) continue;
    const bucket: "recent" | "older" = i < RISING_FAILURE_WINDOW ? "recent" : "older";
    for (const tag of tags) {
      const stat = perTag.get(tag) ?? { recent: [], older: [] };
      stat[bucket].push(failed ? 1 : 0);
      perTag.set(tag, stat);
    }
  }

  const candidates: GapCandidate[] = [];
  for (const [tag, stat] of perTag.entries()) {
    if (stat.recent.length < 5 || stat.older.length < 5) continue;
    const recentRate = stat.recent.reduce((a, b) => a + b, 0) / stat.recent.length;
    const olderRate = stat.older.reduce((a, b) => a + b, 0) / stat.older.length;
    if (recentRate > olderRate + 0.2 && recentRate >= 0.3) {
      candidates.push({
        gap_type: "rising_failures",
        affected_tags: [tag],
        affected_materials: [],
        metric: recentRate - olderRate,
        rationale: `tag "${tag}": failure rate ${(olderRate * 100).toFixed(0)}% → ${(recentRate * 100).toFixed(0)}%`,
      });
    }
  }
  return candidates;
}

/**
 * Items reviewed 4+ times that have never reached 3 consecutive "good or
 * better" ratings (cloze) or 3 consecutive "correct" (open). They're stuck.
 *
 * Open items also get flagged when `is_leech = true` — set by the answer
 * route after 3 consecutive open reviews with score ≤ 6 (see
 * `shouldUpdateLeech` in lib/sessions/section-status.ts). This bypasses
 * the fsrs_review_count check for open items, since FSRS isn't updated
 * for them.
 */
export async function detectNeverConsolidated(
  supabase: SupabaseClient,
  userId: string
): Promise<GapCandidate[]> {
  const { data: items } = await supabase
    .from("items")
    .select("id, fsrs_review_count, tags, material_id, is_leech, materials!inner(title)")
    .eq("user_id", userId)
    .or(`fsrs_review_count.gte.${NEVER_CONSOLIDATED_MIN_REVIEWS},is_leech.eq.true`)
    .is("audit_id", null);

  if (!items || items.length === 0) return [];

  type ItemRow = {
    id: string;
    fsrs_review_count: number;
    tags: string[] | null;
    material_id: string;
    is_leech: boolean | null;
    materials: { title: string } | { title: string }[];
  };

  const itemList = items as ItemRow[];
  const itemIds = itemList.map((i) => i.id);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("item_id, ai_evaluation, fsrs_rating, created_at")
    .eq("user_id", userId)
    .eq("is_audit", false) // self-grade audytu nie liczy się do konsolidacji
    .in("item_id", itemIds)
    .order("created_at", { ascending: true });

  if (!reviews) return [];

  type ReviewRow = {
    item_id: string;
    ai_evaluation: string | null;
    fsrs_rating: number | null;
  };

  const byItem = new Map<string, ReviewRow[]>();
  for (const r of reviews as ReviewRow[]) {
    const arr = byItem.get(r.item_id) ?? [];
    arr.push(r);
    byItem.set(r.item_id, arr);
  }

  const candidates: GapCandidate[] = [];
  for (const item of itemList) {
    const list = byItem.get(item.id) ?? [];
    let consecGood = 0;
    let everReached3 = false;
    for (const r of list) {
      const good = r.ai_evaluation === "correct" || (r.fsrs_rating !== null && r.fsrs_rating >= 3);
      if (good) {
        consecGood += 1;
        if (consecGood >= 3) {
          everReached3 = true;
          break;
        }
      } else {
        consecGood = 0;
      }
    }
    if (!everReached3) {
      const mat = Array.isArray(item.materials) ? item.materials[0] : item.materials;
      candidates.push({
        gap_type: "never_consolidated",
        affected_tags: item.tags ?? [],
        affected_materials: [item.material_id],
        metric: item.fsrs_review_count,
        rationale: `item z "${mat?.title}" — ${item.fsrs_review_count} powtórek, nigdy 3× pod rząd good`,
      });
    }
  }
  return candidates;
}

/**
 * Run all detectors and return a flat candidate list. Caller (the API route)
 * passes this to the Sonnet ranker.
 */
export async function runAllDetectors(
  supabase: SupabaseClient,
  userId: string
): Promise<GapCandidate[]> {
  const [a, b, c, d] = await Promise.all([
    detectLowCorrectRate(supabase, userId),
    detectStaleTopics(supabase, userId),
    detectRisingFailures(supabase, userId),
    detectNeverConsolidated(supabase, userId),
  ]);
  return [...a, ...b, ...c, ...d];
}
