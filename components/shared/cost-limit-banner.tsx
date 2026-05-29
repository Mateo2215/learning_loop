import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyUsage } from "@/lib/ai/limits";
import { COST_LIMITS } from "@/lib/ai/pricing";

/**
 * Globalny banner kosztów. Renderowany w (app)/layout.tsx, pokazuje się tylko
 * gdy użytkownik przekroczył soft lub hard limit. Server component — czyta
 * stan przy każdej nawigacji.
 */
export async function CostLimitBanner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let monthlyUsd = 0;
  try {
    monthlyUsd = await getMonthlyUsage(supabase, user.id);
  } catch {
    return null;
  }

  const hardHit = monthlyUsd >= COST_LIMITS.monthlyHardUsd;
  const softHit = monthlyUsd >= COST_LIMITS.monthlySoftUsd;
  if (!softHit) return null;

  const toneClass = hardHit
    ? "border-bad/40 bg-bad/10 text-bad"
    : "border-warn/40 bg-warn/10 text-warn";
  const linkClass = hardHit ? "text-bad" : "text-warn";

  return (
    <div
      role="alert"
      className={`border-b ${toneClass} px-4 py-2 text-xs flex items-center justify-between gap-3`}
    >
      <span className="truncate">
        {hardHit
          ? `Twardy limit przekroczony — ${formatUsd(monthlyUsd)} / ${formatUsd(COST_LIMITS.monthlyHardUsd)} miesięcznie. Operacje non-critical zablokowane.`
          : `Miękki limit przekroczony — ${formatUsd(monthlyUsd)} / ${formatUsd(COST_LIMITS.monthlySoftUsd)} miesięcznie.`}
      </span>
      <Link
        href="/settings/costs"
        className={`shrink-0 underline underline-offset-2 hover:no-underline ${linkClass}`}
      >
        Zobacz koszty →
      </Link>
    </div>
  );
}

function formatUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
