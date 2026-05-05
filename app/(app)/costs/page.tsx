import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COST_LIMITS } from "@/lib/ai/pricing";

interface UsageRow {
  operation_type: string;
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  created_at: string;
}

export default async function CostsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: rows } = await supabase
    .from("usage_logs")
    .select("operation_type, model, cost_usd, input_tokens, output_tokens, cached_input_tokens, created_at")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: false });

  const usage = (rows ?? []) as UsageRow[];

  const monthTotal = sumCost(usage);
  const todayTotal = sumCost(usage.filter((r) => new Date(r.created_at) >= todayStart));

  // Daily run-rate projection: scale today's cost up to 30 days, OR scale month-to-date
  // by remaining days, whichever is higher (defensive against early-month surges).
  const daysIntoMonth = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const projectedMonth = (monthTotal / daysIntoMonth) * daysInMonth;

  const byOperation = groupBy(usage, (r) => r.operation_type);
  const byModel = groupBy(usage, (r) => r.model);

  const softHit = monthTotal >= COST_LIMITS.monthlySoftUsd;
  const hardHit = monthTotal >= COST_LIMITS.monthlyHardUsd;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Koszty</h1>
      <p className="text-sm text-muted mb-6">
        Każde wywołanie AI logowane przez <code className="font-mono text-xs">trackAICall</code>. Limity:{" "}
        <span className="font-mono">${COST_LIMITS.monthlySoftUsd}</span> ostrzeżenie /{" "}
        <span className="font-mono">${COST_LIMITS.monthlyHardUsd}</span> twardy / {" "}
        <span className="font-mono">${COST_LIMITS.perCallUsd}</span> per call.
      </p>

      {hardHit && (
        <div className="mb-6 p-4 rounded-lg border border-bad bg-bad/10 text-sm text-bad">
          Twardy limit przekroczony. Operacje non-critical (kompresja, generowanie, audyty) są zablokowane do końca miesiąca.
          Walidacje aktywnych sesji nadal działają.
        </div>
      )}
      {softHit && !hardHit && (
        <div className="mb-6 p-4 rounded-lg border border-warn bg-warn/10 text-sm text-warn">
          Miękki limit przekroczony. Aplikacja działa normalnie, ale warto rzucić okiem na breakdown niżej.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <CostTile label="Dziś" value={formatUsd(todayTotal)} />
        <CostTile label="Ten miesiąc" value={formatUsd(monthTotal)} sub={`${usage.length} wywołań`} />
        <CostTile label="Projekcja" value={formatUsd(projectedMonth)} sub="na koniec miesiąca" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per operacja</CardTitle>
            <CardDescription>Suma kosztów według typu wywołania.</CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={byOperation} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per model</CardTitle>
            <CardDescription>Haiku robi większość pracy, Sonnet tylko walidację.</CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={byModel} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Ostatnie wywołania</CardTitle>
          <CardDescription>10 najnowszych wpisów z usage_logs.</CardDescription>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted">Brak wpisów w tym miesiącu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-line">
                  <tr className="text-left text-muted">
                    <th className="py-2 pr-2">Czas</th>
                    <th className="py-2 pr-2">Operacja</th>
                    <th className="py-2 pr-2">Model</th>
                    <th className="py-2 pr-2 text-right">Tokeny in</th>
                    <th className="py-2 pr-2 text-right">cache</th>
                    <th className="py-2 pr-2 text-right">out</th>
                    <th className="py-2 text-right">$</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-1.5 pr-2 text-muted font-mono">{formatTime(r.created_at)}</td>
                      <td className="py-1.5 pr-2 font-mono">{r.operation_type}</td>
                      <td className="py-1.5 pr-2 text-muted">{shortModel(r.model)}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{r.input_tokens}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-muted">{r.cached_input_tokens || "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-mono">{r.output_tokens}</td>
                      <td className="py-1.5 text-right font-mono">{formatUsd(Number(r.cost_usd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CostTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-mono">{value}</CardTitle>
        {sub && <CardDescription className="text-xs">{sub}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

function BreakdownTable({ rows }: { rows: { key: string; cost: number; count: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Brak danych.</p>;
  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? (r.cost / total) * 100 : 0;
        return (
          <div key={r.key} className="text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-mono text-xs truncate">{r.key}</span>
              <span className="font-mono text-xs text-muted">
                {r.count}× — {formatUsd(r.cost)}
              </span>
            </div>
            <div className="mt-1 h-1 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-fg"
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function sumCost(rows: UsageRow[]): number {
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

function groupBy(rows: UsageRow[], keyFn: (r: UsageRow) => string) {
  const map = new Map<string, { key: string; cost: number; count: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const cur = map.get(k) ?? { key: k, cost: 0, count: 0 };
    cur.cost += Number(r.cost_usd);
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function shortModel(m: string): string {
  if (m.includes("haiku")) return "haiku-4-5";
  if (m.includes("sonnet")) return "sonnet-4-6";
  if (m.includes("voyage")) return "voyage-3";
  return m;
}
