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
    { count: openCount },
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
      .select("id", { count: "exact", head: true })
      .in("type", ["open", "feynman", "scenario"])
      .eq("is_suspended", false)
      .is("audit_id", null)
      .lte("fsrs_due_date", nowIso),
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

  const itemsTodayMinutes = Math.max(1, Math.round(((dueCount ?? 0) + (openCount ?? 0)) * 0.6));

  const streakDays = computeStreak(reviewDates ?? []);
  const streakSegments = Array.from({ length: 7 }, (_, i) => i < streakDays);

  // Items count per recent material — pobieramy w jednym zapytaniu.
  const recentIds = (recentMaterials ?? []).map((m) => m.id);
  let countByMaterial = new Map<string, number>();
  if (recentIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("material_id")
      .in("material_id", recentIds);
    for (const row of itemRows ?? []) {
      const id = (row as { material_id: string }).material_id;
      countByMaterial.set(id, (countByMaterial.get(id) ?? 0) + 1);
    }
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
          {(dueCount ?? 0) === 0 && (openCount ?? 0) === 0 ? (
            <p className="mt-2 text-subtle text-[14px]">
              Brak pytań do powtórki — możesz dodać nowy materiał lub zrobić Deep Dive.
            </p>
          ) : (
            <div className="mt-2 space-y-1">
              <p className="text-subtle text-[14px]">
                Fiszki: {formatPl(dueCount ?? 0)} · Pytania otwarte: {formatPl(openCount ?? 0)}
              </p>
              <p className="text-muted text-[13px]">
                Przewidywany czas: ~{itemsTodayMinutes} min
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

      {/* Streak */}
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
          Seria
        </div>
        <div className="flex items-end gap-6">
          <div className="font-serif text-[56px] leading-none tracking-[-0.015em] text-fg">
            {streakDays}
          </div>
          <div className="flex-1 grid grid-cols-7 gap-2 pb-2">
            {streakSegments.map((filled, i) => (
              <div
                key={i}
                className={`h-2 rounded-full ${
                  filled ? "bg-accent" : "bg-elevated border border-line"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {streakDays === 0
            ? "Zacznij pierwszą sesję dzisiaj."
            : `${plural(streakDays, "dzień", "dni", "dni")} z rzędu.`}
        </p>
      </section>

      {/* KPI: Do zrobienia dziś */}
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
          Do zrobienia dziś
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            label="Pytania dziś"
            number={formatPl((dueCount ?? 0) + (openCount ?? 0))}
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

/** Counts consecutive days (UTC) ending today on which the user had ≥1 review. */
function computeStreak(rows: { created_at: string }[]): number {
  const daySet = new Set(rows.map((r) => r.created_at.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak++;
    } else if (i === 0) {
      // No review today yet — check if yesterday starts a streak.
      continue;
    } else {
      break;
    }
  }
  return streak;
}
