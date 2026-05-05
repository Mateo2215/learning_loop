"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { queueReview } from "@/lib/offline/queue";
import { startSession, type ActiveSessionInfo } from "@/lib/sessions/start-client";
import { ActiveSessionPrompt } from "@/components/sessions/active-session-prompt";
import { ScreenMessage } from "@/components/sessions/screen-message";
import { SessionShell } from "@/components/sessions/session-shell";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  material_id: string;
  type: "cloze";
  question: string;
  answer_reference: string | null;
  cloze_data: { front: string; answer: string } | null;
  difficulty: "easy" | "medium" | "hard" | null;
  fsrs_review_count: number;
  is_leech: boolean;
}

interface SessionStartResponse {
  session_id: string;
  started_at: string;
  items: ReviewItem[];
}

type Phase = "loading" | "empty" | "conflict" | "answering" | "revealed" | "done" | "error";

export default function ReviewSessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);
  const [activeConflict, setActiveConflict] = useState<ActiveSessionInfo | null>(null);
  const [takingOver, setTakingOver] = useState(false);

  const startReview = useCallback(async (force: boolean) => {
    setPhase("loading");
    const result = await startSession<SessionStartResponse>({ mode: "review", item_count: 20, force });
    if (result.kind === "conflict") {
      setActiveConflict(result.active);
      setPhase("conflict");
      return;
    }
    if (result.kind === "empty") {
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
    setIndex(0);
    setAnsweredCount(0);
    setQuestionShownAt(Date.now());
    setPhase(data.items.length === 0 ? "empty" : "answering");
  }, []);

  useEffect(() => {
    void startReview(false);
  }, [startReview]);

  const submitRating = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!sessionId) return;
      const item = items[index];
      if (!item) return;

      const responseTime = Date.now() - questionShownAt;
      const next = index + 1;
      const isLast = next >= items.length;

      // Optimistic: advance the UI immediately. If the network call fails the
      // toast surfaces it; the item stays in the queue for the next session.
      setAnsweredCount((n) => n + 1);
      if (isLast) {
        setPhase("done");
      } else {
        setIndex(next);
        setQuestionShownAt(Date.now());
        setPhase("answering");
      }

      // Persist rating: when offline, queue to IndexedDB; when online, hit the
      // server directly. Fire-and-forget either way.
      void (async () => {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        if (offline) {
          try {
            await queueReview({
              session_id: sessionId,
              item_id: item.id,
              fsrs_rating: rating,
              response_time_ms: responseTime,
            });
          } catch {
            toast.error("Nie udało się zapisać lokalnie");
          }
          return;
        }

        try {
          const res = await fetch(`/api/sessions/${sessionId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item_id: item.id,
              fsrs_rating: rating,
              response_time_ms: responseTime,
            }),
          });
          if (!res.ok) {
            // Network failed mid-request — fall back to queue so we don't lose the rating.
            await queueReview({
              session_id: sessionId,
              item_id: item.id,
              fsrs_rating: rating,
              response_time_ms: responseTime,
            });
            const body = await res.json().catch(() => ({}));
            toast.error("Zapisano lokalnie (ponowię)", {
              description: body.error ?? `HTTP ${res.status}`,
            });
            return;
          }
          if (isLast) {
            await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
          }
        } catch {
          // Network died — queue for later flush.
          await queueReview({
            session_id: sessionId,
            item_id: item.id,
            fsrs_rating: rating,
            response_time_ms: responseTime,
          });
          toast.error("Brak sieci — zapisano lokalnie");
        }
      })();
    },
    [sessionId, items, index, questionShownAt]
  );

  // Keyboard shortcuts: space = reveal, 1-4 = rating.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === "answering" && e.code === "Space") {
        e.preventDefault();
        setPhase("revealed");
      } else if (phase === "revealed") {
        if (e.key === "1") void submitRating(1);
        else if (e.key === "2") void submitRating(2);
        else if (e.key === "3") void submitRating(3);
        else if (e.key === "4") void submitRating(4);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, submitRating]);

  if (phase === "loading") {
    return <ScreenMessage title="Wczytuję sesję…" />;
  }

  if (phase === "conflict" && activeConflict) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ActiveSessionPrompt
          active={activeConflict}
          takingOver={takingOver}
          onTakeOver={async () => {
            setTakingOver(true);
            await startReview(true);
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
        title="Brak fiszek do powtórki"
        description="Wszystkie fiszki na dziś zostały już powtórzone, lub nie masz jeszcze żadnych zaimportowanych materiałów."
        action={
          <div className="flex gap-2">
            <Button onClick={() => router.push("/materials/import")}>+ Nowy materiał</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>← Dashboard</Button>
          </div>
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
        title={`Sesja zakończona — ${answeredCount} fiszek`}
        description="Świetna robota. FSRS zaplanowany na następne powtórki."
        action={
          <div className="flex gap-2">
            <Button onClick={() => router.refresh()}>Kolejna sesja</Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  const current = items[index];
  if (!current) return null;
  const cloze = current.cloze_data;

  const progress = items.length === 0 ? 0 : Math.round((answeredCount / items.length) * 100);

  const meta = (
    <>
      <span className="font-mono">{index + 1} / {items.length}</span>
      <span className="flex items-center gap-2">
        {current.is_leech && (
          <span
            className="inline-flex items-center gap-1 text-warn"
            title="Fiszka, której nie zapamiętujesz — wraca w rotacji co 7 dni."
          >
            <span className="h-2 w-2 rounded-full bg-warn" />
            leech
          </span>
        )}
        <span>{current.fsrs_review_count === 0 ? "Nowa" : `#${current.fsrs_review_count + 1}`}</span>
      </span>
    </>
  );

  const questionText = current.question.replace(/\{\{c1::([^}]+)\}\}/g, "______");
  const revealedText = cloze ? cloze.front.replace(/\{\{c1::([^}]+)\}\}/g, "$1") : current.question;

  return (
    <SessionShell
      progress={progress}
      meta={meta}
      hint={phase === "answering" ? "spacja = pokaż odpowiedź" : "1–4 = oceń"}
      bottom={
        phase === "answering" ? (
          <Button className="w-full min-h-14 text-base" onClick={() => setPhase("revealed")}>
            Pokaż odpowiedź
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <RatingButton digit={1} label="Again" tone="bad" onClick={() => submitRating(1)} />
            <RatingButton digit={2} label="Hard" tone="warn" onClick={() => submitRating(2)} />
            <RatingButton digit={3} label="Good" tone="ok" onClick={() => submitRating(3)} />
            <RatingButton digit={4} label="Easy" tone="accent" onClick={() => submitRating(4)} />
          </div>
        )
      }
    >
      <p className="font-serif text-2xl sm:text-4xl font-normal leading-tight tracking-tight text-center whitespace-pre-wrap">
        {phase === "revealed" ? revealedText : questionText}
      </p>
      {phase === "revealed" && cloze && (
        <div className="mt-8 mx-auto max-w-md border-t border-line pt-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center">
            Odpowiedź
          </div>
          <div className="font-mono text-base text-center bg-elevated px-4 py-3 rounded-lg text-fg">
            {cloze.answer}
          </div>
        </div>
      )}
    </SessionShell>
  );
}

function RatingButton({
  digit,
  label,
  tone,
  onClick,
}: {
  digit: number;
  label: string;
  tone: "bad" | "warn" | "ok" | "accent";
  onClick: () => void;
}) {
  const toneClass = {
    bad: "border-bad/40 hover:bg-bad/10 hover:border-bad",
    warn: "border-warn/40 hover:bg-warn/10 hover:border-warn",
    ok: "border-ok/40 hover:bg-ok/10 hover:border-ok",
    accent: "border-accent/40 hover:bg-accent/10 hover:border-accent",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-16 rounded-lg border bg-surface flex flex-col items-center justify-center gap-0.5 transition-colors",
        toneClass
      )}
    >
      <span className="font-serif text-2xl leading-none">{digit}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </button>
  );
}
