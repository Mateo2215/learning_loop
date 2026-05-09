import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type KPITrend = "up" | "down";

export interface KPICardProps {
  label: ReactNode;
  number: ReactNode;
  sub?: ReactNode;
  trend?: KPITrend;
  trendValue?: ReactNode;
  className?: string;
}

export function KPICard({
  label,
  number,
  sub,
  trend,
  trendValue,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-5",
        className,
      )}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
        {label}
      </div>
      <div className="mt-3 font-serif text-[44px] leading-none tracking-tight text-fg">
        {number}
      </div>
      {sub && <div className="mt-2 text-[13px] text-subtle">{sub}</div>}
      {trend && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-[12px] font-medium",
            trend === "up" ? "text-ok" : "text-bad",
          )}
        >
          {trend === "up" ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {trendValue}
        </div>
      )}
    </div>
  );
}
