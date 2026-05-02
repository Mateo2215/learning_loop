import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluationToScore } from "@/lib/audits/scheduler";

/**
 * POST /api/sessions/:id/end
 *
 * Marks a session as ended (sets ended_at). For audit sessions, also computes
 * `performance_score` (mean of review evaluations mapped 0/0.5/1) and flips
 * the audit row to `completed`.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const { count: completed } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
      items_completed: completed ?? 0,
    })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: `session end failed: ${error.message}` }, { status: 500 });
  }

  let auditScore: number | null = null;

  if ((session as { mode: string }).mode === "audit") {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("ai_evaluation")
      .eq("session_id", sessionId);

    const evals = (reviews ?? []) as { ai_evaluation: string | null }[];
    if (evals.length > 0) {
      const total = evals.reduce((s, r) => s + evaluationToScore(r.ai_evaluation), 0);
      auditScore = Number((total / evals.length).toFixed(2));
    }

    const { data: auditRow } = await supabase
      .from("topic_audits")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (auditRow) {
      await supabase
        .from("topic_audits")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          performance_score: auditScore,
        })
        .eq("id", (auditRow as { id: string }).id);
    }
  }

  return NextResponse.json({
    ok: true,
    items_completed: completed ?? 0,
    audit_score: auditScore,
  });
}
