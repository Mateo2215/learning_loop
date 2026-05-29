"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EditableItem = {
  id: string;
  question: string;
  answerReference: string | null;
  type: "cloze" | "open";
};

export function ItemEditDialog({
  item,
  onClose,
}: {
  item: EditableItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return <ItemEditDialogContent key={item.id} item={item} onClose={onClose} />;
}

function ItemEditDialogContent({
  item,
  onClose,
}: {
  item: EditableItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answerReference ?? "");
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  const dirty =
    question.trim() !== item.question.trim() ||
    answer.trim() !== (item.answerReference ?? "").trim();

  const valid = question.trim().length >= 5 && answer.trim().length >= 1;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (question.trim() !== item.question.trim()) {
        body.question = question.trim();
      }
      if (answer.trim() !== (item.answerReference ?? "").trim()) {
        body.answer_reference = answer.trim();
      }
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Nie udało się zapisać");
      }
      toast.success("Zapisano");
      onClose();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nie udało się zapisać";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        className={cn(
          "relative bg-surface border border-line rounded-2xl p-6",
          "max-w-[640px] w-full shadow-2xl",
          "max-h-[90vh] overflow-y-auto",
        )}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-serif text-[22px] tracking-[-0.01em] text-fg">
              Edytuj {item.type === "cloze" ? "fiszkę" : "pytanie"}
            </h2>
            <p className="text-muted text-[12px] mt-1">
              Zmiany zapiszą się natychmiast.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-muted hover:text-fg transition-colors text-[13px] px-2 py-1"
            aria-label="Zamknij"
          >
            Esc
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="edit-question"
              className="block font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-2"
            >
              {item.type === "cloze" ? "Przód" : "Pytanie"}
            </label>
            <textarea
              id="edit-question"
              ref={firstFieldRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="bg-elevated border border-line rounded-lg p-3 text-[14px] font-sans w-full min-h-[120px] focus:outline-none focus:border-accent text-fg resize-y"
            />
          </div>
          <div>
            <label
              htmlFor="edit-answer"
              className="block font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-2"
            >
              {item.type === "cloze" ? "Tył" : "Odpowiedź referencyjna"}
            </label>
            <textarea
              id="edit-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="bg-elevated border border-line rounded-lg p-3 text-[14px] font-sans w-full min-h-[120px] focus:outline-none focus:border-accent text-fg resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-line text-[13px] font-medium text-fg hover:border-line-strong transition-colors disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !valid || !dirty}
            className="px-4 py-2 rounded-lg bg-accent text-accent-fg text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Zapisywanie…" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}
