import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type Item, type Material } from "@/lib/db/types";
import { type EditableItem } from "./item-list-client";
import { ItemsTabs } from "./items-tabs";
import { GapLinkBanner } from "./gap-link-banner";
import { Tag } from "@/components/shared/tag";
import { StatusPill } from "@/components/shared/status-pill";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    .select("id, type, question, answer_reference, difficulty, edit_count")
    .eq("material_id", id)
    .is("audit_id", null)
    .order("created_at", { ascending: true });

  const m = material as Material;
  const itemList = (items ?? []) as Pick<Item, "id" | "type" | "question" | "answer_reference" | "difficulty" | "edit_count">[];
  const clozeItems: EditableItem[] = itemList.filter((i) => i.type === "cloze");
  const openItems: EditableItem[] = itemList.filter((i) => i.type === "open");

  let suggestedGap: { id: string; title: string | null } | null = null;
  if (m.suggested_gap_id) {
    const { data: g } = await supabase
      .from("knowledge_gaps")
      .select("id, title")
      .eq("id", m.suggested_gap_id)
      .maybeSingle();
    if (g) suggestedGap = g as { id: string; title: string | null };
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/materials">← Wszystkie materiały</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={`/sessions/deep-dive/${id}`}>Zacznij Deep Dive →</Link>
        </Button>
      </div>

      {suggestedGap && (
        <GapLinkBanner
          materialId={m.id}
          gapTitle={suggestedGap.title ?? "Otwarta luka"}
        />
      )}

      <header className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-medium leading-tight tracking-tight">
          {m.title}
        </h1>
        <div className="mt-2 text-sm text-muted font-mono flex items-center gap-2 flex-wrap">
          <span>{CATEGORY_LABELS[m.category]}</span>
          <span>·</span>
          <span>{formatDate(m.imported_at)}</span>
          {m.status !== "ready" && (
            <>
              <span>·</span>
              <StatusPill variant={m.status === "processing" ? "processing" : "failed"}>
                {m.status === "processing" ? "W trakcie" : "Błąd"}
              </StatusPill>
            </>
          )}
        </div>
        {m.tags && m.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {m.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </header>

      {m.content_compressed ? (
        <article className="text-sm whitespace-pre-wrap text-subtle leading-relaxed border-y border-line py-5 max-h-[28rem] overflow-y-auto">
          {m.content_compressed}
        </article>
      ) : (
        <p className="text-sm text-muted">Treść jeszcze nie jest gotowa.</p>
      )}

      <ItemsTabs cloze={clozeItems} open={openItems} />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
