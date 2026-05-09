/**
 * Leech rotation queue (M2 Phase 3).
 *
 * Leeches are items the user gets wrong repeatedly (`is_leech = true`, set by
 * `applyRating` when reviewCount >= 10 && lapseCount >= 4).
 *
 * Per CLAUDE.md: don't suspend leeches — keep them in rotation. Force 1–2
 * leeches into the queue every 7 days so they don't get lost in the long tail.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const ROTATION_INTERVAL_DAYS = 7;
const LEECHES_PER_ROTATION = 2;

/**
 * Returns the timestamp of the most recent review on a leech item for this user,
 * or null if the user has never seen a leech.
 */
export async function getLastLeechExposureAt(
  supabase: SupabaseClient,
  userId: string
): Promise<Date | null> {
  const { data } = await supabase
    .from("reviews")
    .select("created_at, items!inner(is_leech)")
    .eq("user_id", userId)
    .eq("items.is_leech", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const ts = (data as { created_at: string }).created_at;
  return new Date(ts);
}

/**
 * Whether this user is "due" for a forced leech rotation in the next session.
 * True when there's at least one leech AND it's been ≥7 days since last leech
 * was reviewed (or never).
 */
export async function isLeechRotationDue(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "cloze")
    .eq("is_suspended", false)
    .eq("is_leech", true)
    .is("audit_id", null);

  if (!count || count === 0) return false;

  const last = await getLastLeechExposureAt(supabase, userId);
  if (!last) return true;

  const daysSince = (Date.now() - last.getTime()) / 86_400_000;
  return daysSince >= ROTATION_INTERVAL_DAYS;
}

export interface LeechCandidate {
  id: string;
  material_id: string;
  type: "cloze";
  question: string;
  answer_reference: string | null;
  cloze_data: { front: string; answer: string } | null;
  difficulty: "easy" | "medium" | "hard" | null;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_due_date: string | null;
  fsrs_last_review: string | null;
  fsrs_review_count: number;
  fsrs_lapse_count: number;
  is_leech: true;
}

/**
 * Pick up to N leech items to inject into a review session. Sorted by
 * `fsrs_due_date asc` so the most overdue leeches surface first.
 */
export async function pickLeechCandidates(
  supabase: SupabaseClient,
  userId: string,
  limit: number = LEECHES_PER_ROTATION
): Promise<LeechCandidate[]> {
  const { data } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, cloze_data, difficulty, fsrs_stability, fsrs_difficulty, fsrs_due_date, fsrs_last_review, fsrs_review_count, fsrs_lapse_count")
    .eq("user_id", userId)
    .eq("type", "cloze")
    .eq("is_suspended", false)
    .eq("is_leech", true)
    .is("audit_id", null)
    .order("fsrs_due_date", { ascending: true, nullsFirst: true })
    .limit(limit);

  return ((data ?? []) as Omit<LeechCandidate, "is_leech">[]).map((row) => ({
    ...row,
    is_leech: true as const,
  }));
}

export const LEECH_ROTATION_CONFIG = {
  intervalDays: ROTATION_INTERVAL_DAYS,
  perRotation: LEECHES_PER_ROTATION,
} as const;
