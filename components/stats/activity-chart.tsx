"use client";

import { cn } from "@/lib/utils";

export interface ActivityChartDatum {
  week: string;
  correct: number;
  total: number;
}

export interface ActivityChartProps {
  data: ActivityChartDatum[];
  className?: string;
}

export function ActivityChart({ data, className }: ActivityChartProps) {
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className={cn("flex items-end gap-2 h-40", className)}>
      {data.map((d, i) => {
        const totalH = (d.total / max) * 100;
        const correctH = d.total > 0 ? (d.correct / d.total) * 100 : 0;
        const isCurrent = i === data.length - 1;
        return (
          <div
            key={`${d.week}-${i}`}
            className="flex-1 flex flex-col items-center gap-1.5 h-full"
            title={`${d.correct} poprawnych / ${d.total} łącznie`}
          >
            <div className="w-full flex-1 flex items-end min-h-px">
              <div
                className={cn(
                  "w-full relative overflow-hidden rounded",
                  d.total > 0 ? "bg-elevated" : "bg-line",
                  isCurrent && "ring-1 ring-accent",
                )}
                style={{
                  height: d.total > 0 ? `${Math.max(totalH, 4)}%` : "2px",
                }}
              >
                {d.total > 0 && (
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0",
                      isCurrent ? "bg-accent" : "bg-ok",
                    )}
                    style={{ height: `${correctH}%` }}
                  />
                )}
              </div>
            </div>
            <span
              className={cn(
                "font-mono text-[11px]",
                isCurrent ? "text-accent" : "text-muted",
              )}
            >
              {d.week}
            </span>
          </div>
        );
      })}
    </div>
  );
}
