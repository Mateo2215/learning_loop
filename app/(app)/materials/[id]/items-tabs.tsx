"use client";

import { useState } from "react";
import { ItemListClient, type EditableItem } from "./item-list-client";
import { cn } from "@/lib/utils";

export function ItemsTabs({
  cloze,
  open,
}: {
  cloze: EditableItem[];
  open: EditableItem[];
}) {
  const [tab, setTab] = useState<"cloze" | "open">("cloze");

  return (
    <section className="mt-6">
      <div className="flex items-center gap-1 border-b border-line mb-4">
        <TabButton active={tab === "cloze"} onClick={() => setTab("cloze")}>
          Fiszki <span className="font-mono text-muted ml-1">{cloze.length}</span>
        </TabButton>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          Pytania otwarte <span className="font-mono text-muted ml-1">{open.length}</span>
        </TabButton>
      </div>

      {tab === "cloze" ? (
        <ItemListClient items={cloze} emptyLabel="Brak fiszek." />
      ) : (
        <ItemListClient items={open} emptyLabel="Brak pytań otwartych." showReferenceLabel="Wzorzec" />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
        active
          ? "border-accent text-fg font-medium"
          : "border-transparent text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
