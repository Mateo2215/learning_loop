"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnswerInput } from "@/components/sessions/answer-input";

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

type Phase = "loading" | "answering" | "validating" | "feedback" | "done" | "error";

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "audit", audit_id }),
        });
        if (!active) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPhase("error");
          setErrorMessage(body.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as SessionStartResponse;
        setSessionId(data.session_id);
        setAudit(data.audit);
        setItems(data.items);
        setIndex(0);
        setQuestionShownAt(Date.now());
        setPhase(data.items.length === 0 ? "error" : "answering");
        if (data.items.length === 0) setErrorMessage("AI nie wygenerowało pytań — spróbuj ponownie.");
      } catch {
        if (!active) return;
        setPhase("error");
        setErrorMessage("Błąd sieci.");
      }
    })();
    return () => {
      active = false;
    };
  }, [audit_id]);

  const submitAnswer = useCallback(async () => {
    if (!sessionId) return;
    const item = items[index];
    if (!item) return;
    if (userAnswer.trim().length < 3) {
      toast.error("Odpowiedź za krótka", { description: "Wpisz co najmniej kilka słów." });
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
          const data = (await res.json()) as EndResponse;
          setAuditScore(data.audit_score);
        } catch {
          /* noop — closure isn't critical for UX */
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
            <Button onClick={() => router.push("/sessions/audit")}>Inny audyt</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  const current = items[index];
  if (!current || !audit) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col max-w-2xl mx-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-center justify-between mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{index + 1} / {items.length}</span>
        <span className="truncate ml-3">{TRIGGER_LABEL[audit.trigger]} · {audit.material_title}</span>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-normal leading-relaxed">
            {current.question}
          </CardTitle>
        </CardHeader>
      </Card>

      {(phase === "answering" || phase === "validating") && (
        <div className="flex-1 flex flex-col gap-3">
          <AnswerInput
            value={userAnswer}
            onChange={setUserAnswer}
            disabled={phase === "validating"}
            autoFocus
            rows={6}
          />
          <div className="mt-auto sticky bottom-0 pt-2">
            <Button
              onClick={submitAnswer}
              disabled={phase === "validating" || userAnswer.trim().length < 3}
              className="w-full min-h-14 text-base"
            >
              {phase === "validating" ? "AI ocenia…" : "Wyślij odpowiedź"}
            </Button>
          </div>
        </div>
      )}

      {phase === "feedback" && feedback && (
        <div className="flex-1 flex flex-col gap-4">
          <FeedbackCard feedback={feedback} userAnswer={userAnswer} reference={current.answer_reference} />
          <div className="mt-auto sticky bottom-0 pt-2">
            <Button onClick={() => void goNext()} className="w-full min-h-14 text-base">
              {index + 1 >= items.length ? "Zakończ audyt" : "Następne pytanie →"}
            </Button>
          </div>
        </div>
      )}
    </div>
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
    correct: { label: "Poprawnie", cls: "text-emerald-700 dark:text-emerald-300" },
    partially_correct: { label: "Częściowo poprawnie", cls: "text-amber-700 dark:text-amber-300" },
    incorrect: { label: "Niepoprawnie", cls: "text-red-700 dark:text-red-300" },
  };
  const { label, cls } = evalLabel[feedback.evaluation];

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-base ${cls}`}>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {feedback.feedback_positive && (
          <div className="border-l-2 border-emerald-500 pl-3">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">Plusy</div>
            <div className="text-zinc-700 dark:text-zinc-200">{feedback.feedback_positive}</div>
          </div>
        )}
        {feedback.feedback_negative && (
          <div className="border-l-2 border-red-500 pl-3">
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">Minusy</div>
            <div className="text-zinc-700 dark:text-zinc-200">{feedback.feedback_negative}</div>
          </div>
        )}
        <details className="pt-2">
          <summary className="text-xs text-zinc-500 cursor-pointer">Twoja odpowiedź / wzorzec</summary>
          <div className="mt-2 space-y-2">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Twoja odpowiedź:</div>
              <div className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{userAnswer}</div>
            </div>
            {reference && (
              <div>
                <div className="text-xs text-zinc-500 mb-1">Wzorcowa odpowiedź:</div>
                <div className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap italic">{reference}</div>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ScreenMessage({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </div>
  );
}
