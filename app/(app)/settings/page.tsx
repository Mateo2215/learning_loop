import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalibrationSection } from "./calibration-client";
import { ExportSection } from "./export-client";
import { ThemeSection } from "./theme-section";
import { DangerZone } from "./danger-zone";
import { CATEGORY_LABELS, type Category } from "@/lib/db/types";
import { SectionHeader } from "@/components/shared/section-header";
import { getMonthlyUsage } from "@/lib/ai/limits";
import { COST_LIMITS } from "@/lib/ai/pricing";

interface OffsetRow {
  category: Category;
  too_strict_count: number;
  too_lenient_count: number;
  total_validations: number;
  current_offset: number | string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: offsets } = await supabase
    .from("calibration_offsets")
    .select("category, too_strict_count, too_lenient_count, total_validations, current_offset")
    .eq("user_id", user.id);

  const rows = ((offsets ?? []) as OffsetRow[]).map((r) => ({
    ...r,
    current_offset: Number(r.current_offset),
    category_label: CATEGORY_LABELS[r.category],
  }));

  let monthlyUsd = 0;
  try {
    monthlyUsd = await getMonthlyUsage(supabase, user.id);
  } catch {
    monthlyUsd = 0;
  }
  const softPct = Math.min(100, (monthlyUsd / COST_LIMITS.monthlySoftUsd) * 100);

  return (
    <div className="max-w-[720px] mx-auto px-6 py-10">
      <SectionHeader
        title="Ustawienia"
        sub={
          <>
            Konto: <span className="font-mono text-subtle">{user.email}</span>
          </>
        }
      />

      <div className="space-y-4 mt-6">
        <ThemeSection />
        <CalibrationSection initialRows={rows} />

        <section className="bg-surface border border-line rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-serif text-[18px] font-medium leading-none">Koszty</h3>
              <p className="mt-2 text-[13px] text-muted leading-relaxed">
                <span className="font-mono text-subtle">{formatUsd(monthlyUsd)}</span>
                {" "}/{" "}
                <span className="font-mono">{formatUsd(COST_LIMITS.monthlySoftUsd)}</span>
                {" "}miękki limit miesięczny ·{" "}
                <span className="font-mono">{formatUsd(COST_LIMITS.monthlyHardUsd)}</span>
                {" "}twardy
              </p>
            </div>
            <Link
              href="/costs"
              className="text-[13px] font-medium text-accent hover:opacity-80 whitespace-nowrap"
            >
              Szczegóły →
            </Link>
          </div>
          <div className="relative h-3 w-full bg-elevated rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-all"
              style={{ width: `${softPct.toFixed(1)}%` }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 w-px bg-warn/60"
              style={{ left: "100%" }}
              title="Soft limit"
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-muted">
            <span>$0</span>
            <span className="text-warn">soft ${COST_LIMITS.monthlySoftUsd}</span>
            <span className="text-bad">hard ${COST_LIMITS.monthlyHardUsd}</span>
          </div>
        </section>

        <ExportSection />

        <DangerZone />
      </div>
    </div>
  );
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
