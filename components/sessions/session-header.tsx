"use client";

import { Clock, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SessionHeaderProps {
  /** Current item index (1-based) — when undefined, the counter slot is hidden. */
  current?: number;
  /** Total number of items in the session. */
  total?: number;
  /** Optional title rendered next to the counter (e.g. material title in deep-dive). */
  title?: ReactNode;
  /** Elapsed time label, e.g. "03:42". When omitted the timer is hidden. */
  elapsedLabel?: string;
  /** Custom right slot — replaces the default timer if provided. */
  right?: ReactNode;
  /** Close action (X button on the left). */
  onClose: () => void;
  closeLabel?: string;
  className?: string;
}

/**
 * Sticky minimal header used in focus-mode session screens. Replaces the global
 * TopNav on /sessions/review and /sessions/deep-dive/[material_id].
 */
export function SessionHeader({
  current,
  total,
  title,
  elapsedLabel,
  right,
  onClose,
  closeLabel = "Zakończ sesję",
  className,
}: SessionHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 border-b border-line bg-canvas/85 backdrop-blur",
        "flex items-center justify-between px-4 sm:px-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className="text-muted hover:text-fg transition-colors p-1 -ml-1 rounded-md"
        >
          <X size={18} />
        </button>
        {title && (
          <>
            <span className="h-5 w-px bg-line" aria-hidden />
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-muted truncate max-w-[40vw]">
              {title}
            </span>
          </>
        )}
      </div>

      {typeof current === "number" && typeof total === "number" && (
        <div className="absolute left-1/2 -translate-x-1/2 font-mono text-[12px] uppercase tracking-[0.15em] text-muted">
          {current}/{total}
        </div>
      )}

      <div className="flex items-center gap-3">
        {right ?? (
          elapsedLabel && (
            <div className="flex items-center gap-1.5 font-mono text-[13px] text-muted">
              <Clock size={14} />
              <span>{elapsedLabel}</span>
            </div>
          )
        )}
      </div>
    </header>
  );
}
