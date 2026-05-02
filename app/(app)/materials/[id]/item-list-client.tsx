"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface EditableItem {
  id: string;
  type: "cloze" | "open" | "feynman" | "scenario";
  question: string;
  answer_reference: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  edit_count: number;
}

export function ItemListClient({
  items,
  emptyLabel,
  showReferenceLabel,
}: {
  items: EditableItem[];
  emptyLabel: string;
  showReferenceLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} showReferenceLabel={showReferenceLabel} />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  showReferenceLabel,
}: {
  item: EditableItem;
  showReferenceLabel?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [question, setQuestion] = useState(item.question);
  const [reference, setReference] = useState(item.answer_reference ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (question.trim().length < 5) {
      toast.error("Pytanie za krótkie");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer_reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Nie zapisano", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success("Zapisano");
      setMode("view");
      router.refresh();
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setQuestion(item.question);
    setReference(item.answer_reference ?? "");
    setMode("view");
  }

  if (mode === "edit") {
    return (
      <li className="text-sm border-l-2 border-amber-500 pl-3 space-y-2">
        <Textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pytanie"
          disabled={saving}
        />
        <Textarea
          rows={3}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Wzorcowa odpowiedź (opcjonalnie)"
          disabled={saving}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz"}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
            Anuluj
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="text-sm border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-zinc-900 dark:text-zinc-100">{item.question}</div>
          {item.answer_reference && (
            <div className="text-xs text-zinc-500 mt-1 italic">
              {showReferenceLabel ? `${showReferenceLabel}: ` : "→ "}
              {item.answer_reference}
            </div>
          )}
          {item.edit_count > 0 && (
            <div className="text-[10px] text-zinc-500 mt-1">
              edytowane {item.edit_count}×
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMode("edit")}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Edytuj
        </Button>
      </div>
    </li>
  );
}
