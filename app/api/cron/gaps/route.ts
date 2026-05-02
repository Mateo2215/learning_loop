import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { detectGapsForUser } from "@/lib/gaps/runner";

/**
 * Weekly gap-detection cron. Iterates over all users (single-tenant for now,
 * but plumbing is multi-user-ready). Bearer-guarded by CRON_SECRET.
 *
 * pg_cron snippet (run once in Supabase SQL Editor as service_role):
 *
 *   select cron.schedule(
 *     'gaps-weekly',
 *     '0 7 * * 1',                    -- Mondays 07:00 UTC
 *     $$
 *       select net.http_post(
 *         url := '<your-app-base-url>/api/cron/gaps',
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
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "supabase service env missing" }, { status: 500 });
  }

  const supabase = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Single-tenant — find all users that have at least one review.
  // Multi-user: replace with explicit user iteration.
  const { data: userRows } = await supabase
    .from("reviews")
    .select("user_id")
    .limit(1000);

  const uniqueUsers = Array.from(new Set((userRows ?? []).map((r) => (r as { user_id: string }).user_id)));

  const results: Record<string, unknown> = {};
  for (const userId of uniqueUsers) {
    try {
      results[userId] = await detectGapsForUser(supabase, userId);
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
