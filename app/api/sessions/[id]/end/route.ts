import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  evaluationToScore,
  scheduleNextAudit,
  scheduleFirstAuditIfMastered,
} from "@/lib/audits/scheduler";

/**
 * POST /api/sessions/:id/end
 *
 * Marks a session as ended (sets ended_at).
 *
 * Audit sessions are konsolidowane: jedna sesja może rozliczać wiele audytów
 * (po 1 pytaniu z materiału). Dla każdego audytu liczymy jego `performance_score`
 * (z pojedynczego review), oznaczamy go `completed` i planujemy kolejny audyt
 * w odstępie adaptacyjnym zależnym od wyniku.
 *
 * Deep Dive: po zamknięciu sprawdzamy bramę mastery — jeśli materiał jest właśnie
 * opanowany, planujemy pierwszy audyt (round 1).
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
    .select("id, mode, material_id")
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

  const mode = (session as { mode: string }).mode;
  let auditScore: number | null = null;

  if (mode === "audit") {
    auditScore = await settleAuditSession(supabase, user.id, sessionId);
  } else if (mode === "deep_dive") {
    const materialId = (session as { material_id: string | null }).material_id;
    if (materialId) {
      try {
        await scheduleFirstAuditIfMastered(supabase, user.id, materialId);
      } catch (err) {
        // Brama mastery jest best-effort — nie blokujemy zamknięcia sesji.
        console.warn("[end] scheduleFirstAuditIfMastered failed:", err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    items_completed: completed ?? 0,
    audit_score: auditScore,
  });
}

/**
 * Rozlicza wszystkie audyty wpięte w sesję: ustawia performance_score, oznacza
 * completed i planuje kolejny audyt adaptacyjnie. Zwraca średnią performance_score
 * (0..1) całej sesji do ekranu podsumowania.
 */
async function settleAuditSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string,
): Promise<number | null> {
  // Audyty rozliczane przez tę sesję.
  const { data: auditRows } = await supabase
    .from("topic_audits")
    .select("id, material_id, audit_round")
    .eq("session_id", sessionId)
    .eq("status", "pending");

  const audits = (auditRows ?? []) as {
    id: string;
    material_id: string;
    audit_round: number;
  }[];
  if (audits.length === 0) return null;

  // Reviews z tej sesji (po item_id) + powiązanie item → audit.
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("item_id, ai_evaluation, score")
    .eq("session_id", sessionId);

  const reviewByItem = new Map<string, { ai_evaluation: string | null; score: number | null }>();
  for (const row of reviewRows ?? []) {
    const r = row as { item_id: string; ai_evaluation: string | null; score: number | null };
    if (!reviewByItem.has(r.item_id)) reviewByItem.set(r.item_id, r);
  }

  const { data: itemRows } = await supabase
    .from("items")
    .select("id, audit_id")
    .in("audit_id", audits.map((a) => a.id));

  const itemByAudit = new Map<string, string>();
  for (const row of itemRows ?? []) {
    const r = row as { id: string; audit_id: string };
    if (!itemByAudit.has(r.audit_id)) itemByAudit.set(r.audit_id, r.id);
  }

  const perfScores: number[] = [];

  for (const audit of audits) {
    const itemId = itemByAudit.get(audit.id);
    const review = itemId ? reviewByItem.get(itemId) : undefined;

    // Audyt bez odpowiedzi (sesja przerwana) — zostaw pending. Pytanie zostaje
    // i zostanie reużyte przy następnej sesji (prepareAudit jest idempotentne).
    if (!review) continue;

    const perf = evaluationToScore(review.ai_evaluation ?? null);
    perfScores.push(perf);

    await supabase
      .from("topic_audits")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        performance_score: perf,
      })
      .eq("id", audit.id);

    // Adaptacyjny kolejny audyt — bazujemy na score 1–10 z review (gdy brak,
    // mapujemy 0..1 na skalę 1–10, żeby decyzja była rozsądna).
    const score1to10 =
      typeof review?.score === "number" ? review.score : Math.round(perf * 9) + 1;
    try {
      await scheduleNextAudit(supabase, userId, audit.material_id, audit.audit_round, score1to10);
    } catch (err) {
      console.warn(`[end] scheduleNextAudit failed for material ${audit.material_id}:`, err);
    }
  }

  if (perfScores.length === 0) return null;
  const mean = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;
  return Number(mean.toFixed(2));
}
