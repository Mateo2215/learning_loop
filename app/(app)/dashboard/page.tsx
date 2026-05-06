import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
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
            Dziś
          </h1>
        </header>

        <FreshMaterials />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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

        <p className="text-xs text-muted font-mono">
          {materialsCount ?? 0} materiałów · {itemsCount ?? 0} pytań · {formatUsd(monthCost)} koszt miesiąca
        </p>

        <div className="mt-8 hidden md:flex gap-3">
          <Button asChild>
            <Link href="/materials/import">+ Nowy materiał</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sessions/deep-dive">Deep Dive</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/materials">Materiały</Link>
          </Button>
        </div>
      </div>

      {/* Mobile FAB — primary action: nowy materiał. */}
      <Link
        href="/materials/import"
        className="md:hidden fixed bottom-20 right-4 z-30 inline-flex items-center justify-center h-14 w-14 rounded-full bg-accent text-accent-fg shadow-lg hover:bg-accent/90 transition-colors"
        aria-label="Nowy materiał"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
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
