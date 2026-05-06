import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Flame, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReviewRow {
  id: string;
  created_at: string;
  fsrs_rating: number | null;
  ai_evaluation: string | null;
}

interface ItemRow {
  fsrs_review_count: number;
  fsrs_lapse_count: number;
  is_leech: boolean;
}

const WEEKS_BACK = 8;

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pull last 8 weeks of reviews + all items aggregate + monthly cost rows.
  const eightWeeksAgo = startOfWeek(addDays(new Date(), -7 * WEEKS_BACK));
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);

  const [
    { data: reviewRows },
    { data: itemRows },
    { data: monthCostRows },
    { data: prevMonthCostRows },
    { count: openItemsCount },
    { count: leechCount },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, created_at, fsrs_rating, ai_evaluation")
      .eq("user_id", user.id)
      .gte("created_at", eightWeeksAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("items")
      .select("fsrs_review_count, fsrs_lapse_count, is_leech")
      .eq("user_id", user.id),
    supabase
      .from("usage_logs")
      .select("cost_usd")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("usage_logs")
      .select("cost_usd")
      .eq("user_id", user.id)
      .gte("created_at", prevMonthStart.toISOString())
      .lt("created_at", monthStart.toISOString()),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_suspended", false),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_leech", true),
  ]);

  const reviews = (reviewRows ?? []) as ReviewRow[];
  const items = (itemRows ?? []) as ItemRow[];

  // Current vs previous week
  const thisWeekStart = startOfWeek(new Date());
  const prevWeekStart = addDays(thisWeekStart, -7);

  const thisWeek = reviews.filter((r) => new Date(r.created_at) >= thisWeekStart);
  const prevWeek = reviews.filter(
    (r) =>
      new Date(r.created_at) >= prevWeekStart && new Date(r.created_at) < thisWeekStart
  );

  const thisWeekCorrect = thisWeek.filter(isCorrect).length;
  const prevWeekCorrect = prevWeek.filter(isCorrect).length;
  const thisWeekRate = thisWeek.length ? (thisWeekCorrect / thisWeek.length) * 100 : 0;
  const prevWeekRate = prevWeek.length ? (prevWeekCorrect / prevWeek.length) * 100 : 0;

  // Streak: consecutive days ending today (or yesterday if no review today yet) with >=1 review
  const streak = computeStreak(reviews);

  // Totals
  const mastered = items.filter(
    (i) => i.fsrs_review_count >= 3 && i.fsrs_lapse_count <= 1
  ).length;

  // Weekly buckets for chart
  const weekly = bucketByWeek(reviews, thisWeekStart, WEEKS_BACK);

  // Cost
  const monthCost = sum(monthCostRows ?? [], (r) => Number(r.cost_usd ?? 0));
  const prevMonthCost = sum(prevMonthCostRows ?? [], (r) => Number(r.cost_usd ?? 0));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted font-mono mb-2">
          Postępy
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium leading-[1.05] tracking-tight">
          Statystyki
        </h1>
        <p className="mt-3 text-sm text-subtle max-w-2xl">
          Jak idzie nauka? Tygodniowa dynamika, opanowane fiszki, ciągłość codziennych powtórek
          i koszty AI.
        </p>
      </header>

      {/* Hero — week-over-week */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <HeroMetric
          label="W tym tygodniu"
          value={thisWeek.length}
          unit={thisWeek.length === 1 ? "powtórka" : "powtórek"}
          delta={thisWeek.length - prevWeek.length}
          deltaSuffix="vs poprzedni tydzień"
          accent="primary"
        />
        <HeroMetric
          label="Skuteczność tego tygodnia"
          value={thisWeek.length ? `${Math.round(thisWeekRate)}%` : "—"}
          unit={thisWeek.length ? `${thisWeekCorrect} / ${thisWeek.length} poprawnych` : "brak danych"}
          delta={thisWeek.length && prevWeek.length ? Math.round(thisWeekRate - prevWeekRate) : 0}
          deltaSuffix="pp vs poprzedni"
          accent="secondary"
        />
      </section>

      {/* Streak + totals strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <SmallStat
          value={streak}
          label={streak === 1 ? "dzień z rzędu" : "dni z rzędu"}
          icon={<Flame className="h-4 w-4 text-accent" />}
        />
        <SmallStat value={mastered} label="opanowanych" />
        <SmallStat value={openItemsCount ?? 0} label="aktywnych" />
        <SmallStat value={leechCount ?? 0} label="problematycznych" emphasize={(leechCount ?? 0) > 0} />
      </section>

      {/* Weekly bar chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Aktywność — ostatnie {WEEKS_BACK} tygodni</CardTitle>
          <CardDescription>
            Liczba powtórek i pytań tygodniowo. Jasniejsza część kafelka = poprawne odpowiedzi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyBars data={weekly} />
        </CardContent>
      </Card>

      {/* Cost */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Koszty AI</CardTitle>
          <CardDescription>
            Zużycie API — szczegóły per operacja:{" "}
            <Link href="/costs" className="text-accent hover:underline">
              /costs
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-mono font-medium">{formatUsd(monthCost)}</div>
              <div className="text-xs text-muted mt-1">ten miesiąc</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-medium text-muted">
                {formatUsd(prevMonthCost)}
              </div>
              <div className="text-xs text-muted mt-1">poprzedni miesiąc</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  accent,
}: {
  label: string;
  value: number | string;
  unit: string;
  delta: number;
  deltaSuffix: string;
  accent: "primary" | "secondary";
}) {
  const positive = delta > 0;
  const negative = delta < 0;
  const Trend = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const trendColor = positive ? "text-ok" : negative ? "text-bad" : "text-muted";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface p-6 shadow-sm shadow-black/[0.02] dark:shadow-black/20",
        accent === "primary" ? "border-accent/30" : "border-line"
      )}
    >
      <div className="text-xs uppercase tracking-[0.15em] text-muted font-mono mb-2">{label}</div>
      <div className="flex items-baseline gap-3">
        <div className="font-serif text-5xl font-medium leading-none tracking-tight">{value}</div>
        <div className="text-sm text-muted">{unit}</div>
      </div>
      <div className={cn("mt-4 inline-flex items-center gap-1.5 text-sm", trendColor)}>
        <Trend className="h-4 w-4" />
        <span className="font-medium">
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
        <span className="text-muted">{deltaSuffix}</span>
      </div>
    </div>
  );
}

