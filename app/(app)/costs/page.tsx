import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COST_LIMITS } from "@/lib/ai/pricing";
import { SectionHeader } from "@/components/shared/section-header";
import { KPICard } from "@/components/shared/kpi-card";
import { cn } from "@/lib/utils";

interface UsageRow {
  operation_type: string;
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  created_at: string;
}

interface BreakdownRow {
  key: string;
  cost: number;
  count: number;
}

export default async function CostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: rows } = await supabase
    .from("usage_logs")
    .select(
      "operation_type, model, cost_usd, input_tokens, output_tokens, cached_input_tokens, created_at",
    )
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: false });

  const usage = (rows ?? []) as UsageRow[];

  const monthTotal = sumCost(usage);
  const todayUsage = usage.filter((r) => new Date(r.created_at) >= todayStart);
  const todayTotal = sumCost(todayUsage);

  const daysIntoMonth = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const projectedMonth = (monthTotal / daysIntoMonth) * daysInMonth;

  const byOperation = groupBy(usage, (r) => r.operation_type);
  const byModel = groupBy(usage, (r) => r.model);

  const softHit = monthTotal >= COST_LIMITS.monthlySoftUsd;
  const hardHit = monthTotal >= COST_LIMITS.monthlyHardUsd;

  const recent = usage.slice(0, 20);

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Koszty AI"
        sub={
          <>
            Monitoring wydatków na model API. Każde wywołanie logowane przez{" "}
            <code className="font-mono text-subtle">trackAICall</code>. Limity:{" "}
            <span className="font-mono">${COST_LIMITS.monthlySoftUsd}</span> ostrzeżenie /{" "}
            <span className="font-mono">${COST_LIMITS.monthlyHardUsd}</span> twardy /{" "}
            <span className="font-mono">${COST_LIMITS.perCallUsd}</span> per call.
          </>
        }
      />

      {hardHit && (
        <div className="mt-4 px-4 py-3 rounded-xl border border-bad bg-bad/10 text-[13px] text-bad">
          Twardy limit przekroczony. Operacje non-critical (kompresja, generowanie, audyty) są
          zablokowane do końca miesiąca. Walidacje aktywnych sesji nadal działają.
        </div>
      )}
      {softHit && !hardHit && (
        <div className="mt-4 px-4 py-3 rounded-xl border border-warn bg-warn/10 text-[13px] text-warn">
          Miękki limit przekroczony. Aplikacja działa normalnie, ale warto rzucić okiem na breakdown niżej.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <KPICard
          label="Dziś"
          number={<span className="font-mono">{formatUsd(todayTotal)}</span>}
          sub={`${todayUsage.length} wywołań`}
        />
        <KPICard
          label="Ten miesiąc"
          number={<span className="font-mono">{formatUsd(monthTotal)}</span>}
          sub={`${usage.length} wywołań`}
          className="border-accent/30"
        />
        <KPICard
          label="Projekcja"
          number={<span className="font-mono">{formatUsd(projectedMonth)}</span>}
          sub="na koniec miesiąca"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <BreakdownCard
          title="Per operacja"
          description="Suma kosztów według typu wywołania."
          rows={byOperation}
          barClass="bg-accent"
        />
        <BreakdownCard
          title="Per model"
          description="Haiku robi większość pracy, Sonnet tylko walidację."
          rows={byModel}
          barClass="bg-accent-2"
          renderKey={shortModel}
        />
      </div>

      <section className="bg-surface border border-line rounded-2xl p-6 mt-6">
        <h3 className="font-serif text-[18px] font-medium leading-none">Ostatnie wywołania</h3>
        <p className="mt-2 text-[12px] text-muted">
          {Math.min(20, recent.length)} najnowszych wpisów z{" "}
          <span className="font-mono text-subtle">usage_logs</span>.
        </p>

        {recent.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">Brak wpisów w tym miesiącu.</p>
        ) : (
          <div className="mt-4 overflow-x-auto -mx-2">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="py-2 px-2">Czas</th>
                  <th className="py-2 px-2">Operacja</th>
                  <th className="py-2 px-2">Model</th>
                  <th className="py-2 px-2 text-right">Tokens</th>
                  <th className="py-2 px-2 text-right">Koszt</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="py-2 px-2 font-mono text-[12px] text-muted">
                      {formatTime(r.created_at, todayStart)}
                    </td>
                    <td className="py-2 px-2 font-mono text-[12px] text-fg">{r.operation_type}</td>
                    <td className="py-2 px-2 font-mono text-[12px] text-subtle">
                      {shortModel(r.model)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[12px] text-subtle">
                      {r.input_tokens}
                      {r.cached_input_tokens > 0 && (
                        <span className="text-muted">
                          {" "}/ {r.cached_input_tokens}c
                        </span>
                      )}
                      {" / "}
                      {r.output_tokens}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[12px] text-accent">
                      {formatUsd(Number(r.cost_usd))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  barClass,
  renderKey,
}: {
  title: string;
  description: string;
  rows: BreakdownRow[];
  barClass: string;
  renderKey?: (key: string) => string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.cost), 0);

  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h3 className="font-serif text-[18px] font-medium leading-none">{title}</h3>
      <p className="mt-2 text-[12px] text-muted">{description}</p>

      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">Brak danych w tym miesiącu.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const pct = max > 0 ? (r.cost / max) * 100 : 0;
            return (
              <div
                key={r.key}
                className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-0"
              >
                <span className="font-mono text-[13px] text-subtle truncate min-w-0 max-w-[40%]">
                  {renderKey ? renderKey(r.key) : r.key}
                </span>
                <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all", barClass)}
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[13px] text-fg whitespace-nowrap">
                  {r.count}× · {formatUsd(r.cost)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function sumCost(rows: UsageRow[]): number {
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

function groupBy(rows: UsageRow[], keyFn: (r: UsageRow) => string): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
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

function formatTime(iso: string, todayStart: Date): string {
  const d = new Date(iso);
  if (d >= todayStart) {
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortModel(m: string): string {
  if (m.includes("haiku")) return "haiku-4-5";
  if (m.includes("sonnet")) return "sonnet-4-6";
  if (m.includes("voyage")) return "voyage-3";
  return m;
}
