import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SidePanelHistoryEntry {
  date: string;
  rating: "again" | "hard" | "good" | "easy" | "new";
  label: string;
}

export interface SidePanelUpcoming {
  id: string;
  text: string;
  kind?: "card" | "open";
}

export interface SidePanelStat {
  value: ReactNode;
  label: string;
  mono?: boolean;
}

export interface SessionSidePanelProps {
  /** Source quote shown in "Z źródła". */
  sourceQuote?: string | null;
  /** Recent reviews of the active card. */
  history?: SidePanelHistoryEntry[];
  /** Up to 3 upcoming items in the queue. */
  upcoming?: SidePanelUpcoming[];
  /** Up to 4 KPI stats. */
  stats?: SidePanelStat[];
  className?: string;
}

const RATING_COLOR: Record<SidePanelHistoryEntry["rating"], string> = {
  again: "text-bad",
  hard: "text-warn",
  good: "text-ok",
  easy: "text-accent-2",
  new: "text-muted",
};

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-[13px] text-muted">—</div>;
}

/**
 * Right-hand context column for review sessions. Hidden below `lg`.
 * Renders source quote, card history, upcoming queue, and session KPIs.
 */
export function SessionSidePanel({
  sourceQuote,
  history,
  upcoming,
  stats,
  className,
}: SessionSidePanelProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-[296px] shrink-0 border-l border-line bg-canvas",
        "p-6 gap-7 overflow-y-auto",
        className,
      )}
    >
      <section>
        <Label>Z źródła</Label>
        {sourceQuote ? (
          <blockquote className="font-serif italic text-[14px] leading-relaxed text-subtle border-l-2 border-accent pl-3">
            {sourceQuote}
          </blockquote>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <Label>Historia karty</Label>
        {history && history.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {history.slice(0, 3).map((h, i) => (
              <li key={`${h.date}-${i}`} className="flex justify-between text-[12px]">
                <span className="text-muted">{h.date}</span>
                <span className={cn("font-medium", RATING_COLOR[h.rating])}>{h.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <Label>Następne</Label>
        {upcoming && upcoming.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {upcoming.slice(0, 3).map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-surface border border-line"
              >
                <span
                  className={cn(
                    "font-mono text-[10px] shrink-0",
                    u.kind === "open" ? "text-accent-2" : "text-muted",
                  )}
                >
                  {u.id}
                </span>
                <span
                  className={cn(
                    "text-[12px] truncate",
                    u.kind === "open" ? "text-accent-2" : "text-subtle",
                  )}
                >
                  {u.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </section>

      <section>
        <Label>Statystyki sesji</Label>
        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {stats.slice(0, 4).map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                <div
                  className={cn(
                    "leading-none",
                    s.mono ? "font-mono text-[13px]" : "font-serif text-[18px]",
                  )}
                >
                  {s.value}
                </div>
                <div className="text-[10px] text-muted mt-1.5">{s.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </aside>
  );
}
