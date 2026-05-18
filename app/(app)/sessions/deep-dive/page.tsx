import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/shared/section-header";
import { CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";
import { DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";

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

interface DeepDiveStats {
  total_open: number;
  due_today: number;
  mastered: number;
  total_reviews: number;
  avg_score: number | null;
  sample_size: number;
  last_session_ended_at: string | null;
  sparkline: number[];
  last_review: {
    question: string;
    user_answer: string | null;
    score: number | null;
    ai_feedback_positive: string | null;
    ai_feedback_negative: string | null;
  } | null;
}

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
            <PreviewPanel material={previewMaterial} stats={previewStats} />
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

function PreviewPanel({
  material,
  stats,
}: {
  material: MaterialOption;
  stats: DeepDiveStats;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-8 flex flex-col gap-6">
      <header>
        <Chip variant="default" size="sm">
          {CATEGORY_LABELS[material.category]}
        </Chip>
        <h2 className="font-serif text-[24px] tracking-[-0.01em] leading-tight mt-3 text-fg">
          {material.title}
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <StatBlock
          label="Pytań otwartych"
          value={`${stats.total_open}`}
          sub={stats.due_today > 0 ? `${stats.due_today} due dzisiaj` : `${stats.mastered} opanowanych`}
        />
        <StatBlock
          label="Średnia ocena AI"
          value={stats.avg_score === null ? "—" : `${stats.avg_score.toFixed(1)}/10`}
          sub={stats.sample_size > 0 ? `z ostatnich ${stats.sample_size}` : "brak danych"}
        />
        <StatBlock
          label="Ostatnia sesja"
          value={stats.last_session_ended_at ? formatRelative(stats.last_session_ended_at) : "—"}
          sub={stats.last_session_ended_at ? "" : "jeszcze nie zaczynałeś"}
        />
        <StatBlock
          label="Liczba powtórek"
          value={`${stats.total_reviews}`}
          sub={stats.total_reviews === 1 ? "1 odpowiedź" : `${stats.total_reviews} odpowiedzi`}
        />
      </div>

      {stats.sparkline.length >= 2 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Trend
          </div>
          <Sparkline values={stats.sparkline} />
        </div>
      )}

      {stats.last_review && (
        <details className="border-t border-line pt-4">
          <summary className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted cursor-pointer hover:text-fg transition-colors">
            Ostatnia odpowiedź
            {stats.last_review.score !== null && (
              <span className="ml-2 text-fg">· {stats.last_review.score}/10</span>
            )}
          </summary>
          <div className="mt-3 space-y-2 text-[13px]">
            <p className="text-fg">{stats.last_review.question}</p>
            {stats.last_review.user_answer && (
              <p className="text-subtle italic">„{stats.last_review.user_answer}"</p>
            )}
            {stats.last_review.ai_feedback_positive && (
              <p className="text-muted">
                <span className="text-accent">+ </span>
                {stats.last_review.ai_feedback_positive}
              </p>
            )}
            {stats.last_review.ai_feedback_negative && (
              <p className="text-muted">
                <span className="text-bad">− </span>
                {stats.last_review.ai_feedback_negative}
              </p>
            )}
          </div>
        </details>
      )}

      <div className="flex items-center justify-end pt-2 border-t border-line">
        <Button asChild className="min-h-10">
          <Link href={`/sessions/deep-dive/${material.id}`}>
            Powtórz materiał
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1">
        {label}
      </div>
      <div className="font-serif text-[24px] leading-none tracking-[-0.01em] text-fg">
        {value}
      </div>
      {sub && <div className="font-mono text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 30;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 0.001);
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-accent">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    .select("id, question, fsrs_due_date, fsrs_review_count")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false);

  const items = (openItemsRaw ?? []) as {
    id: string;
    question: string;
    fsrs_due_date: string | null;
    fsrs_review_count: number | null;
  }[];
  const openItemIds = items.map((i) => i.id);

  const totalOpen = items.length;
  const dueToday = items.filter((i) => i.fsrs_due_date && i.fsrs_due_date <= nowIso).length;
  const mastered = items.filter((i) => (i.fsrs_review_count ?? 0) >= 3).length;
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "przed chwilą" : `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "godz." : "godz."} temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "dzień" : "dni"} temu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "tydz." : "tyg."} temu`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "mies." : "mies."} temu`;
}
