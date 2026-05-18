import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/shared/kpi-card";
import { Chip } from "@/components/ui/chip";
import { FreshMaterials } from "@/components/dashboard/fresh-materials";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: dueCount },
    { data: openItemsData },
    { count: auditsDueCount },
    { count: freshCount },
    { data: recentMaterials },
    { data: reviewDates },
  ] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("type", "cloze")
      .eq("is_suspended", false)
      .is("audit_id", null)
      .lte("fsrs_due_date", nowIso),
    supabase
      .from("items")
      .select("id, material_id")
      .in("type", ["open", "feynman", "scenario"])
      .eq("is_suspended", false)
      .is("audit_id", null),
    supabase
      .from("topic_audits")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("scheduled_for", nowIso),
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("imported_at", since24h),
    supabase
      .from("materials")
      .select("id, title, category, tags, imported_at")
      .is("deleted_at", null)
      .order("imported_at", { ascending: false })
      .limit(4),
    // Streak: distinct UTC dates of reviews, newest first (last 90 days is enough).
    supabase
      .from("reviews")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const itemsTodayMinutes = Math.max(1, Math.round((dueCount ?? 0) * 0.6));

  const streakStats = computeStreakStats(reviewDates ?? []);
  const heatmapDays = buildHeatmap(reviewDates ?? [], 30);
  const milestoneHint = nextMilestoneHint(streakStats.current);

  // Round 2: count library items per material + find which open items were already answered.
  const recentIds = (recentMaterials ?? []).map((m) => m.id);
  const openItemIds = (openItemsData ?? []).map((i) => (i as { id: string }).id);
  let countByMaterial = new Map<string, number>();
  let reviewedOpenIds = new Set<string>();

  await Promise.all([
    (async () => {
      if (recentIds.length === 0) return;
      const { data: itemRows } = await supabase
        .from("items")
        .select("material_id")
        .in("material_id", recentIds);
      for (const row of itemRows ?? []) {
        const id = (row as { material_id: string }).material_id;
        countByMaterial.set(id, (countByMaterial.get(id) ?? 0) + 1);
      }
    })(),
    (async () => {
      if (openItemIds.length === 0) return;
      const { data: reviewedRows } = await supabase
        .from("reviews")
        .select("item_id")
        .in("item_id", openItemIds);
      reviewedOpenIds = new Set(
        (reviewedRows ?? []).map((r) => (r as { item_id: string }).item_id)
      );
    })(),
  ]);

  // Group only unanswered open items by material.
  const openByMaterial = new Map<string, number>();
  for (const row of openItemsData ?? []) {
    const item = row as { id: string; material_id: string };
    if (!reviewedOpenIds.has(item.id)) {
      openByMaterial.set(item.material_id, (openByMaterial.get(item.material_id) ?? 0) + 1);
    }
  }
  const topDeepDiveIds = [...openByMaterial.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  // Round 3: fetch material titles for the Deep Dive section.
  let deepDiveMaterials: { id: string; title: string }[] = [];
  if (topDeepDiveIds.length > 0) {
    const { data } = await supabase
      .from("materials")
      .select("id, title")
      .in("id", topDeepDiveIds)
      .is("deleted_at", null);
    deepDiveMaterials = (data ?? []) as { id: string; title: string }[];
  }

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10 space-y-10">
      {/* Greeting */}
      <header>
        <h1 className="font-serif text-[44px] tracking-[-0.015em] leading-[1.05] text-fg">
          Dzień dobry, Mateusz
        </h1>
        <p className="mt-3 text-muted text-[13px] uppercase font-mono tracking-[0.15em]">
          {formatTodayHeader()}
        </p>
      </header>

      {/* Hero "Dzisiejsza pętla" */}
      <section className="rounded-2xl bg-accent-soft border border-accent/30 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="min-w-0">
          <h2 className="font-serif text-[28px] tracking-[-0.01em] text-fg">
            Dzisiejsza pętla
          </h2>
          {(dueCount ?? 0) === 0 ? (
            <p className="mt-2 text-subtle text-[14px]">
              Brak fiszek do powtórki — możesz dodać nowy materiał lub zrobić Deep Dive.
            </p>
          ) : (
            <div className="mt-2 space-y-1">
              <p className="text-subtle text-[14px]">
                {formatPl(dueCount ?? 0)} {plural(dueCount ?? 0, "fiszka", "fiszki", "fiszek")} do powtórki
              </p>
              <p className="text-muted text-[13px]">
                Przewidywany czas: ~{itemsTodayMinutes} min · Opanowane wracają max co 6 mies.
              </p>
            </div>
          )}
        </div>
        <Link
          href="/sessions/review"
          className="bg-accent text-accent-fg px-5 py-3 rounded-lg font-medium text-[14px] inline-flex items-center gap-2 hover:opacity-90 transition-opacity self-start md:self-auto"
        >
          Zacznij powtórki
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Deep Dive — hero card style */}
      {deepDiveMaterials.length > 0 && (
        <section className="rounded-2xl bg-elevated border border-line p-8">
          <div className="mb-5">
            <h2 className="font-serif text-[28px] tracking-[-0.01em] text-fg">Deep Dive</h2>
            <p className="mt-1 text-muted text-[13px]">Pytania otwarte wymagające Twojej odpowiedzi</p>
          </div>
          <div className="space-y-4">
            {deepDiveMaterials.map((m, i) => {
              const count = openByMaterial.get(m.id) ?? 0;
              return (
                <div key={m.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className={i === 0 ? "text-[15px] text-fg font-medium truncate" : "text-[14px] text-subtle truncate"}>
                      {m.title}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">
                      {formatPl(count)} {plural(count, "pytanie otwarte", "pytania otwarte", "pytań otwartych")}
                    </div>
                  </div>
                  <Link
                    href={`/sessions/deep-dive/${m.id}`}
                    className={i === 0
                      ? "shrink-0 bg-accent text-accent-fg px-4 py-2 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                      : "shrink-0 border border-line text-subtle px-4 py-2 rounded-lg text-[13px] hover:text-fg transition-colors whitespace-nowrap"
                    }
                  >
                    Zacznij →
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Streak */}
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
          Seria
        </div>

        <div className="flex items-end gap-8 mb-6">
          <div className="font-serif text-[64px] leading-none tracking-[-0.015em] text-fg">
            {streakStats.current >= 100 ? "100+" : streakStats.current}
          </div>
          <div
            className="flex-1 grid gap-[5px] pb-2"
            style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
            aria-label="Ostatnie 30 dni aktywności"
          >
            {heatmapDays.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count === 0 ? "brak powtórek" : `${day.count} ${plural(day.count, "powtórka", "powtórki", "powtórek")}`}`}
                className={`aspect-square rounded-sm transition-opacity ${heatmapClass(day.count)}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-md">
          <StreakMetric label="Seria" value={streakStats.current === 0 ? "—" : `${formatPl(streakStats.current)} ${plural(streakStats.current, "dzień", "dni", "dni")}`} />
          <StreakMetric label="Rekord" value={streakStats.longest === 0 ? "—" : `${formatPl(streakStats.longest)} ${plural(streakStats.longest, "dzień", "dni", "dni")}`} />
          <StreakMetric label="Ten miesiąc" value={`${formatPl(streakStats.thisMonth)}/30`} />
        </div>

        <p className="mt-4 text-[12px] text-muted">
          {streakStats.current === 0
            ? "Zacznij pierwszą sesję dzisiaj."
            : milestoneHint ?? `${plural(streakStats.current, "dzień", "dni", "dni")} z rzędu.`}
        </p>
      </section>

      {/* KPI: Do zrobienia dziś */}
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
          Do zrobienia dziś
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Fiszki dziś"
            number={formatPl(dueCount ?? 0)}
            sub={<span className="text-accent">Otwórz powtórki →</span>}
            href="/sessions/review"
          />
          <KPICard
            label="Audyty zaległe"
            number={formatPl(auditsDueCount ?? 0)}
            sub={<span className="text-accent">Zobacz audyty →</span>}
            href="/sessions/audit"
          />
          <KPICard
            label="Świeże materiały"
            number={formatPl(freshCount ?? 0)}
            sub={<span className="text-muted">ostatnie 24 h</span>}
          />
        </div>
      </section>

      {/* Świeże materiały */}
      <FreshMaterials />

      {/* Twoja biblioteka — snapshot */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Twoja biblioteka
          </h2>
          <Link
            href="/materials"
            className="text-[13px] text-accent hover:underline"
          >
            Zobacz wszystkie →
          </Link>
        </div>
        {(!recentMaterials || recentMaterials.length === 0) ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-subtle text-[14px] mb-3">
              Twoja biblioteka jest pusta.
            </p>
            <Link
              href="/materials/import"
              className="inline-flex items-center gap-2 bg-accent text-accent-fg px-4 py-2 rounded-lg text-[13px] font-medium hover:opacity-90"
            >
              Zaimportuj pierwszy materiał
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
            {recentMaterials.map((m) => {
              const itemCount = countByMaterial.get(m.id) ?? 0;
              return (
                <li key={m.id}>
                  <Link
                    href={`/materials/${m.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-elevated transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-serif text-[18px] tracking-[-0.005em] text-fg truncate">
                        {m.title}
                      </span>
                      <Chip variant="default">{labelForCategory(m.category)}</Chip>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted shrink-0">
                      {formatPl(itemCount)}{" "}
                      {plural(itemCount, "pytanie", "pytania", "pytań")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatTodayHeader(): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function formatPl(n: number): string {
  return new Intl.NumberFormat("pl-PL").format(n);
}

function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function labelForCategory(c: string): string {
  const map: Record<string, string> = {
    finanse: "Finanse",
    programowanie: "Programowanie",
    ai_ml: "AI / ML",
    soft_skills: "Soft skills",
    ogolne: "Ogólne",
  };
  return map[c] ?? c;
}

interface StreakStats {
  current: number;
  longest: number;
  thisMonth: number;
}

/**
 * Computes streak metrics from review timestamps (UTC dates).
 * - current: consecutive days ending today (today optional — starts from yesterday if today empty)
 * - longest: longest consecutive run in the 90-day window
 * - thisMonth: unique days with ≥1 review in the last 30 calendar days
 */
function computeStreakStats(rows: { created_at: string }[]): StreakStats {
  const daySet = new Set(rows.map((r) => r.created_at.slice(0, 10)));
  const today = new Date();

  let current = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      current++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  let longest = 0;
  let run = 0;
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  if (current > longest) longest = current;

  let thisMonth = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) thisMonth++;
  }

  return { current, longest, thisMonth };
}

interface HeatmapDay {
  date: string;
  count: number;
}

/** Returns the last `days` UTC days (oldest first) with review counts per day. */
function buildHeatmap(rows: { created_at: string }[], days: number): HeatmapDay[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = new Date();
  const result: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return result;
}

function heatmapClass(count: number): string {
  if (count === 0) return "bg-elevated border border-line";
  if (count === 1) return "bg-accent/30";
  if (count === 2) return "bg-accent/60";
  return "bg-accent";
}

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];

function nextMilestoneHint(current: number): string | null {
  if (current === 0) return null;
  const next = STREAK_MILESTONES.find((m) => m > current);
  if (!next) return `${formatPl(current)} dni z rzędu — nowy rekord każdego dnia.`;
  const delta = next - current;
  if (delta > 3) return `${plural(current, "dzień", "dni", "dni")} z rzędu.`;
  if (delta === 0) return `${formatPl(current)} dni — milestone osiągnięty.`;
  return `Jeszcze ${formatPl(delta)} ${plural(delta, "dzień", "dni", "dni")} do ${formatPl(next)}-dniowej serii.`;
}

function StreakMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1">
        {label}
      </div>
      <div className="font-mono text-[14px] text-fg">
        {value}
      </div>
    </div>
  );
}
