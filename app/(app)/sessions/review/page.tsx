"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type Phase = "loading" | "empty" | "answering" | "revealed" | "done" | "error";

export default function ReviewSessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [questionShownAt, setQuestionShownAt] = useState<number>(0);

  // Start session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "review", item_count: 20 }),
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
        setAnsweredCount(0);
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
  }, []);

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

      // Fire-and-forget: persist rating in background.
      void (async () => {
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
            const body = await res.json().catch(() => ({}));
            toast.error("Nie zapisano odpowiedzi", {
              description: body.error ?? `HTTP ${res.status}`,
            });
            return;
          }
          if (isLast) {
            await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
          }
        } catch {
          toast.error("Błąd sieci — odpowiedź nie zapisana");
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{index + 1} / {items.length}</span>
        <span className="flex items-center gap-2">
          {current.is_leech && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              title="Fiszka, której nie zapamiętujesz — wraca w rotacji co 7 dni."
            >
              leech
            </span>
          )}
          <span>{current.fsrs_review_count === 0 ? "Nowa fiszka" : `Powtórka #${current.fsrs_review_count + 1}`}</span>
        </span>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base font-normal leading-relaxed whitespace-pre-wrap">
            {phase === "revealed" && cloze
              ? cloze.front.replace(/\{\{c1::([^}]+)\}\}/g, "$1")
              : current.question.replace(/\{\{c1::([^}]+)\}\}/g, "______")}
          </CardTitle>
          {phase === "revealed" && cloze && (
            <CardDescription className="mt-3 text-emerald-700 dark:text-emerald-300 font-medium">
              Odpowiedź: {cloze.answer}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {phase === "answering" && (
        <Button className="w-full h-14 text-base" onClick={() => setPhase("revealed")}>
          Pokaż odpowiedź <span className="ml-3 text-xs opacity-60">(spacja)</span>
        </Button>
      )}

      {phase === "revealed" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RatingButton label="Again" hint="1" variant="destructive" onClick={() => submitRating(1)} />
          <RatingButton label="Hard" hint="2" variant="outline" onClick={() => submitRating(2)} />
          <RatingButton label="Good" hint="3" variant="default" onClick={() => submitRating(3)} />
          <RatingButton label="Easy" hint="4" variant="secondary" onClick={() => submitRating(4)} />
        </div>
      )}
    </div>
  );
}

function RatingButton({
  label,
  hint,
  onClick,
  variant,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  variant: "default" | "destructive" | "outline" | "secondary";
}) {
  return (
    <Button onClick={onClick} variant={variant} className="h-14 flex flex-col gap-0.5 text-sm">
      <span>{label}</span>
      <span className="text-xs opacity-60">{hint}</span>
    </Button>
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
