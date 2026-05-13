"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnswerInput } from "@/components/sessions/answer-input";
import { startSession, type ActiveSessionInfo } from "@/lib/sessions/start-client";
import { ActiveSessionPrompt } from "@/components/sessions/active-session-prompt";
import { ScreenMessage } from "@/components/sessions/screen-message";
import { SessionShell } from "@/components/sessions/session-shell";
import { cn } from "@/lib/utils";

interface OpenItem {
  id: string;
  material_id: string;
  type: "open";
  question: string;
  answer_reference: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
}

interface AuditMeta {
  id: string;
  material_id: string;
  material_title: string;
  trigger: "day_7" | "day_30" | "day_90" | "resurrection";
}

interface SessionStartResponse {
  session_id: string;
  started_at: string;
  audit: AuditMeta;
  items: OpenItem[];
}

interface AnswerResponse {
  review_id: string;
  evaluation: "correct" | "partially_correct" | "incorrect";
  feedback_positive: string;
  feedback_negative: string;
}

interface EndResponse {
  ok: boolean;
  items_completed: number;
  audit_score: number | null;
}

type Phase = "loading" | "conflict" | "answering" | "validating" | "feedback" | "done" | "error";

const TRIGGER_LABEL: Record<AuditMeta["trigger"], string> = {
  day_7: "Audyt po 7 dniach",
  day_30: "Audyt po 30 dniach",
  day_90: "Audyt po 90 dniach",
  resurrection: "Powrót do tematu",
};

