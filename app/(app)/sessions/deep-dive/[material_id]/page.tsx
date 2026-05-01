"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface OpenItem {
  id: string;
  material_id: string;
  type: "open";
  question: string;
  answer_reference: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
}

interface SessionStartResponse {
  session_id: string;
  started_at: string;
  items: OpenItem[];
}

interface AnswerResponse {
  review_id: string;
  evaluation: "correct" | "partially_correct" | "incorrect";
  feedback_positive: string;
  feedback_negative: string;
}

type Phase = "loading" | "empty" | "answering" | "validating" | "feedback" | "done" | "error";

export default function DeepDivePage({ params }: { params: Promise<{ material_id: string }> }) {
  const { material_id } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [index, setIndex] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(Date.now());
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [calibrationPicked, setCalibrationPicked] = useState<"agree" | "too_strict" | "too_lenient" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "deep_dive", material_id, item_count: 10 }),
        });
        if (!active) return;

        if (res.status === 404) {
          setPhase("empty");
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPhase("error");
          setErrorMessage(body.error ?? `HTTP ${res.status}`);
          return;
        }

        const data = (await res.json()) as SessionStartResponse;
        setSessionId(data.session_id);
        setItems(data.items);
        setIndex(0);
        setQuestionShownAt(Date.now());
        setPhase(data.items.length === 0 ? "empty" : "answering");
      } catch {
        if (!active) return;
        setPhase("error");
        setErrorMessage("Błąd sieci.");
      }
    })();
    return () => {
      active = false;
    };
  }, [material_id]);

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
      setCalibrationPicked(null);
      setPhase("feedback");
    } catch {
      setPhase("answering");
      toast.error("Błąd sieci");
    }
  }, [sessionId, items, index, userAnswer, questionShownAt]);

  const submitCalibration = useCallback(
    async (calibration: "agree" | "too_strict" | "too_lenient") => {
      if (!sessionId || !feedback || calibrationPicked) return;
      setCalibrationPicked(calibration);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/calibrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_id: feedback.review_id, calibration }),
        });
        if (!res.ok) {
          setCalibrationPicked(null);
          toast.error("Nie zapisano kalibracji");
        }
      } catch {
        setCalibrationPicked(null);
        toast.error("Błąd sieci");
      }
    },
    [sessionId, feedback, calibrationPicked]
  );

  const goNext = useCallback(async () => {
    const next = index + 1;
    if (next >= items.length) {
      if (sessionId) {
        await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" }).catch(() => {});
      }
      setPhase("done");
      return;
    }
    setIndex(next);
    setQuestionShownAt(Date.now());
    setUserAnswer("");
    setFeedback(null);
    setCalibrationPicked(null);
    setPhase("answering");
  }, [index, items.length, sessionId]);

  if (phase === "loading") return <ScreenMessage title="Wczytuję sesję…" />;

  if (phase === "empty") {
    return (
      <ScreenMessage
        title="Brak pytań otwartych"
        description="Ten materiał nie ma jeszcze pytań otwartych do Deep Dive."
        action={
          <Button onClick={() => router.push("/sessions/deep-dive")}>← Wybierz inny materiał</Button>
        }
      />
    );
  }

  if (phase === "error") {
    return (
      <ScreenMessage
        title="Coś poszło nie tak"
        description={errorMessage ?? "Nieznany błąd."}
        action={<Button onClick={() => router.push("/dashboard")}>← Dashboard</Button>}
      />
    );
  }

  if (phase === "done") {
    return (
      <ScreenMessage
        title={`Sesja zakończona — ${index + 1} pytań`}
        description="Świetna robota."
        action={
          <div className="flex gap-2">
            <Button onClick={() => router.push("/sessions/deep-dive")}>Inny materiał</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  const current = items[index];
  if (!current) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{index + 1} / {items.length}</span>
        <span>Pytanie otwarte</span>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base font-normal leading-relaxed">
            {current.question}
          </CardTitle>
        </CardHeader>
      </Card>

      {(phase === "answering" || phase === "validating") && (
        <div className="space-y-3">
          <Textarea
            rows={6}
            placeholder="Wpisz swoją odpowiedź…"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={phase === "validating"}
            autoFocus
          />
          <Button
            onClick={submitAnswer}
            disabled={phase === "validating" || userAnswer.trim().length < 3}
            className="w-full h-12"
          >
            {phase === "validating" ? "AI ocenia…" : "Wyślij odpowiedź"}
          </Button>
        </div>
      )}

      {phase === "feedback" && feedback && (
        <div className="space-y-4">
          <FeedbackCard feedback={feedback} userAnswer={userAnswer} reference={current.answer_reference} />
          <CalibrationButtons
            picked={calibrationPicked}
            onPick={(c) => void submitCalibration(c)}
          />
          <Button onClick={() => void goNext()} className="w-full h-12">
            Następne pytanie →
          </Button>
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
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
              Plusy
            </div>
            <div className="text-zinc-700 dark:text-zinc-200">{feedback.feedback_positive}</div>
          </div>
        )}
        {feedback.feedback_negative && (
          <div className="border-l-2 border-red-500 pl-3">
            <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300 mb-1">
              Minusy
            </div>
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

function CalibrationButtons({
  picked,
  onPick,
}: {
  picked: "agree" | "too_strict" | "too_lenient" | null;
  onPick: (c: "agree" | "too_strict" | "too_lenient") => void;
}) {
  const disabled = picked !== null;
  const cell = (key: "too_strict" | "agree" | "too_lenient", label: string) => (
    <Button
      key={key}
      size="sm"
      variant={picked === key ? "default" : "outline"}
      disabled={disabled}
      onClick={() => onPick(key)}
      className={picked === key ? "ring-2 ring-emerald-500" : ""}
    >
      {label}
      {picked === key && <span className="ml-1.5">✓</span>}
    </Button>
  );

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {picked ? "Dziękuję — kalibracja zapisana" : "Czy ocena AI była trafna?"}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cell("too_strict", "Za surowo")}
        {cell("agree", "Trafnie")}
        {cell("too_lenient", "Za pobłażliwie")}
      </div>
    </div>
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