function SmallStat({
  value,
  label,
  icon,
  emphasize = false,
}: {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 bg-surface shadow-sm shadow-black/[0.02] dark:shadow-black/20",
        emphasize ? "border-warn/40 bg-warn/5" : "border-line"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <div className="text-2xl font-serif font-medium leading-none">{value}</div>
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

interface WeeklyBucket {
  weekStart: Date;
  total: number;
  correct: number;
}

function WeeklyBars({ data }: { data: WeeklyBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => {
        const h = (d.total / max) * 100;
        const correctH = d.total ? (d.correct / d.total) * 100 : 0;
        const isCurrent = i === data.length - 1;
        return (
          <div key={d.weekStart.toISOString()} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex-1 flex items-end" title={`${d.total} powtórek, ${d.correct} poprawnych`}>
              <div
                className={cn(
                  "w-full rounded-t-md relative overflow-hidden",
                  isCurrent ? "bg-accent/30" : "bg-elevated"
                )}
                style={{ height: `${Math.max(h, d.total ? 4 : 0)}%`, minHeight: d.total ? "4px" : "0" }}
              >
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0",
                    isCurrent ? "bg-accent" : "bg-fg/70"
                  )}
                  style={{ height: `${correctH}%` }}
                />
              </div>
            </div>
            <div className={cn("text-[10px] font-mono", isCurrent ? "text-accent" : "text-muted")}>
              {formatWeekLabel(d.weekStart)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

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

function bucketByWeek(reviews: ReviewRow[], thisWeekStart: Date, weeksBack: number): WeeklyBucket[] {
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

function computeStreak(reviews: ReviewRow[]): number {
  if (reviews.length === 0) return 0;
  const days = new Set<string>();
  for (const r of reviews) {
    const d = new Date(r.created_at);
    d.setHours(0, 0, 0, 0);
    days.add(d.toISOString().slice(0, 10));
  }
  // Start counting from today; if no review today, start from yesterday (so a
  // running streak isn't broken by "haven't reviewed yet today").
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);
  let cursor = days.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
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
