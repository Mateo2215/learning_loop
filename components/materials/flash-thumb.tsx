// Miniatura fiszki w widoku szczegółu materiału (zakładka "Fiszki").
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

export interface FlashThumbProps {
  index: number;
  front: string;
  back?: string | null;
  kind?: string;
  stabilityDays: number | null;
  dueDate: string | null;
}

export function FlashThumb({
  index,
  front,
  back,
  kind,
  stabilityDays,
  dueDate,
}: FlashThumbProps) {
  const dots = strengthDots(stabilityDays);
  const dueText = formatDue(dueDate);

  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3 hover:border-line-strong transition-colors">
      <div className="flex items-center justify-between">
        {kind ? (
          <Chip variant="accent" size="sm">
            {kind}
          </Chip>
        ) : (
          <span />
        )}
        <span className="font-mono text-[10px] text-muted">
          #{String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <p className="font-serif text-[15px] tracking-[-0.005em] text-fg line-clamp-3">
        {front}
      </p>

      {back && (
        <p className="font-mono text-[11px] text-muted line-clamp-2 pt-2 border-t border-dashed border-line">
          {back}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 mt-auto">
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < dots.filled ? dots.color : "bg-elevated",
              )}
            />
          ))}
        </div>
        {dueText && (
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {dueText}
          </span>
        )}
      </div>
    </div>
  );
}

function strengthDots(stabilityDays: number | null): {
  filled: number;
  color: string;
} {
  if (stabilityDays === null || stabilityDays === undefined) {
    return { filled: 0, color: "bg-muted/50" };
  }
  if (stabilityDays < 1) return { filled: 1, color: "bg-warn" };
  if (stabilityDays < 7) return { filled: 2, color: "bg-accent" };
  if (stabilityDays < 30) return { filled: 4, color: "bg-ok" };
  return { filled: 5, color: "bg-ok" };
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d temu`;
  if (days === 0) return "Dziś";
  if (days === 1) return "Jutro";
  return `Za ${days} dni`;
}
