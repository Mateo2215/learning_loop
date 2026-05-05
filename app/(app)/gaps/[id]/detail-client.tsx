"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { GapSeverity, GapType, KnowledgeGap } from "@/lib/db/types";

const GAP_TYPE_LABEL: Record<GapType, string> = {
  low_correct_rate: "Niski correct rate",
  stale_topic: "Zaniedbany temat",
  rising_failures: "Rosnące porażki",
  never_consolidated: "Brak utrwalenia",
};

const SEVERITY_STYLE: Record<GapSeverity, string> = {
  high: "bg-bad/15 text-bad",
  medium: "bg-warn/15 text-warn",
  low: "bg-elevated text-muted",
};

const SEVERITY_LABEL: Record<GapSeverity, string> = {
  high: "Wysoki priorytet",
  medium: "Średni priorytet",
  low: "Niski priorytet",
};

export function GapDetailClient({
  gap,
  materialTitles,
}: {
  gap: KnowledgeGap;
  materialTitles: string[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string | null>(gap.generated_prompt);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generatePrompt() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/gaps/${gap.id}/generate-prompt`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Nie udało się wygenerować", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setPrompt(data.generated_prompt as string);
      setCopied(false);
      toast.success("Prompt gotowy");
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setGenerating(false);
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Skopiowano do schowka");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Nie udało się skopiować");
    }
  }

  async function dismissGap() {
    try {
      const res = await fetch(`/api/gaps/${gap.id}/dismiss`, { method: "POST" });
      if (!res.ok) {
        toast.error("Nie zapisano");
        return;
      }
      router.push("/gaps");
    } catch {
      toast.error("Błąd sieci");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4 text-sm">
        <Link href="/gaps" className="text-muted hover:underline">
          ← Wszystkie luki
        </Link>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-xl">{gap.title ?? GAP_TYPE_LABEL[gap.gap_type]}</CardTitle>
              <CardDescription className="mt-1">
                {GAP_TYPE_LABEL[gap.gap_type]} · wykryto{" "}
                {new Date(gap.detected_at).toLocaleDateString("pl-PL")}
              </CardDescription>
            </div>
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${SEVERITY_STYLE[gap.severity]}`}>
              {SEVERITY_LABEL[gap.severity]}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {gap.affected_tags.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Tagi</div>
              <div className="flex flex-wrap gap-1">
                {gap.affected_tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 text-xs rounded-md bg-elevated text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {materialTitles.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Materiały</div>
              <ul className="list-disc list-inside text-subtle">
                {materialTitles.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Prompt do Claude.ai</CardTitle>
          <CardDescription>
            AI wygeneruje prompt dopasowany do tej luki — wklej go w Claude.ai aby otrzymać raport (.docx).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!prompt ? (
            <Button onClick={generatePrompt} disabled={generating}>
              {generating ? "AI tworzy prompt…" : "Wygeneruj prompt"}
            </Button>
          ) : (
            <>
              <Textarea value={prompt} readOnly rows={14} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyPrompt}>
                  {copied ? "Skopiowano ✓" : "Skopiuj prompt"}
                </Button>
                <Button variant="outline" asChild>
                  <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
                    Otwórz Claude.ai →
                  </a>
                </Button>
                <Button variant="ghost" onClick={generatePrompt} disabled={generating}>
                  {generating ? "AI tworzy…" : "Wygeneruj ponownie"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={dismissGap}>
          Odrzuć lukę
        </Button>
      </div>
    </div>
  );
}
