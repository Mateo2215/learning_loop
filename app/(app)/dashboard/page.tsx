import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, BookOpen, Search, Settings, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FreshMaterials } from "@/components/dashboard/fresh-materials";
import { StatTile } from "@/components/shared/stat-tile";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    { count: materialsCount },
    { count: itemsCount },
    { count: dueCount },
    { count: auditsDueCount },
    { count: openGapsCount },
    { data: monthCostRows },
  ] = await Promise.all([
    supabase.from("materials").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("items").select("id", { count: "exact", head: true }),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("type", "cloze")
      .eq("is_suspended", false)
      .is("audit_id", null)
      .lte("fsrs_due_date", nowIso),
    supabase
      .from("topic_audits")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("scheduled_for", nowIso),
    supabase
      .from("knowledge_gaps")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("usage_logs")
      .select("cost_usd")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const monthCost = (monthCostRows ?? []).reduce(
    (s, r) => s + Number((r as { cost_usd: number | string }).cost_usd ?? 0),
    0
  );

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-muted font-mono mb-2">
            {formatTodayHeader()}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-medium leading-[1.05] tracking-tight">
            Przegląd
          </h1>
        </header>

        <FreshMaterials />

        {/* Hero CTA + secondary actions */}
        <section className="mb-10">
          <Link
            href="/materials/import"
            className="group block rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:p-7 transition-all duration-200 hover:border-accent hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/10 dark:from-accent-soft/60 dark:hover:shadow-accent/20"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-[11px] uppercase tracking-[0.15em] text-accent font-mono font-medium">
                    Główna akcja
                  </span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-medium leading-tight tracking-tight mb-1">
                  Nowy materiał
                </h2>
                <p className="text-sm text-subtle">
                  Wrzuć podcast, notatkę lub PDF — AI wygeneruje pytania i fiszki.
                </p>
              </div>
              <div className="shrink-0 inline-flex items-center justify-center h-14 w-14 rounded-full bg-accent text-accent-fg shadow-md shadow-accent/20 transition-transform group-hover:scale-105">
                <Plus className="h-7 w-7" strokeWidth={2.25} />
              </div>
            </div>
          </Link>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SecondaryAction href="/sessions/deep-dive" icon={ArrowRight} label="Deep Dive" />
            <SecondaryAction href="/materials" icon={BookOpen} label="Materiały" />
            <SecondaryAction href="/search" icon={Search} label="Wyszukaj" />
            <SecondaryAction href="/settings" icon={Settings} label="Ustawienia" />
          </div>
        </section>

        {/* Action stat tiles */}
        <section className="mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted font-mono mb-3">
            Do zrobienia dziś
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              value={dueCount ?? 0}
              label="fiszek do powtórki"
              emphasize={(dueCount ?? 0) > 0}
              href="/sessions/review"
            />
            <StatTile
              value={auditsDueCount ?? 0}
              label="audytów na dziś"
              emphasize={(auditsDueCount ?? 0) > 0}
              href="/sessions/audit"
            />
            <StatTile
              value={openGapsCount ?? 0}
              label="otwartych luk"
              emphasize={(openGapsCount ?? 0) > 0}
              href="/gaps"
            />
          </div>
        </section>

        {/* Snapshot — prettier than the previous mono one-liner */}
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted font-mono mb-3">
            Twoja biblioteka
          </h2>
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm shadow-black/[0.02] dark:shadow-black/20">
            <SnapshotMetric value={materialsCount ?? 0} label="materiałów" />
            <SnapshotMetric value={itemsCount ?? 0} label="pytań i fiszek" />
            <SnapshotMetric
              value={formatUsd(monthCost)}
              label="koszt miesiąca"
              mono
              link="/stats"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Pełne statystyki postępów →{" "}
            <Link href="/stats" className="text-accent hover:underline">
              Statystyki
            </Link>
          </p>
        </section>
      </div>

      {/* Mobile FAB — primary action: nowy materiał. */}
      <Link
        href="/materials/import"
        className="md:hidden fixed bottom-20 right-4 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-accent text-accent-fg shadow-lg hover:brightness-110 transition-all"
        aria-label="Nowy materiał"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}

function SecondaryAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto py-3 justify-start gap-2 hover:border-accent/50 hover:bg-elevated transition-all"
    >
      <Link href={href}>
        <Icon className="h-4 w-4 text-muted" />
        <span className="text-sm">{label}</span>
      </Link>
    </Button>
  );
}

function SnapshotMetric({
  value,
  label,
  mono = false,
  link,
}: {
  value: string | number;
  label: string;
  mono?: boolean;
  link?: string;
}) {
  const inner = (
    <>
      <div
        className={`text-2xl sm:text-3xl font-medium leading-none ${
          mono ? "font-mono" : "font-serif"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </>
  );
  if (link) {
    return (
      <Link href={link} className="block hover:text-accent transition-colors">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function formatTodayHeader(): string {
  return new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
