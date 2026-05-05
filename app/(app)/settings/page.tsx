import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalibrationSection } from "./calibration-client";
import { ExportSection } from "./export-client";
import { ThemeSection } from "./theme-section";
import { CATEGORY_LABELS, type Category } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/page-header";
import { getMonthlyUsage } from "@/lib/ai/limits";
import { COST_LIMITS } from "@/lib/ai/pricing";
import { SectionCard } from "@/components/shared/section-card";

interface OffsetRow {
  category: Category;
  too_strict_count: number;
  too_lenient_count: number;
  total_validations: number;
  current_offset: number | string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader
        title="Ustawienia"
        description={
          <>
            Konto: <span className="font-mono">{user.email}</span>
          </>
        }
      />

      <div className="space-y-6">
        <ThemeSection />
        <CalibrationSection initialRows={rows} />

        <SectionCard
          title="Koszty"
          description={`${formatUsd(monthlyUsd)} / ${formatUsd(COST_LIMITS.monthlySoftUsd)} miękki limit miesięczny`}
          action={
            <Link
              href="/settings/costs"
              className="text-sm text-accent hover:underline"
            >
              Szczegóły →
            </Link>
          }
        >
          <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${softPct.toFixed(1)}%` }}
            />
          </div>
        </SectionCard>

        <ExportSection />
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
