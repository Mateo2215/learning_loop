import { cn } from "@/lib/utils";

export interface MasterySegments {
  mature: number;
  young: number;
  learning: number;
  new?: number;
}

export interface MasteryBarProps {
  segments: MasterySegments;
  total?: number;
  showLegend?: boolean;
  className?: string;
}

const LEGEND_LABEL: Record<keyof MasterySegments, string> = {
  mature: "Mature",
  young: "Young",
  learning: "Learning",
  new: "New",
};

const SEGMENT_COLOR: Record<keyof MasterySegments, string> = {
  mature: "bg-ok",
  young: "bg-accent",
  learning: "bg-warn",
  new: "bg-muted/50",
};

const DOT_COLOR: Record<keyof MasterySegments, string> = {
  mature: "bg-ok",
  young: "bg-accent",
  learning: "bg-warn",
  new: "bg-muted/50",
};

export function MasteryBar({
  segments,
  total,
  showLegend = false,
  className,
}: MasteryBarProps) {
  const hasNew = typeof segments.new === "number";
  const keys: (keyof MasterySegments)[] = hasNew
    ? ["mature", "young", "learning", "new"]
    : ["mature", "young", "learning"];

  const sum =
    total ??
    segments.mature + segments.young + segments.learning + (segments.new ?? 0);
  const safeSum = sum > 0 ? sum : 1;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-elevated">
        {keys.map((k) => {
          const value = (segments[k] ?? 0) as number;
          const pct = (value / safeSum) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={k}
              className={cn("h-full", SEGMENT_COLOR[k])}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
          {keys.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", DOT_COLOR[k])} />
              <span>
                {LEGEND_LABEL[k]} {(segments[k] ?? 0) as number}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
