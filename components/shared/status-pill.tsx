import { cn } from "@/lib/utils";

export type StatusVariant =
  | "ready"
  | "processing"
  | "failed"
  | "correct"
  | "partial"
  | "incorrect"
  | "severity-low"
  | "severity-mid"
  | "severity-high";

const STYLE: Record<StatusVariant, string> = {
  ready: "bg-ok/15 text-ok",
  processing: "bg-warn/15 text-warn",
  failed: "bg-bad/15 text-bad",
  correct: "bg-ok/15 text-ok",
  partial: "bg-warn/15 text-warn",
  incorrect: "bg-bad/15 text-bad",
  "severity-low": "bg-elevated text-muted",
  "severity-mid": "bg-warn/15 text-warn",
  "severity-high": "bg-bad/15 text-bad",
};

export interface StatusPillProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-md",
        STYLE[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
