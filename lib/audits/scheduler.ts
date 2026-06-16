/**
 * Topic-audit orchestration.
 *
 * `getDueAudits(supabase, userId)` — list pending audits ready to run now.
 * `prepareAudit(supabase, userId, auditId)` — REUSE the material's existing open
 *   questions (no AI, no new items inserted), pick AUDIT_QUESTIONS_PER_MATERIAL of
 *   them rotating oldest-reviewed first, return the list for the UI to play.
 *   The user self-grades each; isolation via reviews.is_audit.
 *
 * Scoring + status transitions happen in /api/sessions/[id]/end when the
 * session that ran the audit closes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextAuditInterval } from "@/lib/audits/intervals";
import { computeSectionStatus } from "@/lib/sessions/section-status";
import type { AuditTrigger, Item, Material, TopicAudit } from "@/lib/db/types";

/** Maks. liczba materiałów w jednej skonsolidowanej sesji audytu. */
export const AUDIT_SESSION_SIZE = 3;

/** Liczba (reużywanych) pytań otwartych pobieranych na materiał w sesji audytu. */
export const AUDIT_QUESTIONS_PER_MATERIAL = 2;

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

interface LatestReviewInfo {
  created_at: string;
  score: number | null;
}

/**
 * Najnowszy review per item (wszystkie źródła, łącznie z audytowymi — staleness
 * audytu ma uwzględniać także poprzednie audyty, żeby pytania rotowały).
 */
async function getLatestReviewByItem(
  supabase: SupabaseClient,
  userId: string,
  itemIds: string[]
): Promise<Map<string, LatestReviewInfo>> {
  if (itemIds.length === 0) return new Map();
  const { data } = await supabase
    .from("reviews")
    .select("item_id, created_at, score")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  const latest = new Map<string, LatestReviewInfo>();
  for (const row of data ?? []) {
    const r = row as { item_id: string; created_at: string; score: number | null };
    if (!latest.has(r.item_id)) latest.set(r.item_id, { created_at: r.created_at, score: r.score });
  }
  return latest;
}

/**
 * Wybiera istniejące pytania otwarte materiału do audytu (reużycie, bez AI).
 * Bierze AUDIT_QUESTIONS_PER_MATERIAL pytań, rotując po najdawniej sprawdzanych
 * (remis → najniższy ostatni wynik). Pytania bez `answer_reference` są pomijane
 * (nie ma czego odsłonić). Nie wstawia żadnych nowych itemów.
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

  // Reużywamy istniejące pytania otwarte materiału (te z Deep Dive). Audyt nigdy
  // nie zaznacza `audit_id` na tych itemach — powiązanie audyt↔review idzie przez
  // sesję, a same pytania mogą wracać w wielu audytach.
  const { data: openRows } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, difficulty, category")
    .eq("user_id", userId)
    .eq("material_id", audit.material_id)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .not("answer_reference", "is", null);

  const open = (openRows ?? []) as PreparedAudit["items"];
  if (open.length === 0) {
    throw new Error("material has no reusable open questions — cannot run audit");
  }

  const latest = await getLatestReviewByItem(supabase, userId, open.map((it) => it.id));

  // Najdawniej sprawdzane najpierw (brak review → najwyższy priorytet),
  // remis → najniższy ostatni wynik (najsłabsze najpierw).
  const sorted = [...open].sort((a, b) => {
    const la = latest.get(a.id);
    const lb = latest.get(b.id);
    if (!la && lb) return -1;
    if (la && !lb) return 1;
    if (la && lb) {
      const t = new Date(la.created_at).getTime() - new Date(lb.created_at).getTime();
      if (t !== 0) return t;
      return (la.score ?? 0) - (lb.score ?? 0);
    }
    return 0;
  });

  return { audit, material, items: sorted.slice(0, AUDIT_QUESTIONS_PER_MATERIAL) };
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

  // Tylko nie-audytowe oceny liczą się do bramy mastery (izolacja self-grade).
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("item_id, score, created_at")
    .eq("user_id", userId)
    .eq("is_audit", false)
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

/**
 * Bootstrap kolejki audytów: dla każdego gotowego materiału, który jest
 * opanowany (section status 'done' z nie-audytowych ostatnich wyników) i nie ma
 * jeszcze pending audytu — planuje pierwszy audyt (round 1, rozłożony +1..+7 dni,
 * żeby nie spadły wszystkie naraz). Idempotentne (chronione unikalnym indeksem
 * topic_audits_one_pending_per_material). Zwraca liczbę nowo zaplanowanych.
 *
 * Wołane przy wejściu na stronę Audyty — niezależne od crona i od tego, czy
 * sesja Deep Dive domknie się w idealnym momencie.
 */
export async function enrollMasteredMaterials(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  // Materiały gotowe.
  const { data: matRows } = await supabase
    .from("materials")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ready")
    .is("deleted_at", null);
  const materialIds = (matRows ?? []).map((r) => (r as { id: string }).id);
  if (materialIds.length === 0) return 0;

  // Materiały, które już mają pending audyt — pomijamy.
  const { data: pendingRows } = await supabase
    .from("topic_audits")
    .select("material_id")
    .eq("user_id", userId)
    .eq("status", "pending");
  const hasPending = new Set((pendingRows ?? []).map((r) => (r as { material_id: string }).material_id));

  const candidates = materialIds.filter((id) => !hasPending.has(id));
  if (candidates.length === 0) return 0;

  // Pytania otwarte tych materiałów (bez audit items).
  const { data: itemRows } = await supabase
    .from("items")
    .select("id, material_id")
    .eq("user_id", userId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .in("material_id", candidates);

  const itemsByMaterial = new Map<string, string[]>();
  for (const row of itemRows ?? []) {
    const r = row as { id: string; material_id: string };
    const arr = itemsByMaterial.get(r.material_id) ?? [];
    arr.push(r.id);
    itemsByMaterial.set(r.material_id, arr);
  }

  const allItemIds = [...itemsByMaterial.values()].flat();
  if (allItemIds.length === 0) return 0;

  // Najnowszy nie-audytowy wynik per item.
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("item_id, score, created_at")
    .eq("user_id", userId)
    .eq("is_audit", false)
    .in("item_id", allItemIds)
    .order("created_at", { ascending: false });

  const latestScore = new Map<string, number | null>();
  for (const row of reviewRows ?? []) {
    const r = row as { item_id: string; score: number | null };
    if (!latestScore.has(r.item_id)) latestScore.set(r.item_id, r.score);
  }

  let enrolled = 0;
  let offset = 0;
  for (const materialId of candidates) {
    const ids = itemsByMaterial.get(materialId);
    if (!ids || ids.length === 0) continue; // brak pytań otwartych → nie audytujemy

    const latestScores = ids.map((id) => latestScore.get(id) ?? null);
    if (computeSectionStatus(latestScores).status !== "done") continue;

    const days = 1 + (offset % 7); // rozłożenie +1..+7 dni
    const scheduledFor = new Date(Date.now() + days * DAY_MS).toISOString();
    if (await createPendingAudit(supabase, userId, materialId, 1, scheduledFor)) {
      enrolled += 1;
      offset += 1;
    }
  }
  return enrolled;
}
