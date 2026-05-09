import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Shuffle,
  Sparkles,
  Play,
  FileText,
  Globe,
  FileEdit,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Chip } from "@/components/ui/chip";
import { MasteryBar } from "@/components/shared/mastery-bar";
import { CATEGORY_LABELS, type Item, type Material } from "@/lib/db/types";
import { ItemsTabs, type ClozeItem, type OpenItem } from "./items-tabs";
import { GapLinkBanner } from "./gap-link-banner";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!material) notFound();

  const { data: items } = await supabase
    .from("items")
    .select(
      "id, type, question, answer_reference, difficulty, cloze_data, fsrs_stability, fsrs_due_date, tags",
    )
    .eq("material_id", id)
    .is("audit_id", null)
    .order("created_at", { ascending: true });

  const m = material as Material;
  type RowItem = Pick<
    Item,
    | "id"
    | "type"
    | "question"
    | "answer_reference"
    | "difficulty"
    | "cloze_data"
    | "fsrs_stability"
    | "fsrs_due_date"
    | "tags"
  >;
  const itemList = (items ?? []) as RowItem[];

  const cloze: ClozeItem[] = itemList
    .filter((i) => i.type === "cloze")
    .map((i) => ({
      id: i.id,
      front: i.cloze_data?.front ?? i.question,
      back: i.cloze_data?.answer ?? i.answer_reference,
      kind: i.tags?.[0] ?? i.difficulty ?? undefined,
      stabilityDays: i.fsrs_stability,
      dueDate: i.fsrs_due_date,
    }));

  const openItems: OpenItem[] = itemList
    .filter((i) => i.type === "open")
    .map((i) => ({
      id: i.id,
      question: i.question,
      reference: i.answer_reference,
      kind: i.tags?.[0] ?? i.difficulty ?? undefined,
    }));

  const segments = computeSegments(itemList);
  const masteredPct = computePct(segments, itemList.length);

  let suggestedGap: { id: string; title: string | null } | null = null;
  if (m.suggested_gap_id) {
    const { data: g } = await supabase
      .from("knowledge_gaps")
      .select("id, title")
      .eq("id", m.suggested_gap_id)
      .maybeSingle();
    if (g) suggestedGap = g as { id: string; title: string | null };
  }

  const SourceIcon = pickSourceIcon(m.source_type);
  const quote = extractQuote(m.content_compressed);

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      {/* Breadcrumb + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <nav className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.15em] text-muted">
          <Link
            href="/materials"
            className="inline-flex items-center gap-1 hover:text-fg transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Materiały
          </Link>
          <span>/</span>
          <Link
            href={`/materials?cat=${m.category}`}
            className="hover:text-fg transition-colors"
          >
            {CATEGORY_LABELS[m.category]}
          </Link>
          <span>/</span>
          <span className="text-subtle truncate max-w-[200px]">{m.title}</span>
        </nav>

        <div className="flex items-center gap-2">
          {/* TODO(shuffle): wymaga endpointu — placeholder na Fazę 2. */}
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 border border-line bg-surface text-muted px-3 py-1.5 rounded-lg text-[12px] cursor-not-allowed"
            title="Wkrótce"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Tasuj
          </button>
          {/* TODO(generate-more): podpiąć API gdy dostępne. */}
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 border border-line bg-surface text-muted px-3 py-1.5 rounded-lg text-[12px] cursor-not-allowed"
            title="Wkrótce"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Wygeneruj nowe
          </button>
          <Link
            href={`/sessions/deep-dive/${m.id}`}
            className="inline-flex items-center gap-1.5 bg-accent text-accent-fg px-3 py-1.5 rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <Play className="h-3.5 w-3.5" />
            Start sesji
          </Link>
        </div>
      </div>

      {suggestedGap && (
        <div className="mb-6">
          <GapLinkBanner
            materialId={m.id}
            gapTitle={suggestedGap.title ?? "Otwarta luka"}
          />
        </div>
      )}

      {/* Title + meta + mastery */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="md:w-[200px] shrink-0">
          <div className="bg-elevated border border-line rounded-lg aspect-[3/4] w-full md:w-[200px] flex flex-col items-center justify-center p-4">
            <SourceIcon className="h-12 w-12 text-muted mb-3" />
            {m.source_filename && (
              <span className="text-[12px] font-mono text-muted text-center line-clamp-2 break-all">
                {m.source_filename}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[36px] tracking-[-0.015em] leading-[1.05] text-fg mb-4">
            {m.title}
          </h1>
          <div className="flex flex-wrap gap-1.5 mb-6">
            <Chip variant="default">{CATEGORY_LABELS[m.category]}</Chip>
            {m.tags?.map((t, i) => (
              <Chip key={`${t}-${i}`} variant="default">
                {t}
              </Chip>
            ))}
            <Chip variant="default">{formatDate(m.imported_at)}</Chip>
            <Chip variant="accent">{itemList.length} pytań</Chip>
          </div>

          <div className="max-w-xl">
            <MasteryBar
              segments={segments}
              total={itemList.length}
              showLegend
            />
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
              Twoje opanowanie · {masteredPct}%
            </div>
          </div>
        </div>
      </div>

      {/* Highlighted source quote */}
      {quote && (
        <blockquote className="font-serif italic text-[18px] text-subtle border-l-2 border-accent pl-4 my-8 max-w-2xl leading-relaxed">
          {quote}
        </blockquote>
      )}

      <ItemsTabs
        cloze={cloze}
        open={openItems}
        source={m.content_compressed}
        notes={{
          insight: m.insight_note,
          application: m.application_note,
        }}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function pickSourceIcon(t: string | null) {
  if (t === "url") return Globe;
  if (t === "paste") return FileEdit;
  return FileText;
}

function extractQuote(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  // Pierwsze zdanie albo do 280 znaków, zależnie co krótsze.
  const firstStop = trimmed.search(/[.!?]\s/);
  if (firstStop > 40 && firstStop < 280) {
    return trimmed.slice(0, firstStop + 1);
  }
  if (trimmed.length <= 280) return trimmed;
  return trimmed.slice(0, 280).replace(/\s\S*$/, "") + "…";
}

function computeSegments(items: Pick<Item, "fsrs_stability">[]): {
  mature: number;
  young: number;
  learning: number;
  new: number;
} {
  const seg = { mature: 0, young: 0, learning: 0, new: 0 };
  for (const it of items) {
    const s = it.fsrs_stability;
    if (s === null || s === undefined) seg.new += 1;
    else if (s >= 30) seg.mature += 1;
    else if (s >= 7) seg.young += 1;
    else seg.learning += 1;
  }
  return seg;
}

function computePct(
  s: { mature: number; young: number; learning: number; new: number },
  total: number,
): number {
  if (total === 0) return 0;
  return Math.round(((s.mature + s.young) / total) * 100);
}
