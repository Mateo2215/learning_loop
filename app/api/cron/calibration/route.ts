import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { aggregateCalibrationForUser } from "@/lib/calibration/aggregator";

/**
 * Daily calibration aggregation cron. Recomputes offsets for every user that
 * has at least one review with calibration set.
 *
 * pg_cron snippet (paste once in Supabase SQL Editor as service_role):
 *
 *   select cron.schedule(
 *     'calibration-daily',
 *     '0 5 * * *',                    -- every day 05:00 UTC
 *     $$
 *       select net.http_post(
 *         url := '<your-app-base-url>/api/cron/calibration',
 *         headers := jsonb_build_object(
 *           'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
 *           'Content-Type', 'application/json'
 *         ),
 *         body := '{}'::jsonb
 *       );
 *     $$
 *   );
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (auth !== `Bearer ${expected}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "supabase service env missing" }, { status: 500 });

  const supabase = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows } = await supabase
    .from("reviews")
    .select("user_id")
    .not("user_calibration", "is", null)
    .limit(1000);

  const uniqueUsers = Array.from(
    new Set((rows ?? []).map((r) => (r as { user_id: string }).user_id))
  );

  const results: Record<string, unknown> = {};
  for (const userId of uniqueUsers) {
    try {
      const stats = await aggregateCalibrationForUser(supabase, userId);
      results[userId] = { categories: stats.length };
    } catch (err) {
      results[userId] = { error: err instanceof Error ? err.message : "failed" };
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    users: uniqueUsers.length,
    results,
  });
}

export const POST = GET;
