import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    { data: monthCostRows },
  ] = await Promise.all([
    supabase.from("materials").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("items").select("id", { count: "exact", head: true }),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("type", "cloze")
      .eq("is_suspended", false)
      .lte("fsrs_due_date", nowIso),
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Tile value={dueCount ?? 0} label="due cards" emphasize={(dueCount ?? 0) > 0} />
        <Tile value={materialsCount ?? 0} label="materiałów" />
        <Tile value={itemsCount ?? 0} label="pytań i fiszek" />
        <Tile value={formatUsd(monthCost)} label="koszt miesiąca" mono />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/sessions/review">Zacznij Review →</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/sessions/deep-dive">Deep Dive</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/materials/import">+ Nowy materiał</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/materials">Materiały</Link>
        </Button>
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  emphasize = false,
  mono = false,
}: {
  value: number | string;
  label: string;
  emphasize?: boolean;
  mono?: boolean;
}) {
  return (
    <Card className={emphasize ? "border-emerald-500" : undefined}>
      <CardHeader>
        <CardTitle className={`text-2xl ${mono ? "font-mono" : ""}`}>{value}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
