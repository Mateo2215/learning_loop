import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/shared/section-header";
import { KPICard } from "@/components/shared/kpi-card";
import { ActivityChart, type ActivityChartDatum } from "@/components/stats/activity-chart";

interface ReviewRow {
  id: string;
  created_at: string;
  fsrs_rating: number | null;
  ai_evaluation: string | null;
}

const WEEKS_BACK = 8;

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eightWeeksAgo = startOfWeek(addDays(new Date(), -7 * WEEKS_BACK));
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = addDays(new Date(), -7);
  const thirtyDaysAgo = addDays(new Date(), -30);

  const [
    { data: reviewRows },
    { data: monthCostRows },
    { count: materialsCount },
    { count: itemsCount },
    { count: sessionsCount },
    { count: auditsDoneCount },
    { data: thirtyDayReviews },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, created_at, fsrs_rating, ai_evaluation")
      .eq("user_id", user.id)
      .gte("created_at", eightWeeksAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("usage_logs")
      .select("cost_usd")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", thirtyDaysAgo.toISOString()),
    supabase
      .from("topic_audits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("reviews")
      .select("ai_evaluation, fsrs_rating, created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const reviews = (reviewRows ?? []) as ReviewRow[];

  const lastWeekReviews = reviews.filter((r) => new Date(r.created_at) >= sevenDaysAgo);

  const last30 = (thirtyDayReviews ?? []) as ReviewRow[];
  const correctIn30 = last30.filter(isCorrect).length;
  const skutecznoscPct = last30.length ? Math.round((correctIn30 / last30.length) * 100) : 0;

  const thisWeekStart = startOfWeek(new Date());
  const weekly = bucketByWeek(reviews, thisWeekStart, WEEKS_BACK);
  const chartData: ActivityChartDatum[] = weekly.map((b) => ({
    week: formatWeekLabel(b.weekStart),
    correct: b.correct,
    total: b.total,
  }));

  const monthCost = sum(monthCostRows ?? [], (r) => Number(r.cost_usd ?? 0));

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-8 sm:px-6 sm:py-10">
      <SectionHeader
        title="Statystyki"
        sub="Twoja pętla nauki w liczbach. Tygodniowa dynamika, skuteczność i koszty AI."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div className="rounded-2xl border border-accent/30 bg-surface p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
            W tym tygodniu
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <div className="font-serif text-[56px] leading-none tracking-tight text-accent">
              {lastWeekReviews.length}
            </div>
            <div className="text-[14px] text-subtle">
              {lastWeekReviews.length === 1 ? "powtórka" : "powtórek"}
            </div>
          </div>
          <div className="mt-3 text-[12px] text-muted">
            ostatnie 7 dni
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Skuteczność (30 dni)
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <div className="font-serif text-[56px] leading-none tracking-tight text-fg">
              {last30.length ? `${skutecznoscPct}%` : "—"}
            </div>
            {last30.length > 0 && (
              <div className="text-[14px] text-subtle">
                {correctIn30} / {last30.length}
              </div>
            )}
          </div>
          <div className="mt-3 text-[12px] text-muted">
            poprawnych odpowiedzi
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <KPICard label="Materiały" number={materialsCount ?? 0} />
        <KPICard label="Fiszki" number={itemsCount ?? 0} />
        <KPICard label="Sesje (30d)" number={sessionsCount ?? 0} />
        <KPICard label="Audyty wykonane" number={auditsDoneCount ?? 0} />
      </div>

      <div className="bg-surface border border-line rounded-2xl p-4 mt-8 min-w-0 overflow-hidden sm:p-6">
        <div className="flex flex-col gap-3 mb-4 min-w-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-[20px] font-medium leading-tight sm:text-[22px]">
              Aktywność (8 tygodni)
            </h3>
            <p className="mt-2 text-[12px] text-muted">
              Liczba powtórek tygodniowo. Zielony segment = poprawne odpowiedzi.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-mono text-muted sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ok" />
              poprawne
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-elevated border border-line" />
              łącznie
            </span>
          </div>
        </div>
        <ActivityChart data={chartData} />
      </div>

      <div className="bg-accent-soft border border-accent/30 rounded-2xl p-6 mt-8 flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
            Koszty AI
          </div>
          <div className="mt-2 font-serif text-[28px] leading-none tracking-tight text-fg">
            {formatUsd(monthCost)}
          </div>
          <div className="mt-2 text-[12px] text-muted">w tym miesiącu</div>
        </div>
        <Link
          href="/costs"
          className="text-[13px] font-medium text-accent hover:opacity-80 whitespace-nowrap"
        >
          Zobacz szczegóły →
        </Link>
      </div>
    </div>
  );
}

interface WeeklyBucket {
  weekStart: Date;
  total: number;
  correct: number;
}

function isCorrect(r: ReviewRow): boolean {
  if (r.ai_evaluation === "correct") return true;
  if (r.fsrs_rating != null && r.fsrs_rating >= 3) return true;
  return false;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function bucketByWeek(
  reviews: ReviewRow[],
  thisWeekStart: Date,
  weeksBack: number,
): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    buckets.push({ weekStart: addDays(thisWeekStart, -7 * i), total: 0, correct: 0 });
  }
  const firstStart = buckets[0].weekStart.getTime();
  for (const r of reviews) {
    const t = new Date(r.created_at).getTime();
    if (t < firstStart) continue;
    const weekIdx = Math.floor((t - firstStart) / (7 * 24 * 60 * 60 * 1000));
    if (weekIdx < 0 || weekIdx >= buckets.length) continue;
    buckets[weekIdx].total += 1;
    if (isCorrect(r)) buckets[weekIdx].correct += 1;
  }
  return buckets;
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

function sum<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + fn(x), 0);
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
