import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SessionShellProps {
  /** Optional progress bar (cienki pasek u góry viewportu). 0–100. */
  progress?: number;
  /** Top-of-screen meta strip (np. "3 / 10", leech kropka). */
  meta?: ReactNode;
  /** Hero content (pytanie, odpowiedź — wycentrowane wertykalnie). */
  children: ReactNode;
  /** Sticky bottom action area (rating buttons / submit / next). */
  bottom?: ReactNode;
  /** Bottom helper line (keyboard shortcuts, hint). */
  hint?: ReactNode;
  className?: string;
}

/**
 * Standardowy shell sesji: full viewport, max-w-3xl, safe-area-aware bottom
 * padding, miejsce na progress bar u góry, hero content w pionowym centrum,
 * sticky strefa akcji na dole. Wszystkie 3 sesje (review, deep-dive, audit)
 * korzystają z tego samego shellu.
 */
export function SessionShell({
  progress,
  meta,
  children,
  bottom,
  hint,
  className,
}: SessionShellProps) {
  return (
    <div className={cn("min-h-[100dvh] flex flex-col bg-canvas", className)}>
      {typeof progress === "number" && (
        <div className="h-0.5 w-full bg-line">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {meta && (
          <div className="flex items-center justify-between text-xs text-muted mb-4">
            {meta}
          </div>
        )}

        <div className="flex-1 flex flex-col items-stretch justify-center">
          {children}
        </div>

        {bottom && (
          <div className="mt-6 sticky bottom-0 pt-3 bg-canvas">
            {bottom}
          </div>
        )}

        {hint && (
          <p className="mt-3 text-center text-[11px] text-muted/80">{hint}</p>
        )}
      </div>
    </div>
  );
}
