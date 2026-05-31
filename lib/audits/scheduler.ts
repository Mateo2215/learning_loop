/**
 * Topic-audit orchestration.
 *
 * `getDueAudits(supabase, userId)` — list pending audits ready to run now.
 * `prepareAudit(supabase, userId, auditId)` — generate fresh questions via Sonnet,
 *   create items linked to the audit, return question list for the UI to play.
 *
 * Scoring + status transitions happen in /api/sessions/[id]/end when the
 * session that ran the audit closes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackAICall } from "@/lib/ai/track";
import { generateAuditQuestions } from "@/lib/ai/generate-audit";
import { nextAuditInterval } from "@/lib/audits/intervals";
import { computeSectionStatus } from "@/lib/sessions/section-status";
import type { AuditTrigger, Category, Item, Material, TopicAudit } from "@/lib/db/types";

/** Maks. liczba pytań w jednej skonsolidowanej sesji audytu (1 na materiał). */
export const AUDIT_SESSION_SIZE = 3;

const DAY_MS = 86_400_000;

export interface DueAudit {
  id: string;
  material_id: string;
  material_title: string;
  trigger: AuditTrigger;
  audit_round: number;
  scheduled_for: string;
}

/**
 * Returns audits with `status='pending'` and `scheduled_for <= now()`,
 * sorted by `scheduled_for ascending` (oldest backlog first).
 */
