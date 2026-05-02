/**
 * Calibration offsets aggregation (M2 Phase 8).
 *
 * Reads `reviews.user_calibration` per category and rolls up into
 * `calibration_offsets` (one row per user × category). The `current_offset`
 * is in [-1, +1]:
 *   negative → AI is chronically too strict, hint to be more lenient
 *   positive → AI is chronically too lenient, hint to be stricter
 *   zero      → calibrated (or insufficient signal)
 *
 * Formula: `(too_lenient - too_strict) / max(total_validations, MIN_SAMPLE)`
 * — capped to [-1, 1]. The MIN_SAMPLE floor prevents a single early data point
 * from swinging the offset to ±1 with no real signal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Calibration, Category } from "@/lib/db/types";
import { CATEGORIES } from "@/lib/db/types";

const MIN_SAMPLE_FOR_CONFIDENCE = 10;

export interface CalibrationStats {
  category: Category;
  too_strict_count: number;
  too_lenient_count: number;
  agree_count: number;
  total_validations: number;
  current_offset: number;
}

/**
 * Recompute calibration offsets for one user from `reviews` history.
 * Idempotent — upserts (user_id, category) pairs.
 */
export async function aggregateCalibrationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CalibrationStats[]> {
  // Pull all reviews that have a calibration set, with the item's category.
  const { data, error } = await supabase
    .from("reviews")
    .select("user_calibration, items!inner(category)")
    .eq("user_id", userId)
    .not("user_calibration", "is", null);

  if (error) throw new Error(`calibration query failed: ${error.message}`);

  type Row = {
    user_calibration: Calibration;
    items: { category: Category } | { category: Category }[];
  };

  // Bucket per category.
  const buckets = new Map<Category, { strict: number; lenient: number; agree: number }>();
  for (const c of CATEGORIES) buckets.set(c, { strict: 0, lenient: 0, agree: 0 });

  for (const r of (data ?? []) as Row[]) {
    const itemCat = Array.isArray(r.items) ? r.items[0]?.category : r.items?.category;
    if (!itemCat) continue;
    const b = buckets.get(itemCat as Category);
    if (!b) continue;
    if (r.user_calibration === "too_strict") b.strict += 1;
    else if (r.user_calibration === "too_lenient") b.lenient += 1;
    else if (r.user_calibration === "agree") b.agree += 1;
  }

  // Upsert one row per category (only categories with any signal).
  const stats: CalibrationStats[] = [];
  for (const [category, b] of buckets) {
    const total = b.strict + b.lenient + b.agree;
    if (total === 0) continue;

    const denom = Math.max(total, MIN_SAMPLE_FOR_CONFIDENCE);
    const raw = (b.lenient - b.strict) / denom;
    const offset = Number(Math.max(-1, Math.min(1, raw)).toFixed(2));

    const { error: upsertErr } = await supabase
      .from("calibration_offsets")
      .upsert(
        {
          user_id: userId,
          category,
          too_strict_count: b.strict,
          too_lenient_count: b.lenient,
          total_validations: total,
          current_offset: offset,
        },
        { onConflict: "user_id,category" }
      );
    if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`);

    stats.push({
      category,
      too_strict_count: b.strict,
      too_lenient_count: b.lenient,
      agree_count: b.agree,
      total_validations: total,
      current_offset: offset,
    });
  }

  return stats;
}

/**
 * Read the calibration offset for one (user, category) pair. Returns 0 when
 * no row exists yet, or when sample is too small for confidence (handled by
 * the aggregator's MIN_SAMPLE floor — here we just return whatever's stored).
 */
export async function getCalibrationOffset(
  supabase: SupabaseClient,
  userId: string,
  category: Category
): Promise<number> {
  const { data } = await supabase
    .from("calibration_offsets")
    .select("current_offset, total_validations")
    .eq("user_id", userId)
    .eq("category", category)
    .maybeSingle();

  if (!data) return 0;
  const row = data as { current_offset: number | string; total_validations: number };
  if (row.total_validations < 3) return 0; // ignore until we have at least 3 calibrations
  return Number(row.current_offset);
}
