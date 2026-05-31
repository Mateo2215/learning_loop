import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/dev/force-audit-due/[material_id]
 *
 * Test helper: sprawia, że materiał jest natychmiast gotowy do audytu. Jeśli
 * istnieje pending audyt — cofa jego `scheduled_for` w przeszłość. Jeśli nie —
 * tworzy adaptacyjny audyt round 1 z terminem w przeszłości. Disabled in production.
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

  const { data: existing } = await supabase
    .from("topic_audits")
    .select("id")
    .eq("user_id", user.id)
    .eq("material_id", material_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("topic_audits")
      .update({ scheduled_for: oneHourAgo })
      .eq("id", (existing as { id: string }).id)
      .select("id, scheduled_for, audit_round");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: "rescheduled", rows: data ?? [] });
  }

  const { data, error } = await supabase
    .from("topic_audits")
    .insert({
      user_id: user.id,
      material_id,
      scheduled_for: oneHourAgo,
      trigger: "adaptive" as const,
      audit_round: 1,
      status: "pending" as const,
    })
    .select("id, scheduled_for, audit_round");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "created", rows: data ?? [] });
}
