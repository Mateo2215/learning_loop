// Karta pytania otwartego w zakładce "Pytania otwarte".
import { Chip } from "@/components/ui/chip";

export interface QuestionItemProps {
  index: number;
  question: string;
  reference?: string | null;
  kind?: string;
}

export function QuestionItem({
  index,
  question,
  reference,
  kind,
}: QuestionItemProps) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
          P{String(index + 1).padStart(2, "0")}
        </span>
        {kind && <Chip variant="default">{kind}</Chip>}
      </div>
      <p className="font-serif text-[18px] tracking-[-0.005em] leading-snug text-fg mb-3">
        {question}
      </p>
      {reference && (
        <p className="text-[13px] text-subtle line-clamp-2">{reference}</p>
      )}
    </div>
  );
}
