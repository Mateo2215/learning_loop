"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GapSeverity, GapType, KnowledgeGap } from "@/lib/db/types";

const GAP_TYPE_LABEL: Record<GapType, string> = {
  low_correct_rate: "Niski correct rate",
  stale_topic: "Zaniedbany temat",
  rising_failures: "Rosnące porażki",
  never_consolidated: "Brak utrwalenia",
};

const SEVERITY_STYLE: Record<GapSeverity, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const SEVERITY_LABEL: Record<GapSeverity, string> = {
  high: "Wysoki priorytet",
  medium: "Średni priorytet",
  low: "Niski priorytet",
};

export function GapsClient({ initialGaps }: { initialGaps: KnowledgeGap[] }) {
  const router = useRouter();
  const [gaps, setGaps] = useState<KnowledgeGap[]>(initialGaps);
  const [detecting, setDetecting] = useState(false);

  async function runDetection() {
    setDetecting(true);
    try {
      const res = await fetch("/api/gaps/detect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Nie udało się wykryć luk", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      const inserted = (data.inserted as number) ?? 0;
      const skipped = (data.skippedDuplicate as number) ?? 0;
      if (inserted === 0 && skipped === 0) {
        toast.success("Brak nowych luk wiedzy 🎉");
      } else {
        toast.success(`Znaleziono ${inserted} nowych luk`, {
          description: skipped > 0 ? `(${skipped} pominięto jako duplikaty)` : undefined,
        });
      }
      router.refresh();
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setDetecting(false);
    }
  }

  async function dismissGap(id: string) {
    setGaps((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await fetch(`/api/gaps/${id}/dismiss`, { method: "POST" });
      if (!res.ok) {
        toast.error("Nie zapisano");
      }
    } catch {
      toast.error("Błąd sieci");
    }
  }

  return (
    <>
      <div className="mb-6">
        <Button onClick={runDetection} disabled={detecting}>
          {detecting ? "AI analizuje…" : "Wykryj luki teraz"}
        </Button>
      </div>

      {gaps.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brak otwartych luk</CardTitle>
            <CardDescription>
              Kliknij &ldquo;Wykryj luki teraz&rdquo; aby uruchomić analizę. Zwykle warto raz w tygodniu.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {gaps.map((g) => (
            <Card key={g.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {g.title ?? GAP_TYPE_LABEL[g.gap_type]}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {GAP_TYPE_LABEL[g.gap_type]} · wykryto{" "}
                      {new Date(g.detected_at).toLocaleDateString("pl-PL")}
                    </CardDescription>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${SEVERITY_STYLE[g.severity]}`}
                  >
                    {SEVERITY_LABEL[g.severity]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {g.affected_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.affected_tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => dismissGap(g.id)}>
                    Odrzuć
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
