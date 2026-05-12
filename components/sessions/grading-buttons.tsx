"use client";

import { useEffect } from "react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export type GradingRating = 1 | 2 | 3 | 4;

export interface GradingButtonsProps {
  onRate: (rating: GradingRating) => void;
  /** Optional next-interval labels per rating (FSRS preview). */
  intervals?: Partial<Record<GradingRating, string>>;
  /** When true, keyboard handlers (1/2/3/4) are bound to window. */
  enableKeyboard?: boolean;
  disabled?: boolean;
  className?: string;
}

interface Spec {
  rating: GradingRating;
  label: string;
  tone: "bad" | "warn" | "ok" | "accent-2";
  fallbackInterval: string;
}

const SPECS: Spec[] = [
  { rating: 1, label: "Nie pamiętam", tone: "bad", fallbackInterval: "1 min" },
  { rating: 2, label: "Z trudem", tone: "warn", fallbackInterval: "6 min" },
  { rating: 3, label: "Pamiętam", tone: "ok", fallbackInterval: "10 min" },
  { rating: 4, label: "Znam dobrze", tone: "accent-2", fallbackInterval: "8 d" },
];

const TONE_CLASSES: Record<Spec["tone"], string> = {
  bad: "text-bad hover:bg-bad/10 hover:border-bad/60",
  warn: "text-warn hover:bg-warn/10 hover:border-warn/60",
  ok: "text-ok hover:bg-ok/10 hover:border-ok/60",
  "accent-2": "text-accent-2 hover:bg-accent-2-soft hover:border-accent-2/60",
};

export function GradingButtons({
  onRate,
  intervals,
  enableKeyboard = true,
  disabled,
  className,
}: GradingButtonsProps) {
  useEffect(() => {
    if (!enableKeyboard || disabled) return;
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in inputs.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "1") onRate(1);
      else if (e.key === "2") onRate(2);
      else if (e.key === "3") onRate(3);
      else if (e.key === "4") onRate(4);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRate, enableKeyboard, disabled]);

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[640px]", className)}>
      {SPECS.map((s) => {
        const interval = intervals?.[s.rating] ?? s.fallbackInterval;
        return (
          <button
            key={s.rating}
            type="button"
            disabled={disabled}
            onClick={() => onRate(s.rating)}
            className={cn(
              "border border-line bg-surface rounded-xl p-4 flex flex-col items-start gap-1.5 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              TONE_CLASSES[s.tone],
            )}
          >
            <Kbd>{s.rating}</Kbd>
            <span className="font-medium text-[14px]">{s.label}</span>
            <span className="font-mono text-[11px] text-muted">{interval}</span>
          </button>
        );
      })}
    </div>
  );
}
