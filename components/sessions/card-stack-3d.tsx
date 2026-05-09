"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardStack3DProps {
  /** Front-of-card content (the question, possibly with cloze blanks). */
  frontText: ReactNode;
  /** Back content shown after reveal. Optional. */
  backText?: ReactNode;
  isRevealed: boolean;
  /** Click handler for tapping the unrevealed card. */
  onReveal?: () => void;
  /** Number of remaining items behind this one (0..N). Drives the visual stack depth. */
  behindCount?: number;
  /** Optional top-of-card meta row (chips, source ref). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Faux-3D card stack: the active card with up to two blurred siblings layered behind.
 * Reveal flips the lower portion of the card to show the back content beneath the question.
 */
export function CardStack3D({
  frontText,
  backText,
  isRevealed,
  onReveal,
  behindCount = 0,
  meta,
  className,
}: CardStack3DProps) {
  const showLayer1 = behindCount >= 1;
  const showLayer2 = behindCount >= 2;

  return (
    <div className={cn("relative w-full max-w-[640px]", className)}>
      {showLayer2 && (
        <div
          aria-hidden
          className="absolute inset-0 translate-y-4 scale-[0.94] rounded-2xl bg-surface border border-line opacity-30 blur-[2px]"
        />
      )}
      {showLayer1 && (
        <div
          aria-hidden
          className="absolute inset-0 translate-y-2 scale-[0.97] rounded-2xl bg-surface border border-line opacity-60 blur-[1px]"
        />
      )}

      <div
        role={onReveal && !isRevealed ? "button" : undefined}
        tabIndex={onReveal && !isRevealed ? 0 : -1}
        onClick={onReveal && !isRevealed ? onReveal : undefined}
        onKeyDown={(e) => {
          if (!onReveal || isRevealed) return;
          if (e.key === "Enter") {
            e.preventDefault();
            onReveal();
          }
        }}
        className={cn(
          "relative w-full bg-surface border border-line rounded-2xl px-8 py-10 sm:px-10 min-h-[280px]",
          "flex flex-col gap-5 shadow-lg transition-colors",
          onReveal && !isRevealed && "cursor-pointer hover:border-line-strong",
        )}
      >
        {meta && <div className="flex items-center justify-between gap-2">{meta}</div>}

        <div className="flex-1 flex items-center justify-center text-center">
          <div className="font-serif text-[24px] sm:text-[28px] tracking-[-0.015em] leading-snug whitespace-pre-wrap">
            {frontText}
          </div>
        </div>

        {isRevealed && backText && (
          <div className="border-t border-line pt-4 font-sans text-[15px] leading-relaxed text-subtle">
            {backText}
          </div>
        )}
      </div>
    </div>
  );
}
