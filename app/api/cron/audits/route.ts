import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * GET /api/cron/audits
 *
 * Daily heartbeat called by pg_cron (Supabase) or Vercel Cron. Currently does
 * a cheap inventory pass: counts due audits per user. Question generation is
 * lazy (triggered when the user opens the audit) — pre-generating is wasted
 * spend if the user never runs it.
 *
 * Authorized by `CRON_SECRET` Bearer token. Set the same value in pg_cron's
 * job body (see supabase/migrations/0002_audits.sql).
 *
 * Future M2/M3: surface "X audits due" via push notification or email.
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

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("topic_audits")
    .select("user_id")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const perUser: Record<string, number> = {};
  for (const row of data ?? []) {
    const u = (row as { user_id: string }).user_id;
    perUser[u] = (perUser[u] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    checkedAt: nowIso,
    totalDue: data?.length ?? 0,
    perUser,
  });
}

// POST same as GET — pg_cron's net.http_post sends POST with a JSON body.
export const POST = GET;
