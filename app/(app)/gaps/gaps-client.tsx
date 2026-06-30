"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GapSeverity, GapType, KnowledgeGap } from "@/lib/db/types";
import { EmptyState } from "@/components/shared/empty-state";
import { Tag } from "@/components/shared/tag";
import { StatusPill } from "@/components/shared/status-pill";

const GAP_TYPE_LABEL: Record<GapType, string> = {
  low_correct_rate: "Niski correct rate",
  stale_topic: "Zaniedbany temat",
  rising_failures: "Rosnące porażki",
  never_consolidated: "Brak utrwalenia",
  decayed_mastery: "Osłabione opanowanie",
};

const SEVERITY_BORDER: Record<GapSeverity, string> = {
  high: "border-l-[3px] border-l-bad",
  medium: "border-l-[3px] border-l-warn",
  low: "border-l-[3px] border-l-line",
};

const SEVERITY_LABEL: Record<GapSeverity, string> = {
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
};

const SEVERITY_VARIANT: Record<GapSeverity, "severity-high" | "severity-mid" | "severity-low"> = {
  high: "severity-high",
  medium: "severity-mid",
  low: "severity-low",
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
        <EmptyState
          title="Brak otwartych luk"
          description='Kliknij "Wykryj luki teraz", aby uruchomić analizę. Zwykle warto raz w tygodniu.'
        />
      ) : (
        <ul className="space-y-3">
          {gaps.map((g) => (
            <li
              key={g.id}
              className={`bg-surface border border-line rounded-lg pl-4 pr-5 py-4 ${SEVERITY_BORDER[g.severity]}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg font-medium leading-tight">
                    {g.title ?? GAP_TYPE_LABEL[g.gap_type]}
                  </h3>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    {GAP_TYPE_LABEL[g.gap_type]} · wykryto{" "}
                    {new Date(g.detected_at).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <StatusPill variant={SEVERITY_VARIANT[g.severity]}>
                  {SEVERITY_LABEL[g.severity]}
                </StatusPill>
              </div>
              {g.affected_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {g.affected_tags.map((t, i) => (
                    <Tag key={`${t}-${i}`}>{t}</Tag>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => dismissGap(g.id)}>
                  Odrzuć
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/gaps/${g.id}`}>Szczegóły →</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
