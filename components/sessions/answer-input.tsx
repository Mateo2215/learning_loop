"use client";

import { Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Answer input for open-question sessions (deep-dive + audit).
 * Voice mode is a placeholder for M3 — UI hook only, no Web Speech API yet.
 */
export interface AnswerInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** When "voice" is set the mic button is rendered (still placeholder action). */
  mode?: "text" | "voice";
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onVoiceTranscript?: (text: string) => void;
  onSubmitShortcut?: () => void;
  className?: string;
}

export function AnswerInput({
  value,
  onChange,
  disabled,
  mode = "text",
  rows = 8,
  placeholder = "Wpisz swoją odpowiedź…",
  autoFocus,
  onSubmitShortcut,
  className,
}: AnswerInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (!onSubmitShortcut) return;
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmitShortcut();
          }
        }}
        className={cn(
          "bg-surface border border-line rounded-2xl p-5 pr-14 w-full min-h-[240px]",
          "font-sans text-[15px] leading-relaxed resize-none",
          "focus:outline-none focus:border-accent transition-colors",
        )}
      />
      {mode === "voice" && (
        <button
          type="button"
          disabled
          aria-label="Voice input — w przygotowaniu"
          title="Voice input — w przygotowaniu"
          className={cn(
            "absolute bottom-4 right-4 w-9 h-9 rounded-full bg-elevated border border-line",
            "inline-flex items-center justify-center text-muted hover:text-fg",
            "cursor-not-allowed opacity-80",
          )}
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}
