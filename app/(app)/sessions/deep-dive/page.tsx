import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";

interface MaterialOption {
  id: string;
  title: string;
  category: Category;
  status: MaterialStatus;
  open_count: number;
}

export default async function DeepDiveSelectorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Materials with at least one open question.
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, category, status")
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("imported_at", { ascending: false });

  const materialList = (materials ?? []) as Pick<MaterialOption, "id" | "title" | "category" | "status">[];

  // Count open items per material in one go.
  const counts = new Map<string, number>();
  if (materialList.length > 0) {
    const ids = materialList.map((m) => m.id);
    const { data: items } = await supabase
      .from("items")
      .select("material_id")
      .eq("type", "open")
      .in("material_id", ids);

    for (const row of items ?? []) {
      const id = (row as { material_id: string }).material_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const enriched: MaterialOption[] = materialList
    .map((m) => ({ ...m, open_count: counts.get(m.id) ?? 0 }))
    .filter((m) => m.open_count > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Deep Dive</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Wybierz materiał, na którym chcesz przepracować pytania otwarte. AI oceni Twoje odpowiedzi.
      </p>

      {enriched.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Brak materiałów do Deep Dive</CardTitle>
            <CardDescription>
              Zaimportuj jakiś materiał — wygenerujemy pytania otwarte automatycznie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/materials/import">+ Nowy materiał</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {enriched.map((m) => (
            <Link
              key={m.id}
              href={`/sessions/deep-dive/${m.id}`}
              className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium truncate">{m.title}</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {CATEGORY_LABELS[m.category]} • {m.open_count} pytań otwartych
                  </p>
                </div>
                <span className="text-sm text-zinc-500">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
