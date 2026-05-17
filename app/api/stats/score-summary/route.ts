import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeScoreSummary } from "@/lib/stats/score-summary";

/**
 * GET /api/stats/score-summary
 *
 * Two payloads in one round-trip:
 *  - per_material: list of materials with score samples (≥3) for trend sparkline
 *  - weakest_items: top 10 items by worst score over last 30 days
 *
 * Pre-migration reviews (score NULL) are excluded by the underlying query.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  try {
    const summary = await computeScoreSummary(supabase, user.id);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
