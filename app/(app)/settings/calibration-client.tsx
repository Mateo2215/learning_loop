"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Category } from "@/lib/db/types";

interface Row {
  category: Category;
  category_label: string;
  too_strict_count: number;
  too_lenient_count: number;
  total_validations: number;
  current_offset: number;
}

function describeOffset(offset: number, total: number): { label: string; cls: string } {
  if (total < 3) return { label: "Mało danych", cls: "text-muted" };
  if (offset <= -0.2) return { label: "AI za surowe → łagodniej", cls: "text-warn" };
  if (offset >= 0.2) return { label: "AI za pobłażliwe → surowiej", cls: "text-bad" };
  return { label: "Skalibrowane", cls: "text-ok" };
}

export function CalibrationSection({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows] = useState<Row[]>(initialRows);
  const [recomputing, setRecomputing] = useState(false);

  async function recompute() {
    setRecomputing(true);
    try {
      const res = await fetch("/api/calibration/aggregate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Nie udało się przeliczyć", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("Offsety przeliczone");
      router.refresh();
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="font-serif text-[18px] font-medium leading-none">Kalibracja AI</h3>
          <p className="mt-2 text-[13px] text-muted leading-relaxed">
            Na podstawie Twoich kalibracji (
            <span className="font-mono text-bad">Za surowo</span>
            {" "}/{" "}
            <span className="font-mono text-ok">Trafnie</span>
            {" "}/{" "}
            <span className="font-mono text-warn">Za pobłażliwie</span>
            ) AI dostosowuje surowość ocen w każdej kategorii.
          </p>
        </div>
        <button
          type="button"
          onClick={recompute}
          disabled={recomputing}
          className="shrink-0 bg-elevated border border-line rounded-lg px-4 py-2 text-[12px] font-medium hover:border-line-strong disabled:opacity-50 transition-colors"
        >
          {recomputing ? "Przeliczam…" : "Przelicz teraz"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-3 rounded-lg bg-canvas border border-dashed border-line text-[12px] text-muted leading-relaxed">
          Brak danych kalibracyjnych. Po Deep Dive klikaj 3 przyciski (<span className="font-mono">Za surowo</span>, <span className="font-mono">Trafnie</span>, <span className="font-mono">Za pobłażliwie</span>), wtedy AI nauczy się Twoich preferencji.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                <th className="py-2 px-2">Kategoria</th>
                <th className="py-2 px-2 text-center">Surowo</th>
                <th className="py-2 px-2 text-center">Pobłażl.</th>
                <th className="py-2 px-2 text-center">N</th>
                <th className="py-2 px-2 text-right">Offset</th>
                <th className="py-2 px-2 text-right">Stan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const desc = describeOffset(r.current_offset, r.total_validations);
                return (
                  <tr key={r.category} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 px-2">{r.category_label}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[12px]">
                      {r.too_strict_count}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[12px]">
                      {r.too_lenient_count}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[12px] text-muted">
                      {r.total_validations}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[12px]">
                      {r.current_offset > 0 ? "+" : ""}
                      {r.current_offset.toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-2 text-right text-[11px] ${desc.cls}`}>
                      {desc.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
