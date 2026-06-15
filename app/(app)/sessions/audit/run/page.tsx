"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GradingButtons, type GradingRating } from "@/components/sessions/grading-buttons";
import { startSession, type ActiveSessionInfo } from "@/lib/sessions/start-client";
import { ActiveSessionPrompt } from "@/components/sessions/active-session-prompt";
import { ScreenMessage } from "@/components/sessions/screen-message";
import { SessionShell } from "@/components/sessions/session-shell";
import { nextAuditInterval } from "@/lib/audits/intervals";

interface AuditItem {
  id: string;
  material_id: string;
  type: "open";
  question: string;
  answer_reference: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  material_title: string;
  audit_id: string;
  audit_round: number;
}

interface SessionStartResponse {
  session_id: string;
  started_at: string;
  items: AuditItem[];
  queued_remaining: number;
}

interface EndResponse {
  ok: boolean;
  items_completed: number;
  audit_score: number | null;
}

type Phase = "loading" | "conflict" | "recall" | "revealed" | "done" | "error";

/** Samoocena (1–4) → wynik 1–10 (drabina interwałów) — spójne z backendem. */
const SELF_GRADE_SCORE: Record<GradingRating, number> = { 1: 2, 2: 5, 3: 8, 4: 10 };

/** Nazwy samooceny (zestaw „Klarowność”). */
const AUDIT_LABELS: Record<GradingRating, string> = {
  1: "Pustka",
  2: "Mgliście",
  3: "Wyraźnie",
  4: "Krystalicznie",
};

