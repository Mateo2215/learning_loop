"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { FlashThumb } from "@/components/materials/flash-thumb";
import { QuestionItem } from "@/components/materials/question-item";
import {
  ItemEditDialog,
  type EditableItem,
} from "@/components/materials/item-edit-dialog";
import { cn } from "@/lib/utils";

export interface ClozeItem {
  id: string;
  front: string;
  back: string | null;
  kind?: string;
  stabilityDays: number | null;
  dueDate: string | null;
}

export interface OpenItem {
  id: string;
  question: string;
  reference: string | null;
  kind?: string;
}

export interface MaterialNotes {
  insight: string | null;
  application: string | null;
}

export function ItemsTabs({
  cloze,
  open,
  source,
  notes,
}: {
  cloze: ClozeItem[];
  open: OpenItem[];
  source: string | null;
  notes: MaterialNotes;
}) {
  const [tab, setTab] = useState<"cloze" | "open" | "source" | "notes">(
    "cloze",
  );
  const [editing, setEditing] = useState<EditableItem | null>(null);

  const tabs: Array<{ id: typeof tab; label: string; count: number | null }> = [
    { id: "cloze", label: "Fiszki", count: cloze.length },
    { id: "open", label: "Pytania otwarte", count: open.length },
    { id: "source", label: "Źródło", count: null },
    { id: "notes", label: "Notatki", count: null },
  ];

  return (
    <section className="mt-8">
      <div className="border-b border-line flex gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "pb-3 text-[13px] font-medium whitespace-nowrap transition-colors -mb-px border-b-2",
                active
                  ? "text-fg border-accent"
                  : "text-muted hover:text-subtle border-transparent",
              )}
            >
              {t.label}
              {t.count !== null && (
                <span className="ml-2 font-mono text-muted text-[11px]">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        {tab === "cloze" && (
          <ClozeGrid items={cloze} onEdit={setEditing} />
        )}
        {tab === "open" && (
          <OpenList items={open} onEdit={setEditing} />
        )}
        {tab === "source" && <SourceTab source={source} />}
        {tab === "notes" && <NotesTab notes={notes} />}
      </div>

      <ItemEditDialog item={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function ClozeGrid({
  items,
  onEdit,
}: {
  items: ClozeItem[];
  onEdit: (item: EditableItem) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Brak fiszek.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onClick={() =>
            onEdit({
              id: c.id,
              question: c.front,
              answerReference: c.back,
              type: "cloze",
            })
          }
          className="group relative text-left cursor-pointer rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Edytuj fiszkę ${i + 1}`}
        >
          <FlashThumb
            index={i}
            front={c.front}
            back={c.back}
            kind={c.kind}
            stabilityDays={c.stabilityDays}
            dueDate={c.dueDate}
          />
          <Pencil
            className="absolute top-3 right-3 h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            strokeWidth={1.75}
          />
        </button>
      ))}
    </div>
  );
}

function OpenList({
  items,
  onEdit,
}: {
  items: OpenItem[];
  onEdit: (item: EditableItem) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">Brak pytań otwartych.</p>;
  }
  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {items.map((q, i) => (
        <button
          key={q.id}
          type="button"
          onClick={() =>
            onEdit({
              id: q.id,
              question: q.question,
              answerReference: q.reference,
              type: "open",
            })
          }
          className="group relative text-left cursor-pointer rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent hover:[&>div]:border-line-strong"
          aria-label={`Edytuj pytanie ${i + 1}`}
        >
          <QuestionItem
            index={i}
            question={q.question}
            reference={q.reference}
            kind={q.kind}
          />
          <Pencil
            className="absolute top-4 right-4 h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            strokeWidth={1.75}
          />
        </button>
      ))}
    </div>
  );
}

function SourceTab({ source }: { source: string | null }) {
  if (!source) {
    return (
      <p className="text-sm text-muted">
        Treść jeszcze nie jest gotowa.
      </p>
    );
  }
  return (
    <article className="prose prose-sm max-w-none font-sans text-[14px] leading-relaxed text-fg whitespace-pre-wrap">
      {source}
    </article>
  );
}

function NotesTab({ notes }: { notes: MaterialNotes }) {
  if (!notes.insight && !notes.application) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-subtle text-[14px] mb-3">Brak notatek.</p>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 bg-elevated text-muted px-4 py-2 rounded-lg text-[13px] font-medium cursor-not-allowed"
          title="Edytor notatek pojawi się w kolejnej fazie"
        >
          Dodaj notatkę
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-2xl">
      {notes.insight && (
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-2">
            Co mnie zaskoczyło
          </div>
          <p className="text-[14px] text-fg leading-relaxed">{notes.insight}</p>
        </div>
      )}
      {notes.application && (
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-2">
            Gdzie zastosuję
          </div>
          <p className="text-[14px] text-fg leading-relaxed">
            {notes.application}
          </p>
        </div>
      )}
    </div>
  );
}
