/**
 * Lightweight count queries that feed the mobile session picker (bottom sheet)
 * and the "Sesje" tab badge. All use `head: true` so Postgres returns only the
 * count, never the rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSectionStatus } from "@/lib/sessions/section-status";

export interface SessionCounts {
  /** Cloze items due for review now (daily-new cap not applied here). */
  reviewsDue: number;
  /**
   * Open questions still worth a Deep Dive, liczone per-materiał: pomijamy
   * materiały zaliczone (section status 'done'), a w pozostałych liczymy pytania
   * <7 (weak) lub nigdy nieoceniane (fresh). To dokładnie to, co zaserwowałaby
   * sesja Deep Dive w aktywnych materiałach — badge nie wlicza już „akceptowalnych"
   * szóstek tkwiących w materiałach zaliczonych (śr ≥7, ale z pytaniem 6).
   */
  deepDiveAvailable: number;
  /** Materiały gotowe do audytu (pending, scheduled_for minął) — model „pull". */
  auditsDue: number;
  /** Knowledge gaps still open. */
  gapsOpen: number;
}

async function countOrZero(
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/**
 * One round-trip per counter (four cheap COUNT queries). Failures degrade to 0
 * so a transient error never blanks the whole nav.
 */
export async function getSessionCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionCounts> {
  const nowIso = new Date().toISOString();

  const [reviewsDue, deepDiveAvailable, auditsDue, gapsOpen] = await Promise.all([
    countOrZero(
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "cloze")
        .eq("is_suspended", false)
        .is("audit_id", null)
        .lte("fsrs_due_date", nowIso)
    ),
    countUnmasteredOpen(supabase, userId),
    countOrZero(
      supabase
        .from("topic_audits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
    ),
    countOrZero(
      supabase
        .from("knowledge_gaps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "open")
    ),
  ]);

  return { reviewsDue, deepDiveAvailable, auditsDue, gapsOpen };
}

/**
 * Liczy pytania otwarte warte Deep Dive, per-materiał. Materiał zaliczony
 * (section status 'done') wnosi 0; w pozostałych liczymy pytania <7 lub fresh
 * (dokładnie kolejka Deep Dive). Nie da się tego wyrazić jednym COUNT-em
 * (potrzebny „latest review per item" + status sekcji), więc robimy dwa lekkie
 * zapytania, grupujemy per-materiał i agregujemy w pamięci — skala to maks.
 * kilkaset wierszy. Błąd degraduje do 0, jak reszta liczników w nawigacji.
 */
async function countUnmasteredOpen(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: itemRows, error: itemErr } = await supabase
    .from("items")
    .select("id, material_id")
    .eq("user_id", userId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null);
  if (itemErr || !itemRows || itemRows.length === 0) return 0;

  const items = itemRows as { id: string; material_id: string }[];
  const itemIds = items.map((r) => r.id);

  const { data: reviewRows, error: reviewErr } = await supabase
    .from("reviews")
    .select("item_id, score, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });
  if (reviewErr) return 0;

  // Najnowszy score per item (wiersze już posortowane DESC).
  const latestScore = new Map<string, number | null>();
  for (const row of (reviewRows ?? []) as { item_id: string; score: number | null }[]) {
    if (!latestScore.has(row.item_id)) latestScore.set(row.item_id, row.score);
  }

  // Grupujemy najnowsze score'y per materiał, żeby wyliczyć status sekcji.
  const byMaterial = new Map<string, Array<number | null>>();
  for (const it of items) {
    const arr = byMaterial.get(it.material_id) ?? [];
    arr.push(latestScore.get(it.id) ?? null); // brak review = fresh
    byMaterial.set(it.material_id, arr);
  }

  let available = 0;
  for (const scores of byMaterial.values()) {
    const section = computeSectionStatus(scores);
    if (section.status === "done") continue; // zaliczony materiał nie nagabuje
    // weak (<7) + fresh — to co realnie zaserwuje selectDeepDiveItems.
    available += section.weak_count + section.new_count;
  }
  return available;
}
