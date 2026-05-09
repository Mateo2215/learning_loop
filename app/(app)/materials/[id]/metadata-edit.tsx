"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "@/lib/db/types";

const CATEGORIES = [
  "finanse",
  "programowanie",
  "ai_ml",
  "soft_skills",
  "ogolne",
] as const;

type Category = (typeof CATEGORIES)[number];

interface Props {
  materialId: string;
  initialTitle: string;
  initialCategory: Category;
  initialTags: string[];
}

export function MetadataEdit({ materialId, initialTitle, initialCategory, initialTags }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing]);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleCancel() {
    setTitle(initialTitle);
    setCategory(initialCategory);
    setTags(initialTags);
    setTagInput("");
    setEditing(false);
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Tytuł nie może być pusty"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, tags }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("Nie udało się zapisać", { description: body.error });
        return;
      }
      toast.success("Zapisano");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Błąd sieci — spróbuj ponownie");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.12em] text-muted hover:text-fg transition-colors"
        title="Edytuj metadane"
      >
        <Pencil className="h-3 w-3" />
        Edytuj
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-line bg-surface">
      {/* Title */}
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-[0.12em] text-muted mb-1">
          Tytuł
        </label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-[14px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-[0.12em] text-muted mb-1">
          Kategoria
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="bg-canvas border border-line rounded-lg px-3 py-2 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-[0.12em] text-muted mb-1">
          Tagi
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 bg-elevated border border-line px-2 py-0.5 rounded-full text-[11px] text-subtle"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-muted hover:text-bad transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Nowy tag…"
            className="flex-1 bg-canvas border border-line rounded-lg px-3 py-1.5 text-[12px] text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={addTag}
            className="inline-flex items-center gap-1 border border-line bg-surface px-2.5 py-1.5 rounded-lg text-[12px] text-subtle hover:text-fg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-accent text-accent-fg px-3 py-1.5 rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Zapisuję…" : "Zapisz"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 border border-line bg-surface text-subtle px-3 py-1.5 rounded-lg text-[12px] hover:text-fg transition-colors disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Anuluj
        </button>
      </div>
    </div>
  );
}
