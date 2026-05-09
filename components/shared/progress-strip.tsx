import { cn } from "@/lib/utils";

export interface ProgressStripProps {
  total: number;
  current: number;
  done?: number;
  className?: string;
}

export function ProgressStrip({
  total,
  current,
  done,
  className,
}: ProgressStripProps) {
  if (total <= 0) return null;
  const completed = done ?? current;

  return (
    <div className={cn("flex w-full items-center gap-0.5", className)}>
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < completed;
        const isCurrent = i === current;
        return (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-sm transition-colors",
              isDone || isCurrent ? "bg-accent" : "bg-elevated",
            )}
          />
        );
      })}
    </div>
  );
}
