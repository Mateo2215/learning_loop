"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ProgressStrip } from "@/components/shared/progress-strip";
import { queueReview } from "@/lib/offline/queue";
import { startSession, type ActiveSessionInfo } from "@/lib/sessions/start-client";
import { ActiveSessionPrompt } from "@/components/sessions/active-session-prompt";
import { ScreenMessage } from "@/components/sessions/screen-message";
import { SessionHeader } from "@/components/sessions/session-header";
import { CardStack3D } from "@/components/sessions/card-stack-3d";
import { GradingButtons } from "@/components/sessions/grading-buttons";
import { SessionSidePanel, type SidePanelHistoryEntry } from "@/components/sessions/session-side-panel";

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
  preview_intervals?: Partial<Record<1 | 2 | 3 | 4, string>>;
}

interface SessionStartResponse {
  session_id: string;
  started_at: string;
  items: ReviewItem[];
}

type Phase = "loading" | "empty" | "cap_reached" | "conflict" | "answering" | "revealed" | "done" | "error";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ReviewSessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);
  const [capBlocked, setCapBlocked] = useState<number>(0);
  const [activeConflict, setActiveConflict] = useState<ActiveSessionInfo | null>(null);
  const [takingOver, setTakingOver] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(0);
  const [cardHistory, setCardHistory] = useState<SidePanelHistoryEntry[]>([]);
  const lastFetchedItemId = useRef<string | null>(null);
  const submittedItemIds = useRef<Set<string>>(new Set());
  const sessionEndPromise = useRef<Promise<void> | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [startingNext, setStartingNext] = useState(false);

  const startReview = useCallback(async (force: boolean) => {
    setPhase("loading");
    setErrorMessage(null);
    setSessionId(null);
    setItems([]);
    setIndex(0);
    setAnsweredCount(0);
    setQuestionShownAt(0);
    setStartedAt(null);
    setNow(0);
    setCardHistory([]);
    lastFetchedItemId.current = null;
    submittedItemIds.current.clear();
    sessionEndPromise.current = null;
    const stored = sessionStorage.getItem("review_options");
    sessionStorage.removeItem("review_options");
    const extra = stored ? (JSON.parse(stored) as { shuffle?: boolean; material_id?: string }) : {};
    const result = await startSession<SessionStartResponse>({ mode: "review", item_count: 20, force, ...extra });
    if (result.kind === "conflict") {
      setActiveConflict(result.active);
      setPhase("conflict");
      return;
    }
    if (result.kind === "cap_reached") {
      setCapBlocked(result.blocked);
      setPhase("cap_reached");
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
    setStartedAt(new Date(data.started_at).getTime());
    setNow(Date.now());
    setPhase(data.items.length === 0 ? "empty" : "answering");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startReview(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startReview]);

  // Tick once per second to drive the header timer.
  useEffect(() => {
    if (phase !== "answering" && phase !== "revealed") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const submitRating = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!sessionId) return;
      const item = items[index];
      if (!item) return;
      if (submittedItemIds.current.has(item.id)) return;
      submittedItemIds.current.add(item.id);

      const responseTime = Date.now() - questionShownAt;
      const next = index + 1;
      const isLast = next >= items.length;

      // Optimistic UI: advance immediately. Background sync handles persistence.
      setAnsweredCount((n) => n + 1);
      if (isLast) {
        setPhase("done");
        setEndingSession(true);
      } else {
        setIndex(next);
        setQuestionShownAt(Date.now());
        setPhase("answering");
      }

      const persistAnswer = (async () => {
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
          } finally {
            if (isLast) setEndingSession(false);
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
          await queueReview({
            session_id: sessionId,
            item_id: item.id,
            fsrs_rating: rating,
            response_time_ms: responseTime,
          });
          toast.error("Brak sieci — zapisano lokalnie");
        } finally {
          if (isLast) setEndingSession(false);
        }
      })();

      if (isLast) {
        sessionEndPromise.current = persistAnswer;
      } else {
        void persistAnswer;
      }
    },
    [sessionId, items, index, questionShownAt]
  );

  const startNextReviewSession = useCallback(async () => {
    if (startingNext) return;
    setStartingNext(true);
    try {
      await sessionEndPromise.current;
      await startReview(false);
    } finally {
      setStartingNext(false);
    }
  }, [startReview, startingNext]);

  // Fetch card history whenever the active item changes.
  useEffect(() => {
    const item = items[index];
    if (!item || item.id === lastFetchedItemId.current) return;
    lastFetchedItemId.current = item.id;
    setCardHistory([]);
    fetch(`/api/items/${item.id}/history`)
      .then((r) => r.ok ? r.json() : null)
      .then((body) => {
        if (body?.history) setCardHistory(body.history as SidePanelHistoryEntry[]);
      })
      .catch(() => {});
  }, [items, index]);

  // Spacja = pokaż odpowiedź. Cyfry 1–4 obsługuje GradingButtons.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === "answering" && e.code === "Space") {
        e.preventDefault();
        setPhase("revealed");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const handleClose = useCallback(() => {
    if (phase === "answering" || phase === "revealed") {
      const confirmed = window.confirm("Zakończyć sesję? Postęp zostanie zapisany.");
      if (!confirmed) return;
      if (sessionId) {
        void fetch(`/api/sessions/${sessionId}/end`, { method: "POST" }).catch(() => {});
      }
    }
    router.push("/dashboard");
  }, [phase, router, sessionId]);

  const elapsedLabel = useMemo(() => {
    if (!startedAt) return undefined;
    return formatElapsed(now - startedAt);
  }, [startedAt, now]);

  // Build side panel data from in-flight session state.
  const upcomingPanel = useMemo(() => {
    return items.slice(index + 1, index + 4).map((it) => ({
      id: it.id,
      displayId: `#${it.fsrs_review_count + 1}`,
      text: it.question.replace(/\{\{c1::([^}]+)\}\}/g, "______"),
      kind: "card" as const,
    }));
  }, [items, index]);

  const sessionStats = useMemo(() => {
    const total = items.length;
    const accuracy = answeredCount === 0 ? "—" : `${Math.round((answeredCount / total) * 100)}%`;
    return [
      { value: `${answeredCount}/${total}`, label: "odpowiedzi" },
      { value: accuracy, label: "ukończono" },
      { value: elapsedLabel ?? "00:00", label: "czas", mono: true },
    ];
  }, [items.length, answeredCount, elapsedLabel]);

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

  if (phase === "cap_reached") {
    return (
      <ScreenMessage
        title="Dzienny limit nowych kart"
        description={`Na dziś wprowadzono już 50 nowych fiszek. Pozostałe ${capBlocked} czekają na jutro — albo możesz powtórzyć je teraz mimo limitu.`}
        action={
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                setPhase("loading");
                const stored = sessionStorage.getItem("review_options");
                sessionStorage.removeItem("review_options");
                const extra = stored ? (JSON.parse(stored) as { shuffle?: boolean; material_id?: string }) : {};
                const result = await startSession<SessionStartResponse>({ mode: "review", item_count: 20, force: false, bypass_new_limit: true, ...extra });
                if (result.kind === "ok") {
                  const data = result.data;
                  setSessionId(data.session_id);
                  setItems(data.items);
                  setIndex(0);
                  setAnsweredCount(0);
                  setQuestionShownAt(Date.now());
                  setStartedAt(new Date(data.started_at).getTime());
                  setPhase(data.items.length === 0 ? "empty" : "answering");
                } else {
                  setPhase("empty");
                }
              }}
            >
              Powtórz mimo limitu →
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>← Dashboard</Button>
          </div>
        }
      />
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
            <Button onClick={startNextReviewSession} disabled={endingSession || startingNext}>
              {endingSession || startingNext ? "Startuję..." : "Kolejna sesja"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
        }
      />
    );
  }

  const current = items[index];
  if (!current) return null;
  const cloze = current.cloze_data;

  const questionText = current.question.replace(/\{\{c1::([^}]+)\}\}/g, "______");
  const revealedFront = cloze ? cloze.front.replace(/\{\{c1::([^}]+)\}\}/g, "$1") : current.question;

  const isRevealed = phase === "revealed";
  const remaining = items.length - index - 1;
  const behindCount = Math.min(2, Math.max(0, remaining));

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <SessionHeader
        current={index + 1}
        total={items.length}
        elapsedLabel={elapsedLabel}
        onClose={handleClose}
      />

      <div className="px-4 sm:px-6 py-3 border-b border-line bg-canvas">
        <ProgressStrip total={items.length} current={index} done={answeredCount} />
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 gap-8">
          <CardStack3D
            frontText={isRevealed ? revealedFront : questionText}
            backText={
              isRevealed && current.answer_reference ? (
                <p className="italic">{current.answer_reference}</p>
              ) : undefined
            }
            isRevealed={isRevealed}
            onReveal={() => setPhase("revealed")}
            behindCount={behindCount}
            meta={
              current.is_leech ? (
                <span className="inline-flex items-center gap-1 text-warn font-mono text-[10px] uppercase tracking-[0.18em]">
                  <span className="h-2 w-2 rounded-full bg-warn" />
                  leech
                </span>
              ) : (
                <span className="font-mono text-[11px] text-muted">
                  {current.fsrs_review_count === 0 ? "Nowa" : `#${current.fsrs_review_count + 1}`}
                </span>
              )
            }
          />

          {!isRevealed ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={() => setPhase("revealed")}
                className="bg-accent text-accent-fg hover:bg-accent/90 px-6 py-3 rounded-lg font-medium text-[14px] inline-flex items-center gap-2 min-h-12"
              >
                Pokaż odpowiedź
              </Button>
              <div className="text-[12px] text-muted flex items-center gap-2">
                <Kbd>Spacja</Kbd>
                <span>aby pokazać</span>
              </div>
            </div>
          ) : (
            <GradingButtons onRate={submitRating} intervals={current.preview_intervals} />
          )}
        </div>

        <SessionSidePanel
          sourceQuote={current.answer_reference ?? null}
          history={cardHistory.length > 0 ? cardHistory : undefined}
          upcoming={upcomingPanel}
          stats={sessionStats}
        />
      </div>
    </div>
  );
}
