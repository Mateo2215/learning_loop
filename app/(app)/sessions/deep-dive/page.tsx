import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/shared/section-header";
import { CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";
import { DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";
import { DeepDivePreview, type PreviewStats } from "@/components/sessions/deep-dive-preview";

// Items with FSRS stability ≥ this many days count as "mastered". Matches
// the `young`/`mature` threshold used by the MasteryBar on the material
// detail page (computeSegments). Was previously `fsrs_review_count >= 3`,
// which measured attempts rather than retention.
const MASTERY_STABILITY_DAYS = 7;

interface MaterialOption {
  id: string;
  title: string;
  category: Category;
  status: MaterialStatus;
  open_count: number;
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
  searchParams: Promise<{ preview?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const previewId = params.preview ?? null;

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, category, status")
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("imported_at", { ascending: false });

  const materialList = (materials ?? []) as Pick<MaterialOption, "id" | "title" | "category" | "status">[];

  const counts = new Map<string, number>();
  if (materialList.length > 0) {
    const ids = materialList.map((m) => m.id);
    const { data: items } = await supabase
      .from("items")
      .select("material_id")
      .eq("type", "open")
      .in("material_id", ids);

    for (const row of items ?? []) {
      const id = (row as { material_id: string }).material_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const enriched: MaterialOption[] = materialList
    .map((m) => ({ ...m, open_count: counts.get(m.id) ?? 0 }))
    .filter((m) => m.open_count > 0);

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
      ? enriched.find((m) => m.id === active.material_id)
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
    ? await fetchDeepDiveStats(supabase, user.id, previewMaterial.id)
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

      {enriched.length === 0 ? (
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
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 mt-8">
          <ul className="space-y-2">
            {enriched.map((m) => {
              const isSelected = previewId === m.id;
              return (
                <li key={m.id}>
                  <Link
                    href={`/sessions/deep-dive?preview=${m.id}`}
                    scroll={false}
                    className={`block bg-surface border rounded-xl p-4 transition-colors ${
                      isSelected
                        ? "border-accent/60 bg-accent-soft/40"
                        : activeDeepDive?.material_id === m.id
                        ? "border-accent/60 hover:border-line-strong"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Chip variant="default" size="sm">
                        {CATEGORY_LABELS[m.category]}
                      </Chip>
                      {activeDeepDive?.material_id === m.id && (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-accent">
                          Kontynuuj
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-[15px] leading-snug line-clamp-2">{m.title}</h3>
                    <p className="font-mono text-[11px] text-muted mt-2">
                      {m.open_count} {m.open_count === 1 ? "pytanie w puli" : "pytań w puli"} · runda{" "}
                      {Math.min(m.open_count, DEEP_DIVE_ROUND_SIZE)}
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
    </div>
  );
}

async function fetchDeepDiveStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string,
): Promise<DeepDiveStats> {
  const nowIso = new Date().toISOString();

  const { data: openItemsRaw } = await supabase
    .from("items")
    .select("id, question, fsrs_due_date, fsrs_stability")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false);

  const items = (openItemsRaw ?? []) as {
    id: string;
    question: string;
    fsrs_due_date: string | null;
    fsrs_stability: number | null;
  }[];
  const openItemIds = items.map((i) => i.id);

  const totalOpen = items.length;
  const dueToday = items.filter((i) => i.fsrs_due_date && i.fsrs_due_date <= nowIso).length;
  const mastered = items.filter((i) => (i.fsrs_stability ?? 0) >= MASTERY_STABILITY_DAYS).length;
  const questionById = new Map(items.map((i) => [i.id, i.question]));

  if (openItemIds.length === 0) {
    return {
      total_open: 0,
      due_today: 0,
      mastered: 0,
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
    total_open: totalOpen,
    due_today: dueToday,
    mastered,
    total_reviews: totalReviews ?? 0,
    avg_score: avgScore,
    sample_size: scoredRows.length,
    last_session_ended_at: (lastSession as { ended_at: string } | null)?.ended_at ?? null,
    sparkline,
    last_review: lastReview,
  };
}
