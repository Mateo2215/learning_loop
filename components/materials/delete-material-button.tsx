"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

function pl(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export function DeleteMaterialButton({
  materialId,
  itemCount,
}: {
  materialId: string;
  itemCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
      router.push("/materials");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 border border-bad/40 rounded-lg px-3 py-1.5 bg-surface">
        <span className="text-[12px] text-subtle">
          Usunąć materiał i zawiesić {itemCount}{" "}
          {pl(itemCount, "pytanie", "pytania", "pytań")}?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-[12px] font-medium text-bad hover:underline disabled:opacity-50"
        >
          {loading ? "Usuwam…" : "Tak, usuń"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-muted hover:text-fg transition-colors"
          aria-label="Anuluj"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 border border-line bg-surface text-muted px-3 py-1.5 rounded-lg text-[12px] hover:border-bad hover:text-bad transition-colors"
      title="Usuń materiał"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Usuń
    </button>
  );
}
