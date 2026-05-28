"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type Category } from "@/lib/db/types";

export interface PreviewMaterial {
  id: string;
  title: string;
  category: Category;
  open_count: number;
}

export interface PreviewStats {
  total_open: number;
  due_today: number;
  mastered: number;
  total_reviews: number;
  avg_score: number | null;
  sample_size: number;
  last_session_ended_at: string | null;
  sparkline: number[];
  last_review: {
    question: string;
    user_answer: string | null;
    score: number | null;
    ai_feedback_positive: string | null;
    ai_feedback_negative: string | null;
  } | null;
}

export function DeepDivePreview({
  material,
  stats,
  roundSize,
}: {
  material: PreviewMaterial;
  stats: PreviewStats;
  roundSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-scroll on mobile when selection changes — desktop side-by-side
  // layout doesn't need it.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [material.id]);

  const roundCount = Math.min(material.open_count, roundSize);
  const masteryState = getMasteryState(stats);

  return (
    <div
      ref={ref}
      className="bg-surface border border-line rounded-2xl p-4 sm:p-6 lg:p-8 flex flex-col gap-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Chip variant="default" size="sm">
            {CATEGORY_LABELS[material.category]}
          </Chip>
          <h2 className="font-serif text-[24px] sm:text-[28px] tracking-[-0.01em] leading-tight mt-3 text-fg break-words">
            {material.title}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-serif text-[20px] leading-none tracking-[-0.01em] text-fg">
            {material.open_count}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-1">
            {material.open_count === 1 ? "pytanie" : "pytań"}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <ScoreHero
          score={stats.avg_score}
          sparkline={stats.sparkline}
          sampleSize={stats.sample_size}
        />
        <MasteryHero
          state={masteryState}
          mastered={stats.mastered}
          total={stats.total_open}
          dueToday={stats.due_today}
          lastSessionEndedAt={stats.last_session_ended_at}
        />
      </div>

      {stats.last_review && (
        <section className="border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Ostatnia odpowiedź
            </div>
            {stats.last_review.score !== null && (
              <div className="font-mono text-[11px] text-subtle">
                {stats.last_review.score}/10
              </div>
            )}
          </div>
          <p className="text-[14px] text-fg leading-relaxed mb-2">
            {stats.last_review.question}
          </p>
          {stats.last_review.user_answer && (
            <p className="text-[13px] text-subtle italic mb-2 leading-relaxed">
              „{stats.last_review.user_answer}”
            </p>
          )}
          {stats.last_review.ai_feedback_positive && (
            <p className="text-[13px] text-muted leading-relaxed">
              <span className="text-ok">+ </span>
              {stats.last_review.ai_feedback_positive}
            </p>
          )}
          {stats.last_review.ai_feedback_negative && (
            <p className="text-[13px] text-muted leading-relaxed">
              <span className="text-bad">− </span>
              {stats.last_review.ai_feedback_negative}
            </p>
          )}
        </section>
      )}

      <div className="border-t border-line pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="font-mono text-[11px] text-muted">
          {stats.total_reviews} {pluralReps(stats.total_reviews)}
          {stats.last_session_ended_at && (
            <> · ostatnia sesja {formatRelative(stats.last_session_ended_at)}</>
          )}
        </div>
        <Button
          asChild
          className="w-full sm:w-auto h-12 sm:h-11 text-[14px] font-medium"
        >
          <Link href={`/sessions/deep-dive/${material.id}`}>
            Zacznij rundę {roundCount} {pluralQuestions(roundCount)}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

type MasteryState =
  | { kind: "fresh" }
  | { kind: "due"; dueToday: number }
  | { kind: "normal" };

function getMasteryState(stats: PreviewStats): MasteryState {
  if (stats.total_reviews === 0) return { kind: "fresh" };
  if (stats.due_today > 0) return { kind: "due", dueToday: stats.due_today };
  return { kind: "normal" };
}

function ScoreHero({
  score,
  sparkline,
  sampleSize,
}: {
  score: number | null;
  sparkline: number[];
  sampleSize: number;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
        Średnia ocena AI
      </div>
      {score === null ? (
        <>
          <div className="font-serif text-[40px] leading-none tracking-[-0.02em] text-muted">
            —
          </div>
          <div className="mt-3 h-[28px]" />
          <div className="font-mono text-[11px] text-muted mt-2">brak danych</div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-[40px] leading-none tracking-[-0.02em] text-fg">
              {score.toFixed(1)}
            </span>
            <span className="font-serif text-[18px] text-muted">/10</span>
          </div>
          {sparkline.length >= 2 ? (
            <div className="mt-3 flex items-center gap-2">
              <Sparkline values={sparkline} />
              <span className="font-mono text-[11px] text-subtle">
                {sparkline[sparkline.length - 1]}
              </span>
            </div>
          ) : (
            <div className="mt-3 h-[28px]" />
          )}
          <div className="font-mono text-[11px] text-muted mt-2">
            średnia z {sampleSize} {sampleSize === 1 ? "odpowiedzi" : "odpowiedzi"}
          </div>
        </>
      )}
    </div>
  );
}

function MasteryHero({
  state,
  mastered,
  total,
  dueToday,
  lastSessionEndedAt,
}: {
  state: MasteryState;
  mastered: number;
  total: number;
  dueToday: number;
  lastSessionEndedAt: string | null;
}) {
  const lastLabel = lastSessionEndedAt
    ? `Ostatnio: ${formatRelative(lastSessionEndedAt)}`
    : "Jeszcze nie zaczynałeś";

  if (state.kind === "fresh") {
    return (
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Postęp
        </div>
        <div className="font-serif text-[24px] leading-tight tracking-[-0.01em] text-fg">
          świeży materiał
        </div>
        <div className="mt-3 h-[28px]" />
        <div className="font-mono text-[11px] text-muted mt-2">{lastLabel}</div>
      </div>
    );
  }

  if (state.kind === "due") {
    return (
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-warn mb-2">
          Do powtórki
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] leading-none tracking-[-0.02em] text-warn">
            {dueToday}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-warn">
            due dzisiaj
          </span>
        </div>
        <ProgressBar mastered={mastered} total={total} />
        <div className="font-mono text-[11px] text-muted mt-2">{lastLabel}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
        Postęp
      </div>
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="font-serif text-[40px] leading-none tracking-[-0.02em] text-fg">
          {mastered}
        </span>
        <span className="font-serif text-[18px] text-muted">/{total}</span>
        <span
          className="ml-2 font-mono text-[11px] uppercase tracking-wide text-subtle underline decoration-dotted underline-offset-2 cursor-help"
          title="Pytanie uznane za opanowane gdy FSRS stability ≥ 7 dni — system szacuje że zapamiętasz je co najmniej tydzień."
        >
          opanowane
        </span>
      </div>
      <ProgressBar mastered={mastered} total={total} />
      <div className="font-mono text-[11px] text-muted mt-2">{lastLabel}</div>
    </div>
  );
}

function ProgressBar({ mastered, total }: { mastered: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((mastered / total) * 100)) : 0;
  return (
    <div className="mt-3 h-2 w-full bg-accent-soft rounded-full overflow-hidden">
      <div
        className="h-full bg-accent transition-all"
        style={{ width: `${pct}%` }}
        aria-label={`${pct}% opanowanych`}
      />
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 140;
  const h = 28;
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 0.001);
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * h;
    return { x, y };
  });
  const polyline = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="text-accent"
      aria-hidden
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="currentColor" />
    </svg>
  );
}

function pluralReps(n: number): string {
  if (n === 1) return "powtórka";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return "powtórki";
  }
  return "powtórek";
}

function pluralQuestions(n: number): string {
  if (n === 1) return "pytania";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return "pytania";
  }
  return "pytań";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? "przed chwilą" : `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "dzień" : "dni"} temu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "tydz." : "tyg."} temu`;
  const months = Math.floor(days / 30);
  return `${months} mies. temu`;
}
