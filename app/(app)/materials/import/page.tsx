"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/db/types";
import { subscribeProcessingJob } from "@/lib/realtime/subscriptions";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Mode = "file" | "paste";
type Phase = "form" | "processing" | "done" | "error";

interface JobState {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  error?: string | null;
  result?: { material_id?: string; cloze_count?: number; open_count?: number } | null;
}

export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("ogolne");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(null);
  const pollRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("Podaj tytuł materiału.");
      return;
    }
    if (mode === "file" && !file) {
      setErrorMessage("Wybierz plik.");
      return;
    }
    if (mode === "paste" && pastedText.trim().length < 100) {
      setErrorMessage("Wklej co najmniej 100 znaków.");
      return;
    }

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("category", category);
    if (mode === "file" && file) fd.set("file", file);
    if (mode === "paste") fd.set("pasted_text", pastedText);

    setPhase("processing");

    let res: Response;
    try {
      res = await fetch("/api/materials/import", { method: "POST", body: fd });
    } catch {
      setPhase("error");
      setErrorMessage("Błąd sieci.");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error ?? `HTTP ${res.status}`;
      setPhase("error");
      setErrorMessage(msg);
      toast.error("Nie udało się rozpocząć importu", { description: msg });
      return;
    }

    const { job_id } = (await res.json()) as { job_id: string };
    trackJob(job_id);
  }

  function handleJobUpdate(data: JobState) {
    setJobState(data);

    if (data.status === "completed") {
      stopTracking();
      setPhase("done");
      const cloze = data.result?.cloze_count ?? 0;
      const open = data.result?.open_count ?? 0;
      toast.success("Materiał zaimportowany", {
        description: `${cloze} fiszek + ${open} pytań otwartych.`,
      });
      const materialId = data.result?.material_id;
      if (materialId) {
        setTimeout(() => router.push(`/materials/${materialId}`), 1200);
      }
    } else if (data.status === "failed") {
      stopTracking();
      const msg = data.error ?? "Pipeline nie zakończył się sukcesem.";
      setPhase("error");
      setErrorMessage(msg);
      toast.error("Import nie powiódł się", { description: msg });
    }
  }

  function stopTracking() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  /**
   * Realtime subscription for live progress + a slow polling fallback in case
   * the publication isn't enabled or events drop. Either path eventually fires
   * `handleJobUpdate`, which is idempotent.
   */
  function trackJob(jobId: string) {
    stopTracking();

    channelRef.current = subscribeProcessingJob<JobState>(jobId, (row) => {
      handleJobUpdate(row);
    });

    const tick = async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data = (await res.json()) as JobState;
      handleJobUpdate(data);
    };
    void tick();
    pollRef.current = window.setInterval(tick, 5000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Import materiału</h1>

      {phase === "form" && (
          <Card>
            <CardHeader>
              <CardTitle>Nowy materiał</CardTitle>
              <CardDescription>
                Wgraj plik DOCX/MD/TXT lub wklej tekst. Pipeline skompresuje treść i wygeneruje pytania.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tytuł</label>
                  <Input
                    placeholder="np. Wprowadzenie do MCP"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Kategoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="h-9 px-3 rounded-md border border-line bg-surface text-fg text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={mode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode("file")}
                  >
                    Plik
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "paste" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode("paste")}
                  >
                    Wklej tekst
                  </Button>
                </div>

                {mode === "file" ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Plik (DOCX, MD lub TXT, max 5 MB)</label>
                    <Input
                      type="file"
                      accept=".docx,.md,.markdown,.txt"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Treść (min. 100 znaków)</label>
                    <Textarea
                      rows={10}
                      placeholder="Wklej tekst materiału…"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                    />
                  </div>
                )}

                {errorMessage && (
                  <p className="text-sm text-bad">{errorMessage}</p>
                )}

                <Button type="submit" className="mt-2">Zaimportuj</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {phase === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle>Przetwarzanie…</CardTitle>
              <CardDescription>
                Materiał jest analizowany przez AI. Może to potrwać 20–60 sekund.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-2 w-full bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fg transition-all"
                    style={{ width: `${jobState?.progress ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-muted">
                  {progressLabel(jobState?.progress ?? 0)} ({jobState?.progress ?? 0}%)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "done" && (
          <Card>
            <CardHeader>
              <CardTitle>Gotowe ✓</CardTitle>
              <CardDescription>
                Wygenerowano {jobState?.result?.cloze_count ?? 0} fiszek i {jobState?.result?.open_count ?? 0} pytań otwartych.
                Przekierowuję…
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {phase === "error" && (
          <Card>
            <CardHeader>
              <CardTitle>Coś poszło nie tak</CardTitle>
              <CardDescription className="text-bad">
                {errorMessage ?? "Nieznany błąd."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => { setPhase("form"); setJobState(null); setErrorMessage(null); }}>
                Spróbuj ponownie
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

function progressLabel(progress: number): string {
  if (progress < 15) return "Inicjalizacja";
  if (progress < 30) return "Generowanie embeddingu";
  if (progress < 45) return "Kompresja treści";
  if (progress < 55) return "Tagowanie";
  if (progress < 75) return "Generowanie fiszek";
  if (progress < 90) return "Generowanie pytań otwartych";
  if (progress < 100) return "Planowanie audytów";
  return "Zakończono";
}
