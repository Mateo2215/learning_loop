/**
 * End-to-end gap detection: run rule-based detectors → Sonnet ranks → upsert
 * `knowledge_gaps` rows with status='open'.
 *
 * De-duplication strategy: existing open gaps with the same `gap_type` and
 * overlapping `affected_tags` (or `affected_materials`) are kept; new candidates
 * that match are skipped, freshly-emerged ones are inserted. Old open gaps that
 * no longer surface in detection are left alone (user marks them addressed manually).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runAllDetectors } from "./detector";
import { rankGapCandidates } from "@/lib/ai/detect-gaps";
import { trackAICall } from "@/lib/ai/track";

export interface GapDetectionResult {
  candidatesFound: number;
  inserted: number;
  skippedDuplicate: number;
  ranked: number;
}

export async function detectGapsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GapDetectionResult> {
  const candidates = await runAllDetectors(supabase, userId);

  if (candidates.length === 0) {
    return { candidatesFound: 0, inserted: 0, skippedDuplicate: 0, ranked: 0 };
  }

  const { result: ranked } = await trackAICall({
    supabase,
    userId,
    operation: "detect_gaps",
    model: "claude-sonnet-4-6",
    metadata: { candidate_count: candidates.length },
    call: () => rankGapCandidates(candidates).then((r) => ({ result: r.result, usage: r.usage })),
  });

  // Existing open gaps for de-duplication
  const { data: existing } = await supabase
    .from("knowledge_gaps")
    .select("id, gap_type, affected_tags, affected_materials")
    .eq("user_id", userId)
    .eq("status", "open");

  type ExistingRow = { id: string; gap_type: string; affected_tags: string[] | null; affected_materials: string[] | null };
  const existingList = (existing ?? []) as ExistingRow[];

  let inserted = 0;
  let skippedDuplicate = 0;

  for (const g of ranked) {
    const dup = existingList.find((e) => {
      if (e.gap_type !== g.gap_type) return false;
      const tagOverlap = (e.affected_tags ?? []).some((t) => g.affected_tags.includes(t));
      const matOverlap = (e.affected_materials ?? []).some((m) => g.affected_materials.includes(m));
      return tagOverlap || matOverlap;
    });

    if (dup) {
      skippedDuplicate += 1;
      continue;
    }

    const { error } = await supabase.from("knowledge_gaps").insert({
      user_id: userId,
      title: g.title,
      gap_type: g.gap_type,
      severity: g.severity,
      affected_tags: g.affected_tags,
      affected_materials: g.affected_materials,
      status: "open",
    });

    if (!error) inserted += 1;
  }

  return {
    candidatesFound: candidates.length,
    inserted,
    skippedDuplicate,
    ranked: ranked.length,
  };
}
