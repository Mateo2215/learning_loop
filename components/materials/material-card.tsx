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
  itemsTotal: number;
  segments: MasterySegments;
  status?: MaterialStatus;
  isStale?: boolean;
}

export function MaterialCard({
  id,
  title,
  category,
  tags,
  itemsTotal,
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
        <MasteryBar segments={segments} total={itemsTotal} showLegend />
      )}
    </Link>
  );
}