export default function AuditRunPage({ params }: { params: Promise<{ audit_id: string }> }) {
  const { audit_id } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditMeta | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [index, setIndex] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [activeConflict, setActiveConflict] = useState<ActiveSessionInfo | null>(null);
  const [takingOver, setTakingOver] = useState(false);

  const startAudit = useCallback(async (force: boolean) => {
    setPhase("loading");
    const result = await startSession<SessionStartResponse>({ mode: "audit", audit_id, force });
    if (result.kind === "conflict") {
      setActiveConflict(result.active);
      setPhase("conflict");
      return;
    }
    if (result.kind === "error" || result.kind === "empty" || result.kind === "cap_reached") {
      setPhase("error");
      setErrorMessage(result.kind === "error" ? result.message : "Brak pytań w audycie.");
      return;
    }
    const data = result.data;
    setActiveConflict(null);
    setSessionId(data.session_id);
    setAudit(data.audit);
    setItems(data.items);
    setIndex(0);
    setQuestionShownAt(Date.now());
    if (data.items.length === 0) {
      setPhase("error");
      setErrorMessage("AI nie wygenerowało pytań — spróbuj ponownie.");
    } else {
      setPhase("answering");
    }
  }, [audit_id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startAudit(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startAudit]);

  const submitAnswer = useCallback(async () => {
    if (!sessionId) return;
    const item = items[index];
    if (!item) return;
    if (userAnswer.trim().length < 3) {
      toast.error("Odpowiedź za krótka", { description: "Wpisz co najmniej kilka słów." });
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Brak połączenia", {
        description: "Walidacja AI wymaga internetu. Spróbuj ponownie gdy wrócisz online.",
      });
      return;
    }

    setPhase("validating");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          user_answer: userAnswer.trim(),
          response_time_ms: Date.now() - questionShownAt,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPhase("answering");
        toast.error("AI nie odpowiedziało", { description: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const data = (await res.json()) as AnswerResponse;
      setFeedback(data);
      setPhase("feedback");
    } catch {
      setPhase("answering");
      toast.error("Błąd sieci");
    }
  }, [sessionId, items, index, userAnswer, questionShownAt]);

  const goNext = useCallback(async () => {
    const next = index + 1;
    if (next >= items.length) {
      if (sessionId) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            toast.error("Nie zamknięto audytu", {
              description: body.error ?? `HTTP ${res.status}`,
            });
            return;
          }
          const data = (await res.json()) as Partial<EndResponse>;
          setAuditScore(
            typeof data.audit_score === "number" && Number.isFinite(data.audit_score)
              ? data.audit_score
              : null
          );
        } catch {
          toast.error("Nie zamknięto audytu", {
            description: "Spróbuj ponownie za chwilę.",
          });
          return;
        }
      }
      setPhase("done");
      return;
    }
    setIndex(next);
    setQuestionShownAt(Date.now());
    setUserAnswer("");
    setFeedback(null);
    setPhase("answering");
  }, [index, items.length, sessionId]);

  if (phase === "loading") return <ScreenMessage title="Generuję świeże pytania audytowe…" description="AI dobiera pytania, których jeszcze nie widziałeś." />;

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
            <Button onClick={() => router.push("/sessions/audit")}>← Lista audytów</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  if (phase === "done") {
    const scoreLabel =
      auditScore === null
        ? "—"
        : `${Math.round(auditScore * 100)}%`;
    return (
      <ScreenMessage
        title={`Audyt zakończony · wynik ${scoreLabel}`}
        description={audit ? `${TRIGGER_LABEL[audit.trigger]} · ${audit.material_title}` : undefined}
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/sessions/audit">Inny audyt</Link>
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
  if (!current || !audit) return null;

  const progress = items.length === 0 ? 0 : Math.round((index / items.length) * 100);

  return (
    <SessionShell
      progress={progress}
      meta={
        <>
          <span className="font-mono">{index + 1} / {items.length}</span>
          <span className="truncate ml-3">{TRIGGER_LABEL[audit.trigger]} · {audit.material_title}</span>
        </>
      }
      bottom={
        phase === "answering" || phase === "validating" ? (
          <Button
            onClick={submitAnswer}
            disabled={phase === "validating" || userAnswer.trim().length < 3}
            className="w-full min-h-14 text-base"
          >
            {phase === "validating" ? "AI ocenia…" : "Wyślij odpowiedź"}
          </Button>
        ) : phase === "feedback" && feedback ? (
          <Button onClick={() => void goNext()} className="w-full min-h-14 text-base">
            {index + 1 >= items.length ? "Zakończ audyt" : "Następne pytanie →"}
          </Button>
        ) : null
      }
    >
      <h2 className="font-serif text-2xl sm:text-3xl font-normal leading-tight tracking-tight mb-6">
        {current.question}
      </h2>

      {(phase === "answering" || phase === "validating") && (
        <AnswerInput
          value={userAnswer}
          onChange={setUserAnswer}
          disabled={phase === "validating"}
          autoFocus
          rows={6}
          mode="voice"
        />
      )}

      {phase === "feedback" && feedback && (
        <FeedbackCard feedback={feedback} userAnswer={userAnswer} reference={current.answer_reference} />
      )}
    </SessionShell>
  );
}

function FeedbackCard({
  feedback,
  userAnswer,
  reference,
}: {
  feedback: AnswerResponse;
  userAnswer: string;
  reference: string | null;
}) {
  const evalLabel: Record<AnswerResponse["evaluation"], { label: string; cls: string }> = {
    correct: { label: "Poprawnie", cls: "text-ok" },
    partially_correct: { label: "Częściowo poprawnie", cls: "text-warn" },
    incorrect: { label: "Niepoprawnie", cls: "text-bad" },
  };
  const { label, cls } = evalLabel[feedback.evaluation];

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-base ${cls}`}>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {feedback.feedback_positive && (
          <div className="border-l-2 border-ok pl-3">
            <div className="text-xs uppercase tracking-wide text-ok mb-1">Plusy</div>
            <div className="text-subtle">{feedback.feedback_positive}</div>
          </div>
        )}
        {feedback.feedback_negative && (
          <div className="border-l-2 border-bad pl-3">
            <div className="text-xs uppercase tracking-wide text-bad mb-1">Minusy</div>
            <div className="text-subtle">{feedback.feedback_negative}</div>
          </div>
        )}
        <FeedbackDetails userAnswer={userAnswer} reference={reference} />
      </CardContent>
    </Card>
  );
}

function FeedbackDetails({ userAnswer, reference }: { userAnswer: string; reference: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="text-xs text-muted hover:text-subtle inline-flex items-center gap-1"
        aria-expanded={open}
      >
        <span className={cn("transition-transform", open && "rotate-90")}>▸</span>
        Twoja odpowiedź / wzorzec
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Twoja odpowiedź</div>
            <div className="text-sm text-subtle whitespace-pre-wrap">{userAnswer}</div>
          </div>
          {reference && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Wzorcowa odpowiedź</div>
              <div className="text-sm text-subtle whitespace-pre-wrap italic">{reference}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
