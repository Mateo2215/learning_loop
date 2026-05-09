"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function MaterialActions({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  function handleShuffle() {
    // Pass options via sessionStorage so the review page can pick them up on mount.
    sessionStorage.setItem(
      "review_options",
      JSON.stringify({ shuffle: true, material_id: materialId })
    );
    router.push("/sessions/review");
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/ai/generate-items?material_id=${materialId}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Nie udało się wygenerować", {
          description: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success(`Wygenerowano ${body.added ?? "nowe"} pytania`, {
        description: "Nowe fiszki są dostępne w zakładkach poniżej.",
      });
      router.refresh();
    } catch {
      toast.error("Błąd sieci — spróbuj ponownie");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShuffle}
        className="inline-flex items-center gap-1.5 border border-line bg-surface text-subtle px-3 py-1.5 rounded-lg text-[12px] hover:text-fg hover:border-fg/30 transition-colors"
      >
        <Shuffle className="h-3.5 w-3.5" />
        Tasuj
      </button>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 border border-line bg-surface text-subtle px-3 py-1.5 rounded-lg text-[12px] hover:text-fg hover:border-fg/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {generating ? "Generuję…" : "Wygeneruj nowe"}
      </button>
    </>
  );
}
