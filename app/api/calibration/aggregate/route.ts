import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateCalibrationForUser } from "@/lib/calibration/aggregator";

/**
 * POST /api/calibration/aggregate — on-demand recompute of calibration offsets
 * for the current user. Cheap (pure SQL), can be triggered from settings page.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  try {
    const stats = await aggregateCalibrationForUser(supabase, user.id);
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "aggregation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
