/**
 * ScoreBadge — circular 1-10 score with color-coded ring and a short caption.
 * Used in Deep Dive feedback phase and in stats widgets.
 */

import { cn } from "@/lib/utils";

export type ScoreTier = "low" | "mid" | "good" | "great";

export function tierForScore(score: number): ScoreTier {
  if (score <= 3) return "low";
  if (score <= 6) return "mid";
  if (score <= 8) return "good";
  return "great";
}

const TIER_STYLES: Record<ScoreTier, { ring: string; text: string; bg: string }> = {
  low: { ring: "border-bad", text: "text-bad", bg: "bg-bad/10" },
  mid: { ring: "border-warn", text: "text-warn", bg: "bg-warn/10" },
  good: { ring: "border-ok/70", text: "text-ok", bg: "bg-ok/10" },
  great: { ring: "border-ok", text: "text-ok", bg: "bg-ok/15" },
};

const TIER_CAPTION: Record<ScoreTier, string> = {
  low: "Daleko od wzorca",
  mid: "Solidna baza, brakuje detali",
  good: "Blisko świetnej odpowiedzi",
  great: "Wzorcowo",
};

interface ScoreBadgeProps {
  score: number;
  /** Show the short caption under the score. */
  caption?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { circle: "h-10 w-10 text-[14px]", caption: "text-[11px]" },
  md: { circle: "h-14 w-14 text-[20px]", caption: "text-[12px]" },
  lg: { circle: "h-20 w-20 text-[28px]", caption: "text-[13px]" },
};

export function ScoreBadge({ score, caption = true, size = "md", className }: ScoreBadgeProps) {
  const tier = tierForScore(score);
  const styles = TIER_STYLES[tier];
  const sz = SIZES[size];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full border-2 flex items-center justify-center font-mono tabular-nums font-semibold",
          sz.circle,
          styles.ring,
          styles.text,
          styles.bg,
        )}
        aria-label={`Score ${score} z 10`}
      >
        {score}
        <span className="text-muted text-[0.5em] ml-0.5">/10</span>
      </div>
      {caption && <div className={cn("text-subtle text-center", sz.caption)}>{TIER_CAPTION[tier]}</div>}
    </div>
  );
}