export async function getDueAudits(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<DueAudit[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("topic_audits")
    .select("id, material_id, trigger, audit_round, scheduled_for, materials!inner(title)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`getDueAudits failed: ${error.message}`);

  type Row = {
    id: string;
    material_id: string;
    trigger: AuditTrigger;
    audit_round: number;
    scheduled_for: string;
    materials: { title: string } | { title: string }[];
  };

  return (data ?? []).map((row) => {
    const r = row as Row;
    const mat = Array.isArray(r.materials) ? r.materials[0] : r.materials;
    return {
      id: r.id,
      material_id: r.material_id,
      material_title: mat?.title ?? "(materiał usunięty)",
      trigger: r.trigger,
      audit_round: r.audit_round ?? 1,
      scheduled_for: r.scheduled_for,
    };
  });
}

export interface PreparedAudit {
  audit: TopicAudit;
  material: Pick<Material, "id" | "title" | "category" | "content_compressed">;
  /** Items already inserted to DB with audit_id set. UI plays through these. */
  items: Pick<Item, "id" | "material_id" | "type" | "question" | "answer_reference" | "difficulty" | "category">[];
}

/**
 * Generates fresh questions for an audit and persists them as items.
 * Idempotent: if items for this audit already exist (re-run), returns those
 * without re-calling Sonnet.
 */
export async function prepareAudit(
  supabase: SupabaseClient,
  userId: string,
  auditId: string
): Promise<PreparedAudit> {
  const { data: auditRow, error: auditErr } = await supabase
    .from("topic_audits")
    .select("*")
    .eq("id", auditId)
    .eq("user_id", userId)
    .maybeSingle();
  if (auditErr) throw new Error(`audit fetch failed: ${auditErr.message}`);
  if (!auditRow) throw new Error("audit not found");
  const audit = auditRow as TopicAudit;

  if (audit.status === "completed") {
    throw new Error("audit already completed");
  }

  const { data: matRow, error: matErr } = await supabase
    .from("materials")
    .select("id, title, category, content_compressed")
    .eq("id", audit.material_id)
    .maybeSingle();
  if (matErr) throw new Error(`material fetch failed: ${matErr.message}`);
  if (!matRow) throw new Error("material not found");
  const material = matRow as PreparedAudit["material"];
  if (!material.content_compressed) {
    throw new Error("material has no compressed content — cannot generate audit");
  }

  // Idempotency: if items already exist for this audit, reuse them.
  const { data: existing } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, difficulty, category")
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true });

  if (existing && existing.length > 0) {
    return { audit, material, items: existing as PreparedAudit["items"] };
  }

  // Pull existing question texts for this material so Sonnet avoids duplicates.
  const { data: existingQs } = await supabase
    .from("items")
    .select("question")
    .eq("user_id", userId)
    .eq("material_id", audit.material_id)
    .is("audit_id", null);

  const existingQuestions = (existingQs ?? []).map((r) => (r as { question: string }).question);

  const { result: questions } = await trackAICall({
    supabase,
    userId,
    operation: "generate_audit_questions",
    model: "claude-sonnet-4-6",
    materialId: material.id,
    metadata: { audit_id: auditId, trigger: audit.trigger },
    call: () =>
      generateAuditQuestions({
        category: material.category as Category,
        trigger: audit.trigger,
        round: audit.audit_round ?? 1,
        compressedContent: material.content_compressed!,
        existingQuestions,
      }).then((r) => ({ result: r.result, usage: r.usage })),
  });

  const rows = questions.map((q) => ({
    user_id: userId,
    material_id: material.id,
    audit_id: auditId,
    type: "open" as const,
    question: q.question,
    answer_reference: q.answer_reference,
    difficulty: q.difficulty,
    category: material.category,
    tags: [] as string[],
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("items")
    .insert(rows)
    .select("id, material_id, type, question, answer_reference, difficulty, category");

  if (insertErr || !inserted) {
    throw new Error(`audit items insert failed: ${insertErr?.message}`);
  }

  return { audit, material, items: inserted as PreparedAudit["items"] };
}

/**
 * Map AI evaluation strings to a 0..1 score for performance_score.
 */
export function evaluationToScore(ev: string | null): number {
  if (ev === "correct") return 1;
  if (ev === "partially_correct") return 0.5;
  return 0;
}

/**
 * Wstawia pojedynczy pending audyt dla materiału, jeśli żaden jeszcze nie istnieje.
 * Egzekwowane też przez unikalny indeks (topic_audits_one_pending_per_material) —
 * ewentualną kolizję traktujemy jako no-op (true = utworzono, false = już był).
 */
async function createPendingAudit(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
  round: number,
  scheduledForIso: string,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("topic_audits")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("topic_audits").insert({
    user_id: userId,
    material_id: materialId,
    scheduled_for: scheduledForIso,
    trigger: "adaptive" as const,
    audit_round: round,
    status: "pending" as const,
  });
  // Kolizja na unikalnym indeksie = ktoś właśnie utworzył pending — to OK.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new Error(`createPendingAudit failed: ${error.message}`);
  }
  return !error;
}

/**
 * Planuje kolejny audyt materiału po ukończonym audycie, z interwałem zależnym
 * od wyniku (score 1–10). Wywoływane przy zamykaniu sesji audytu.
 */
export async function scheduleNextAudit(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
  completedRound: number,
  score: number,
): Promise<void> {
  const { intervalDays, nextRound } = nextAuditInterval(completedRound, score);
  const scheduledFor = new Date(Date.now() + intervalDays * DAY_MS).toISOString();
  await createPendingAudit(supabase, userId, materialId, nextRound, scheduledFor);
}

/**
 * Brama mastery: jeśli materiał jest opanowany (section status 'done') i nie ma
 * jeszcze żadnego pending audytu, planuje pierwszy audyt (round 1, +7 dni).
 * Idempotentne. Wywoływane po zamknięciu sesji Deep Dive.
 */
export async function scheduleFirstAuditIfMastered(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
): Promise<boolean> {
  // Jeśli pending audyt już istnieje — nic nie rób.
  const { data: existing } = await supabase
    .from("topic_audits")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return false;

  // Pobierz pytania otwarte materiału (bez audit items) + ich najnowsze score'y.
  const { data: openItems } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null);

  const itemIds = (openItems ?? []).map((r) => (r as { id: string }).id);
  if (itemIds.length === 0) return false;

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("item_id, score, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  const latestScore = new Map<string, number | null>();
  for (const row of reviewRows ?? []) {
    const r = row as { item_id: string; score: number | null };
    if (!latestScore.has(r.item_id)) latestScore.set(r.item_id, r.score);
  }

  const latestScores = itemIds.map((id) => latestScore.get(id) ?? null);
  const section = computeSectionStatus(latestScores);
  if (section.status !== "done") return false;

  const scheduledFor = new Date(Date.now() + 7 * DAY_MS).toISOString();
  return createPendingAudit(supabase, userId, materialId, 1, scheduledFor);
}