export default function AuditRunPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [queuedRemaining, setQueuedRemaining] = useState(0);
  const [index, setIndex] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ActiveSessionInfo | null>(null);
  const [takingOver, setTakingOver] = useState(false);

  const startAudit = useCallback(async (force: boolean) => {
    setPhase("loading");
    const result = await startSession<SessionStartResponse>({ mode: "audit", force });
    if (result.kind === "conflict") {
      setActiveConflict(result.active);
      setPhase("conflict");
      return;
    }
    if (result.kind === "error" || result.kind === "empty" || result.kind === "cap_reached") {
      setPhase("error");
      setErrorMessage(
        result.kind === "empty"
          ? "Brak materiałów gotowych do audytu. Wróć tu, gdy któryś dojrzeje."
          : result.kind === "error"
            ? result.message
            : "Brak pytań w audycie."
      );
      return;
    }
    const data = result.data;
    setActiveConflict(null);
    setSessionId(data.session_id);
    setItems(data.items);
    setQueuedRemaining(data.queued_remaining ?? 0);
    setIndex(0);
    setQuestionShownAt(Date.now());
    if (data.items.length === 0) {
      setPhase("error");
      setErrorMessage("Brak pytań do sprawdzenia — spróbuj ponownie.");
    } else {
      setPhase("recall");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startAudit(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startAudit]);

  const reveal = useCallback(() => {
    setPhase((p) => (p === "recall" ? "revealed" : p));
  }, []);

  const submitGrade = useCallback(
    async (rating: GradingRating) => {
      if (!sessionId || submitting) return;
      const item = items[index];
      if (!item) return;

      setSubmitting(true);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: item.id,
            self_grade: rating,
            response_time_ms: Date.now() - questionShownAt,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error("Nie zapisano oceny", { description: body.error ?? `HTTP ${res.status}` });
          setSubmitting(false);
          return;
        }
      } catch {
        toast.error("Błąd sieci");
        setSubmitting(false);
        return;
      }

      const next = index + 1;
      if (next >= items.length) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
          if (res.ok) {
            const data = (await res.json()) as Partial<EndResponse>;
            setAuditScore(
              typeof data.audit_score === "number" && Number.isFinite(data.audit_score)
                ? data.audit_score
                : null
            );
          } else {
            const body = await res.json().catch(() => ({}));
            toast.error("Nie zamknięto audytu", { description: body.error ?? `HTTP ${res.status}` });
          }
        } catch {
          toast.error("Nie zamknięto audytu", { description: "Spróbuj ponownie za chwilę." });
        }
        setSubmitting(false);
        setPhase("done");
        return;
      }

      setIndex(next);
      setQuestionShownAt(Date.now());
      setSubmitting(false);
      setPhase("recall");
    },
    [sessionId, items, index, questionShownAt, submitting]
  );

  // Spacja odsłania wzorcową odpowiedź w fazie recall.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && phase === "recall") {
        e.preventDefault();
        reveal();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reveal]);

  if (phase === "loading") {
    return <ScreenMessage title="Ładuję audyt…" description="Dobieram pytania z materiałów gotowych do sprawdzenia." />;
  }

  if (phase === "conflict" && activeConflict) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ActiveSessionPrompt
          active={activeConflict}
          takingOver={takingOver}
          onTakeOver={async () => {
            setTakingOver(true);
            await startAudit(true);
            setTakingOver(false);
          }}
          onCancel={() => router.push("/sessions/audit")}
        />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <ScreenMessage
        title="Coś poszło nie tak"
        description={errorMessage ?? "Nieznany błąd."}
        action={
          <div className="flex gap-2">
            <Button onClick={() => router.push("/sessions/audit")}>← Audyty</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  if (phase === "done") {
    const scoreLabel = auditScore === null ? "—" : `${Math.round(auditScore * 100)}%`;
    const queueNote =
      queuedRemaining > 0
        ? `${queuedRemaining} ${queuedRemaining === 1 ? "materiał czeka" : "materiałów czeka"} w kolejce na kolejny audyt.`
        : "Brak materiałów w kolejce — wszystko sprawdzone.";
    return (
      <ScreenMessage
        title={`Audyt zakończony · wynik ${scoreLabel}`}
        description={queueNote}
        action={
          <div className="flex gap-2">
            {queuedRemaining > 0 && (
              <Button onClick={() => void startAudit(false)}>Następny audyt</Button>
            )}
            <Button asChild variant={queuedRemaining > 0 ? "outline" : "default"}>
              <Link href="/sessions/audit">Audyty</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const current = items[index];
  if (!current) return null;

  const progress = items.length === 0 ? 0 : Math.round((index / items.length) * 100);

  // Podgląd kolejnego interwału audytu per ocena (drabina zależna od rundy).
  const intervals: Partial<Record<GradingRating, string>> = {};
  for (const r of [1, 2, 3, 4] as GradingRating[]) {
    const { intervalDays } = nextAuditInterval(current.audit_round, SELF_GRADE_SCORE[r]);
    intervals[r] = `za ${intervalDays} dni`;
  }

  return (
    <SessionShell
      progress={progress}
      meta={
        <>
          <span className="font-mono">{index + 1} / {items.length}</span>
          <span className="truncate ml-3">Audyt · {current.material_title}</span>
        </>
      }
      bottom={
        phase === "recall" ? (
          <Button onClick={reveal} className="w-full min-h-14 text-base">
            Pokaż wzorcową odpowiedź
          </Button>
        ) : null
      }
      hint={phase === "recall" ? <span>Spacja — odsłoń · przypomnij sobie odpowiedź najpierw</span> : undefined}
    >
      <h2 className="font-serif text-2xl sm:text-3xl font-normal leading-tight tracking-tight mb-6">
        {current.question}
      </h2>

      {phase === "revealed" && (
        <div className="space-y-6">
          <div className="border-l-2 border-accent pl-4">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Wzorcowa odpowiedź</div>
            <div className="text-[15px] text-subtle whitespace-pre-wrap leading-relaxed">
              {current.answer_reference ?? "(brak wzorcowej odpowiedzi)"}
            </div>
          </div>

          <div>
            <div className="text-[13px] text-muted mb-3">Jak Ci poszło?</div>
            <GradingButtons
              onRate={(r) => void submitGrade(r)}
              labels={AUDIT_LABELS}
              intervals={intervals}
              enableKeyboard={!submitting}
              disabled={submitting}
            />
          </div>
        </div>
      )}
    </SessionShell>
  );
}
