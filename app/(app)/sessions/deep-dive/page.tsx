import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/shared/section-header";
import { CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";
import { DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";
import {
  computeSectionStatus,
  type SectionStats,
  type SectionStatus,
} from "@/lib/sessions/section-status";
import { DeepDivePreview, type PreviewStats } from "@/components/sessions/deep-dive-preview";

// Statusy które widać w domyślnym selektorze (bez toggle "Pokaż ukończone").
const ACTIVE_STATUSES = new Set<SectionStatus>([
  "fresh",
  "in_progress",
  "needs_followup",
]);

interface MaterialOption {
  id: string;
  title: string;
  category: Category;
  status: MaterialStatus;
  open_count: number;
  section: SectionStats;
  leech_count: number;
}

interface ActiveDeepDive {
  material_id: string;
  material_title: string;
  completed: number;
  planned: number;
}

type DeepDiveStats = PreviewStats;

export default async function DeepDiveSelectorPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; show_done?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const previewId = params.preview ?? null;
  const showDone = params.show_done === "1";

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, category, status")
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("imported_at", { ascending: false });

  const materialList = (materials ?? []) as Pick<MaterialOption, "id" | "title" | "category" | "status">[];

  const materialIds = materialList.map((m) => m.id);
  const sectionsByMaterial = await loadSectionStatsForMaterials(supabase, user.id, materialIds);

  const enrichedAll: MaterialOption[] = materialList
    .map((m) => {
      const entry = sectionsByMaterial.get(m.id);
      return {
        ...m,
        open_count: entry?.section.total ?? 0,
        section: entry?.section ?? computeSectionStatus([]),
        leech_count: entry?.leech_count ?? 0,
      };
    })
    .filter((m) => m.open_count > 0);

  const doneCount = enrichedAll.filter((m) => m.section.status === "done").length;

  // „Pokaż ukończone" pokazuje WYŁĄCZNIE zaliczone; domyślnie tylko aktywne.
  const enriched: MaterialOption[] = showDone
    ? enrichedAll.filter((m) => m.section.status === "done")
    : enrichedAll.filter((m) => ACTIVE_STATUSES.has(m.section.status));

  let activeDeepDive: ActiveDeepDive | null = null;
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id, material_id, planned_item_ids, items_planned, started_at")
    .eq("user_id", user.id)
    .eq("mode", "deep_dive")
    .is("ended_at", null)
    .not("material_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSession) {
    const active = activeSession as {
      id: string;
      material_id: string | null;
      planned_item_ids: string[] | null;
      items_planned: number | null;
    };
    const material = active.material_id
      ? enrichedAll.find((m) => m.id === active.material_id)
      : null;

    if (active.material_id && material) {
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("session_id", active.id);
      const planned = Math.min(
        active.planned_item_ids?.length || active.items_planned || material.open_count,
        DEEP_DIVE_ROUND_SIZE
      );
      const completed = Math.min(count ?? 0, planned);
      if (completed < planned) {
        activeDeepDive = {
          material_id: active.material_id,
          material_title: material.title,
          completed,
          planned,
        };
      }
    }
  }

  const previewMaterial = previewId
    ? enriched.find((m) => m.id === previewId) ?? null
    : null;

  const previewStats: DeepDiveStats | null = previewMaterial
    ? await fetchDeepDiveStats(supabase, user.id, previewMaterial.id, {
        section: previewMaterial.section,
        leech_count: previewMaterial.leech_count,
      })
    : null;

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Deep Dive"
        sub={`Wybierz materiał i zrób krótką rundę ${DEEP_DIVE_ROUND_SIZE} pytań otwartych. AI oceni Twoje odpowiedzi.`}
      />

      {activeDeepDive && (
        <div className="mt-6 rounded-lg border border-accent/35 bg-accent-soft px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-1">
              W toku
            </div>
            <h2 className="font-serif text-[18px] leading-tight text-fg">
              {activeDeepDive.material_title}
            </h2>
            <p className="text-sm text-muted mt-1">
              {activeDeepDive.completed} z {activeDeepDive.planned} pytań w tej rundzie
            </p>
          </div>
          <Button asChild className="min-h-10">
            <Link href={`/sessions/deep-dive/${activeDeepDive.material_id}`}>Kontynuuj</Link>
          </Button>
        </div>
      )}

      {enrichedAll.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <BookOpen size={48} className="text-muted" />
          <div>
            <h2 className="font-serif text-[20px] font-medium mb-1">Brak materiałów do Deep Dive</h2>
            <p className="text-[14px] text-muted max-w-md">
              Zaimportuj jakiś materiał - wygenerujemy krótką rundę pytań otwartych automatycznie.
            </p>
          </div>
          <Button asChild>
            <Link href="/materials/import">+ Nowy materiał</Link>
          </Button>
        </div>
      ) : (
        <>
          {doneCount > 0 && (
            <div className="mt-6 flex items-center justify-end">
              <Link
                href={showDone ? "/sessions/deep-dive" : "/sessions/deep-dive?show_done=1"}
                scroll={false}
                className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted hover:text-fg transition-colors"
              >
                {showDone ? "← Ukryj ukończone" : `Pokaż ukończone (${doneCount}) →`}
              </Link>
            </div>
          )}

          {enriched.length === 0 ? (
            <div className="mt-6 bg-surface border border-line rounded-2xl p-10 flex flex-col items-center text-center gap-3">
              <BookOpen size={40} className="text-muted" />
              <div className="font-serif text-[18px]">Wszystko zaliczone ✓</div>
              <p className="text-[13px] text-muted max-w-sm">
                Aktywne materiały są opanowane. Audyty zadbają o długoterminową retencję.
                Włącz „Pokaż ukończone” jeśli chcesz powtórzyć któryś.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 mt-6">
              <ul className="space-y-2">
                {enriched.map((m) => {
                  const isSelected = previewId === m.id;
                  const isDone = m.section.status === "done";
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/sessions/deep-dive?preview=${m.id}${showDone ? "&show_done=1" : ""}`}
                        scroll={false}
                        className={`block bg-surface border rounded-xl p-4 transition-colors ${
                          isSelected
                            ? "border-accent/60 bg-accent-soft/40"
                            : activeDeepDive?.material_id === m.id
                            ? "border-accent/60 hover:border-line-strong"
                            : isDone
                            ? "border-ok/50 hover:border-ok"
                            : "border-line hover:border-line-strong"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Chip variant="default" size="sm">
                            {CATEGORY_LABELS[m.category]}
                          </Chip>
                          {isDone && (
                            <span className="font-mono text-[10px] uppercase tracking-wide text-ok">
                              ✓ Zaliczone
                            </span>
                          )}
                          {activeDeepDive?.material_id === m.id && (
                            <span className="font-mono text-[10px] uppercase tracking-wide text-accent">
                              Kontynuuj
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-[15px] leading-snug line-clamp-2">{m.title}</h3>
                        <p className="font-mono text-[11px] text-muted mt-2">
                          {renderSectionMeta(m.section, m.leech_count)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {previewMaterial && previewStats ? (
                <DeepDivePreview
                  material={previewMaterial}
                  stats={previewStats}
                  roundSize={DEEP_DIVE_ROUND_SIZE}
                />
              ) : (
                <div className="bg-surface border border-line rounded-2xl p-8 lg:min-h-[360px] flex flex-col items-center justify-center text-center gap-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                    Wybierz materiał
                  </div>
                  <BookOpen size={48} className="text-muted" />
                  <p className="text-[14px] text-muted max-w-sm">
                    Kliknij materiał z listy obok, żeby zobaczyć statystyki i zacząć Deep Dive.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function renderSectionMeta(section: SectionStats, leechCount: number): string {
  const leech = leechCount > 0 ? ` · 🐌 ${leechCount}` : "";
  switch (section.status) {
    case "fresh":
      return `${section.total} pytań · świeży${leech}`;
    case "in_progress":
      return `${section.scored}/${section.total} ocenione · w toku${leech}`;
    case "needs_followup":
      return `${section.avg?.toFixed(1) ?? "—"} śr · ${section.below_floor_count} poniżej 6${leech}`;
    case "done":
      return `${section.avg?.toFixed(1) ?? "—"} śr · ✓ zaliczone`;
  }
}

async function fetchDeepDiveStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string,
  sectionFromBatch?: { section: SectionStats; leech_count: number },
): Promise<DeepDiveStats> {
  const { data: openItemsRaw } = await supabase
    .from("items")
    .select("id, question, is_leech")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null);

  const items = (openItemsRaw ?? []) as {
    id: string;
    question: string;
    is_leech: boolean | null;
  }[];
  const openItemIds = items.map((i) => i.id);
  const questionById = new Map(items.map((i) => [i.id, i.question]));

  // Section stats: prefer the batch-loaded one (from selector) to avoid
  // duplicate work. Fall back to a fresh query for direct entry points.
  let section: SectionStats;
  let leechCount: number;
  if (sectionFromBatch) {
    section = sectionFromBatch.section;
    leechCount = sectionFromBatch.leech_count;
  } else {
    const latestByItem = await getLatestScoresForItems(supabase, userId, openItemIds);
    const latestScores = items.map((i) => latestByItem.get(i.id) ?? null);
    section = computeSectionStatus(latestScores);
    leechCount = items.filter((i) => i.is_leech === true).length;
  }

  if (openItemIds.length === 0) {
    return {
      total_open: 0,
      mastered: 0,
      weak_count: 0,
      below_floor_count: 0,
      leech_count: 0,
      section_status: section.status,
      section_avg: null,
      total_reviews: 0,
      avg_score: null,
      sample_size: 0,
      last_session_ended_at: null,
      sparkline: [],
      last_review: null,
    };
  }

  const [
    { count: totalReviews },
    { data: recentReviews },
    { data: lastReviewRows },
    { data: lastSession },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("item_id", openItemIds),
    supabase
      .from("reviews")
      .select("score, created_at")
      .eq("user_id", userId)
      .in("item_id", openItemIds)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reviews")
      .select("item_id, user_answer, score, ai_feedback_positive, ai_feedback_negative, created_at")
      .eq("user_id", userId)
      .in("item_id", openItemIds)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("sessions")
      .select("ended_at")
      .eq("user_id", userId)
      .eq("material_id", materialId)
      .eq("mode", "deep_dive")
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reviewsRows = (recentReviews ?? []) as { score: number | null; created_at: string }[];
  const scoredRows = reviewsRows.filter((r): r is { score: number; created_at: string } => r.score !== null);
  let avgScore: number | null = null;
  let sparkline: number[] = [];
  if (scoredRows.length > 0) {
    const sum = scoredRows.reduce((a, r) => a + r.score, 0);
    avgScore = sum / scoredRows.length;
    sparkline = scoredRows.slice(0, 10).map((r) => r.score).reverse();
  }

  const lastReviewRow = (lastReviewRows ?? [])[0] as
    | {
        item_id: string;
        user_answer: string | null;
        score: number | null;
        ai_feedback_positive: string | null;
        ai_feedback_negative: string | null;
      }
    | undefined;

  let lastReview: DeepDiveStats["last_review"] = null;
  if (lastReviewRow) {
    lastReview = {
      question: questionById.get(lastReviewRow.item_id) ?? "",
      user_answer: lastReviewRow.user_answer,
      score: lastReviewRow.score,
      ai_feedback_positive: lastReviewRow.ai_feedback_positive,
      ai_feedback_negative: lastReviewRow.ai_feedback_negative,
    };
  }

  return {
    total_open: section.total,
    mastered: section.mastered_count,
    weak_count: section.weak_count,
    below_floor_count: section.below_floor_count,
    leech_count: leechCount,
    section_status: section.status,
    section_avg: section.avg,
    total_reviews: totalReviews ?? 0,
    avg_score: avgScore,
    sample_size: scoredRows.length,
    last_session_ended_at: (lastSession as { ended_at: string } | null)?.ended_at ?? null,
    sparkline,
    last_review: lastReview,
  };
}

/**
 * Batch query: pobiera latest_score per item dla wszystkich open items
 * wszystkich podanych materiałów. Jedno query items + jedno reviews,
 * dalej grupowane w pamięci. Skala max ~1000 wierszy (50-200 materiałów × 5).
 */
async function loadSectionStatsForMaterials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialIds: string[],
): Promise<Map<string, { section: SectionStats; leech_count: number }>> {
  const out = new Map<string, { section: SectionStats; leech_count: number }>();
  if (materialIds.length === 0) return out;

  const { data: itemsRaw } = await supabase
    .from("items")
    .select("id, material_id, is_leech")
    .eq("user_id", userId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .in("material_id", materialIds);

  const items = (itemsRaw ?? []) as { id: string; material_id: string; is_leech: boolean | null }[];
  if (items.length === 0) return out;

  const latestByItem = await getLatestScoresForItems(supabase, userId, items.map((i) => i.id));

  const byMaterial = new Map<string, { latestScores: Array<number | null>; leechCount: number }>();
  for (const it of items) {
    const entry = byMaterial.get(it.material_id) ?? { latestScores: [], leechCount: 0 };
    entry.latestScores.push(latestByItem.get(it.id) ?? null);
    if (it.is_leech) entry.leechCount += 1;
    byMaterial.set(it.material_id, entry);
  }

  for (const [matId, entry] of byMaterial.entries()) {
    out.set(matId, {
      section: computeSectionStatus(entry.latestScores),
      leech_count: entry.leechCount,
    });
  }
  return out;
}

async function getLatestScoresForItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (itemIds.length === 0) return out;

  const { data } = await supabase
    .from("reviews")
    .select("item_id, score, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  for (const row of (data ?? []) as { item_id: string; score: number | null }[]) {
    if (!out.has(row.item_id)) out.set(row.item_id, row.score);
  }
  return out;
}
