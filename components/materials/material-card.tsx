// Karta materiału na liście — używana w /materials, sposobi mastery, tagi i CTA.
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { MasteryBar, type MasterySegments } from "@/components/shared/mastery-bar";
import { CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export interface MaterialCardProps {
  id: string;
  title: string;
  category: Category;
  tags: string[];
  importedAt: string;
  /** Liczba fiszek cloze (objętych słupkiem opanowania). */
  clozeTotal: number;
  /** Liczba pytań otwartych Deep Dive (poza słupkiem). */
  openTotal: number;
  segments: MasterySegments;
  status?: MaterialStatus;
  isStale?: boolean;
}

export function MaterialCard({
  id,
  title,
  category,
  tags,
  clozeTotal,
  openTotal,
  segments,
  status = "ready",
  isStale,
}: MaterialCardProps) {
  const isFailed = status === "failed";

  return (
    <Link
      href={`/materials/${id}`}
      className={cn(
        "block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong",
        isStale && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <Chip variant="default">{CATEGORY_LABELS[category]}</Chip>
        {isFailed && <Chip variant="danger">Błąd</Chip>}
        <h3 className="flex-1 font-serif text-[18px] tracking-[-0.015em] text-fg line-clamp-2">
          {title}
        </h3>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.slice(0, 3).map((t, i) => (
            <Chip key={`${t}-${i}`} variant="default" size="sm">
              {t}
            </Chip>
          ))}
        </div>
      )}

      {isFailed ? (
        <p className="text-sm text-bad">
          Import nie zakończył się poprawnie. Materiał może być częściowy.
        </p>
      ) : (
        <>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            {clozeTotal} {pluralFiszki(clozeTotal)}
            {openTotal > 0 && ` · ${openTotal} ${pluralPytania(openTotal)}`}
          </p>
          <MasteryBar segments={segments} total={clozeTotal} showLegend />
        </>
      )}
    </Link>
  );
}

/** Polska odmiana: 1 fiszka, 2-4 fiszki, 5+ fiszek (z wyjątkiem nastek). */
function pluralFiszki(n: number): string {
  if (n === 1) return "fiszka";
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return "fiszki";
  return "fiszek";
}

/** Polska odmiana: 1 pytanie, 2-4 pytania, 5+ pytań (z wyjątkiem nastek). */
function pluralPytania(n: number): string {
  if (n === 1) return "pytanie";
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return "pytania";
  return "pytań";
}
