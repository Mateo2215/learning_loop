import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalibrationSection } from "./calibration-client";
import { ExportSection } from "./export-client";
import { CATEGORY_LABELS, type Category } from "@/lib/db/types";

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Ustawienia</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Konto: <span className="font-mono">{user.email}</span>
      </p>

      <div className="space-y-6">
        <CalibrationSection initialRows={rows} />
        <ExportSection />
      </div>
    </div>
  );
}
