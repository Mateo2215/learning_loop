"use client";

import { Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

/**
 * Answer input for open-question sessions (deep-dive + audit).
 * Voice mode is a placeholder for M3 — UI hook only, no Web Speech API yet.
 */
export interface AnswerInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  mode?: "text" | "voice";
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onVoiceTranscript?: (text: string) => void;
}

export function AnswerInput({
  value,
  onChange,
  disabled,
  mode = "text",
  rows = 6,
  placeholder = "Wpisz swoją odpowiedź…",
  autoFocus,
}: AnswerInputProps) {
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="text-base p-4 resize-none"
      />
      {mode === "voice" && (
        <button
          type="button"
          disabled
          aria-label="Voice input — w przygotowaniu"
          title="Voice input — w przygotowaniu"
          className="absolute bottom-2 right-2 h-9 w-9 inline-flex items-center justify-center rounded-md text-zinc-400 bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed"
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
