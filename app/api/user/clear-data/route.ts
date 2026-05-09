import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/user/clear-data
 *
 * Deletes all review history and resets FSRS state on all items back to "new".
 * Materials and items (questions) are preserved.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const uid = user.id;

  // End any active sessions first.
  await supabase.from("sessions").delete().eq("user_id", uid);

  // Wipe all review history.
  await supabase.from("reviews").delete().eq("user_id", uid);

  // Reset FSRS state on all items → cards become "new" again.
  const resetNow = new Date().toISOString();
  await supabase
    .from("items")
    .update({
      fsrs_stability: null,
      fsrs_difficulty: null,
      fsrs_due_date: resetNow,
      fsrs_last_review: null,
      fsrs_review_count: 0,
      fsrs_lapse_count: 0,
      is_leech: false,
    })
    .eq("user_id", uid);

  // Clear processing jobs and calibration offsets.
  await supabase.from("processing_jobs").delete().eq("user_id", uid);
  await supabase.from("calibration_offsets").delete().eq("user_id", uid);
  await supabase.from("usage_logs").delete().eq("user_id", uid);

  return NextResponse.json({ ok: true });
}
