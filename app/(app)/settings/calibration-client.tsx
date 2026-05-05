"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kalibracja AI</CardTitle>
        <CardDescription>
          Na podstawie Twoich kalibracji (Za surowo / Trafnie / Za pobłażliwie) AI dostosowuje surowość ocen w każdej kategorii.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={recompute} disabled={recomputing}>
            {recomputing ? "Przeliczam…" : "Przelicz teraz"}
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Brak danych kalibracyjnych. Po Deep Dive klikaj 3 przyciski (Za surowo / Trafnie / Za pobłażliwie), wtedy AI nauczy się Twoich preferencji.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2">Kategoria</th>
                  <th className="py-2 text-center">Za surowo</th>
                  <th className="py-2 text-center">Za pobłażliwie</th>
                  <th className="py-2 text-center">Łącznie</th>
                  <th className="py-2 text-right">Offset</th>
                  <th className="py-2 text-right">Stan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const desc = describeOffset(r.current_offset, r.total_validations);
                  return (
                    <tr key={r.category} className="border-b border-line/60">
                      <td className="py-2">{r.category_label}</td>
                      <td className="py-2 text-center font-mono">{r.too_strict_count}</td>
                      <td className="py-2 text-center font-mono">{r.too_lenient_count}</td>
                      <td className="py-2 text-center font-mono">{r.total_validations}</td>
                      <td className="py-2 text-right font-mono">
                        {r.current_offset > 0 ? "+" : ""}
                        {r.current_offset.toFixed(2)}
                      </td>
                      <td className={`py-2 text-right text-xs ${desc.cls}`}>{desc.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
