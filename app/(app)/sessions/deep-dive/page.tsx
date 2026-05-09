import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/shared/section-header";
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

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, category, status")
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("imported_at", { ascending: false });

  const materialList = (materials ?? []) as Pick<MaterialOption, "id" | "title" | "category" | "status">[];

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
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Deep Dive"
        sub="Wybierz materiał i odpowiedz na pytanie otwarte. AI oceni Twoje odpowiedzi."
      />

      {enriched.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <BookOpen size={48} className="text-muted" />
          <div>
            <h2 className="font-serif text-[20px] font-medium mb-1">Brak materiałów do Deep Dive</h2>
            <p className="text-[14px] text-muted max-w-md">
              Zaimportuj jakiś materiał — wygenerujemy pytania otwarte automatycznie.
            </p>
          </div>
          <Button asChild>
            <Link href="/materials/import">+ Nowy materiał</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 mt-8">
          <ul className="space-y-2">
            {enriched.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/sessions/deep-dive/${m.id}`}
                  className="block bg-surface border border-line rounded-xl p-4 hover:border-line-strong transition-colors"
                >
                  <Chip variant="default" size="sm" className="mb-2">
                    {CATEGORY_LABELS[m.category]}
                  </Chip>
                  <h3 className="font-serif text-[15px] leading-snug line-clamp-2">{m.title}</h3>
                  <p className="font-mono text-[11px] text-muted mt-2">
                    {m.open_count} {m.open_count === 1 ? "pytanie otwarte" : "pytań otwartych"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="bg-surface border border-line rounded-2xl p-8 lg:min-h-[360px] flex flex-col items-center justify-center text-center gap-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Wybierz materiał
            </div>
            <BookOpen size={48} className="text-muted" />
            <p className="text-[14px] text-muted max-w-sm">
              Po wyborze materiału z listy obok zaczniesz Deep Dive — AI oceni Twoje
              odpowiedzi i pomoże zidentyfikować luki.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
