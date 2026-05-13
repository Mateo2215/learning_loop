"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { ProgressStrip } from "@/components/shared/progress-strip";
import { AnswerInput } from "@/components/sessions/answer-input";
import { SessionHeader } from "@/components/sessions/session-header";
import { startSession, type ActiveSessionInfo } from "@/lib/sessions/start-client";
import { ActiveSessionPrompt } from "@/components/sessions/active-session-prompt";
import { ScreenMessage } from "@/components/sessions/screen-message";
import { DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";
import { cn } from "@/lib/utils";

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
  material_title?: string | null;
  resumed?: boolean;
  completed_item_ids?: string[];
  next_index?: number;
}

interface AnswerResponse {
  review_id: string;
  evaluation: "correct" | "partially_correct" | "incorrect";
  feedback_positive: string;
  feedback_negative: string;
}

type Phase = "loading" | "empty" | "conflict" | "answering" | "validating" | "feedback" | "done" | "error";

export default function DeepDivePage({ params }: { params: Promise<{ material_id: string }> }) {
  const { material_id } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [materialTitle, setMaterialTitle] = useState<string>("Deep Dive");
  const [index, setIndex] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [calibrationPicked, setCalibrationPicked] = useState<"agree" | "too_strict" | "too_lenient" | null>(null);
  const [activeConflict, setActiveConflict] = useState<ActiveSessionInfo | null>(null);
  const [takingOver, setTakingOver] = useState(false);

  const startDeepDive = useCallback(async (force: boolean) => {
    setPhase("loading");
    const result = await startSession<SessionStartResponse>({
      mode: "deep_dive",
      material_id,
      item_count: DEEP_DIVE_ROUND_SIZE,
      force,
    });
    if (result.kind === "conflict") {
      setActiveConflict(result.active);
      setPhase("conflict");
      return;
    }
    if (result.kind === "empty" || result.kind === "cap_reached") {
      setPhase("empty");
      return;
    }
    if (result.kind === "error") {
      setPhase("error");
      setErrorMessage(result.message);
      return;
    }
    const data = result.data;
    setActiveConflict(null);
    setSessionId(data.session_id);
    setItems(data.items);
    if (data.material_title) setMaterialTitle(data.material_title);
    setIndex(data.next_index ?? 0);
    setUserAnswer("");
    setFeedback(null);
    setCalibrationPicked(null);
    setQuestionShownAt(Date.now());
    setPhase(data.items.length === 0 ? "empty" : "answering");
  }, [material_id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startDeepDive(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startDeepDive]);

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

  const handleClose = useCallback(() => {
    if ((phase === "answering" || phase === "validating") && userAnswer.trim().length > 0) {
      const confirmed = window.confirm(
        "Wyjść z rundy? Niewysłana odpowiedź zostanie utracona, ale Deep Dive będzie można wznowić."
      );
      if (!confirmed) return;
    }
    router.push("/sessions/deep-dive");
  }, [phase, userAnswer, router]);

  // Keyboard shortcuts: Cmd/Ctrl+Enter submit, Esc close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (phase === "answering") {
          e.preventDefault();
          void submitAnswer();
        } else if (phase === "feedback") {
          e.preventDefault();
          void goNext();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submitAnswer, goNext, handleClose]);

  if (phase === "loading") return <ScreenMessage title="Wczytuję rundę..." />;

  if (phase === "conflict" && activeConflict) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ActiveSessionPrompt
          active={activeConflict}
          takingOver={takingOver}
          onTakeOver={async () => {
            setTakingOver(true);
            await startDeepDive(true);
            setTakingOver(false);
          }}
          onCancel={() => router.push("/dashboard")}
        />
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <ScreenMessage
        title="Brak pytań otwartych"
        description="Ten materiał nie ma jeszcze pytań otwartych do rundy Deep Dive."
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
        title={`Runda zakończona - ${index + 1} pytań`}
        description="Świetna robota."
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/sessions/deep-dive">Inny materiał</Link>
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

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <SessionHeader
        title={materialTitle}
        current={index + 1}
        total={items.length}
        onClose={handleClose}
        closeLabel="Zamknij"
        right={
          <button
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-fg text-[13px] transition-colors"
          >
            Zamknij
          </button>
        }
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 max-w-[720px] mx-auto w-full">
        <div className="w-full flex flex-col gap-6">
          <div className="text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-3">
              Runda Deep Dive · pytanie {index + 1} z {items.length}
            </div>
            <h2 className="font-serif text-[28px] sm:text-[36px] leading-tight tracking-[-0.015em] text-fg max-w-[640px] mx-auto">
              {current.question}
            </h2>
          </div>

          {(phase === "answering" || phase === "validating") && (
            <>
              <AnswerInput
                value={userAnswer}
                onChange={setUserAnswer}
                disabled={phase === "validating"}
                autoFocus
                rows={8}
                mode="voice"
                onSubmitShortcut={() => void submitAnswer()}
              />

              <div className="flex items-center justify-between text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>⌘</Kbd>
                  <span>+</span>
                  <Kbd>↵</Kbd>
                  <span className="ml-1">Wyślij</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>Esc</Kbd>
                  <span>Wyjście</span>
                </span>
              </div>

              <Button
                onClick={() => void submitAnswer()}
                disabled={phase === "validating" || userAnswer.trim().length < 3}
                className="w-full min-h-12 text-[14px]"
              >
                {phase === "validating" ? "AI ocenia…" : "Wyślij odpowiedź"}
              </Button>
            </>
          )}

          {phase === "feedback" && feedback && (
            <div className="flex flex-col gap-4">
              <FeedbackCard feedback={feedback} userAnswer={userAnswer} reference={current.answer_reference} />
              <CalibrationButtons
                picked={calibrationPicked}
                onPick={(c) => void submitCalibration(c)}
              />
              <Button onClick={() => void goNext()} className="w-full min-h-12 text-[14px]">
                {index + 1 >= items.length ? "Zakończ rundę" : "Następne pytanie →"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-canvas py-3 px-4 sm:px-6">
        <ProgressStrip total={items.length} current={index} />
      </div>
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
            <div className="text-xs uppercase tracking-wide text-ok mb-1">
              Plusy
            </div>
            <div className="text-subtle">{feedback.feedback_positive}</div>
          </div>
        )}
        {feedback.feedback_negative && (
          <div className="border-l-2 border-bad pl-3">
            <div className="text-xs uppercase tracking-wide text-bad mb-1">
              Minusy
            </div>
            <div className="text-subtle">{feedback.feedback_negative}</div>
          </div>
        )}
        <FeedbackDetails userAnswer={userAnswer} reference={reference} />
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
  const cell = (
    key: "too_strict" | "agree" | "too_lenient",
    label: string,
    Icon: typeof AlertTriangle,
  ) => {
    const active = picked === key;
    return (
      <button
        key={key}
        type="button"
        disabled={disabled}
        onClick={() => onPick(key)}
        className={cn(
          "flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-lg border text-sm transition-colors",
          active
            ? "border-accent bg-accent-soft text-accent ring-1 ring-accent"
            : "border-line bg-surface text-subtle hover:border-accent/40",
          disabled && !active && "opacity-50",
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">
        {picked ? "Dziękuję — kalibracja zapisana" : "Czy ocena AI była trafna?"}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cell("too_strict", "Surowo", AlertTriangle)}
        {cell("agree", "Trafnie", Check)}
        {cell("too_lenient", "Pobłażliwie", Smile)}
      </div>
    </div>
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
