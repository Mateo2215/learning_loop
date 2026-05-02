import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/dev/force-audit-due/[material_id]
 *
 * Test helper: marks the day_7 audit for this material as `pending` with
 * `scheduled_for = now() - 1h`, so it shows up immediately on /sessions/audit.
 * Does NOT touch day_30 / day_90 rows. Disabled in production.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ material_id: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }

  const { material_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { data, error } = await supabase
    .from("topic_audits")
    .update({ scheduled_for: oneHourAgo, status: "pending" })
    .eq("user_id", user.id)
    .eq("material_id", material_id)
    .eq("trigger", "day_7")
    .select("id, scheduled_for");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0, rows: data ?? [] });
}
