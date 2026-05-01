import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, type Item, type Material } from "@/lib/db/types";

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
    .select("id, type, question, answer_reference, difficulty")
    .eq("material_id", id)
    .order("created_at", { ascending: true });

  const m = material as Material;
  const itemList = (items ?? []) as Pick<Item, "id" | "type" | "question" | "answer_reference" | "difficulty">[];
  const clozeItems = itemList.filter((i) => i.type === "cloze");
  const openItems = itemList.filter((i) => i.type === "open");

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

      <Card className="mb-6">
          <CardHeader>
            <CardTitle>{m.title}</CardTitle>
            <CardDescription>
              {CATEGORY_LABELS[m.category]} • {formatDate(m.imported_at)} •{" "}
              {m.status === "ready" ? "Gotowy" : m.status === "processing" ? "W trakcie…" : "Błąd"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {m.tags && m.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {m.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {m.content_compressed ? (
              <div className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {m.content_compressed}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Treść jeszcze nie jest gotowa.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Fiszki ({clozeItems.length})</CardTitle>
            <CardDescription>Pytania typu cloze do sesji Review.</CardDescription>
          </CardHeader>
          <CardContent>
            {clozeItems.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak fiszek.</p>
            ) : (
              <ul className="space-y-3">
                {clozeItems.map((item) => (
                  <li key={item.id} className="text-sm border-l-2 border-zinc-300 dark:border-zinc-700 pl-3">
                    <div className="text-zinc-900 dark:text-zinc-100">{item.question}</div>
                    {item.answer_reference && (
                      <div className="text-xs text-zinc-500 mt-1">→ {item.answer_reference}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pytania otwarte ({openItems.length})</CardTitle>
            <CardDescription>Pytania na sesje Deep Dive.</CardDescription>
          </CardHeader>
          <CardContent>
            {openItems.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak pytań otwartych.</p>
            ) : (
              <ul className="space-y-4">
                {openItems.map((item) => (
                  <li key={item.id} className="text-sm border-l-2 border-zinc-300 dark:border-zinc-700 pl-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.question}
                    </div>
                    {item.answer_reference && (
                      <div className="text-xs text-zinc-500 mt-1 italic">
                        Wzorzec: {item.answer_reference}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
