import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

interface FreshMaterial {
  id: string;
  title: string;
  imported_at: string;
  item_count: number;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  return `${h}h temu`;
}

/**
 * Hero widget — surfaces materials imported in the last 24h that the user has
 * not run a deep_dive or review session for yet. Renderowane bez Card chrome
 * jako górna sekcja dashboardu — to value prop appki, nie tabela statystyk.
 */
export async function FreshMaterials() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, imported_at")
    .is("deleted_at", null)
    .eq("status", "ready")
    .gte("imported_at", since)
    .order("imported_at", { ascending: false })
    .limit(10);

  if (!materials || materials.length === 0) return null;

  const ids = materials.map((m) => m.id);
  const { data: touched } = await supabase
    .from("reviews")
    .select("material_id")
    .eq("user_id", user.id)
    .in("material_id", ids);

  const touchedSet = new Set((touched ?? []).map((r) => r.material_id as string));
  const fresh = materials.filter((m) => !touchedSet.has(m.id));
  if (fresh.length === 0) return null;

  const { data: itemRows } = await supabase
    .from("items")
    .select("material_id")
    .eq("user_id", user.id)
    .in("material_id", fresh.map((m) => m.id))
    .is("audit_id", null);

  const counts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const id = (row as { material_id: string }).material_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const list: FreshMaterial[] = fresh.map((m) => ({
    id: m.id,
    title: m.title,
    imported_at: m.imported_at,
    item_count: counts.get(m.id) ?? 0,
  }));

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-xl font-medium leading-tight">
          Świeży materiał <span className="text-muted text-base">— po podcaście?</span>
        </h2>
        <span className="text-[11px] uppercase tracking-wide text-muted">ostatnie 24h</span>
      </div>
      <ul className="divide-y divide-line border border-line rounded-xl bg-surface overflow-hidden shadow-sm shadow-black/[0.02] dark:shadow-black/20">
        {list.map((m) => (
          <li
            key={m.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 transition-colors hover:bg-elevated"
          >
            <div className="min-w-0">
              <Link
                href={`/materials/${m.id}`}
                className="font-serif text-lg font-medium hover:text-accent transition-colors truncate block"
              >
                {m.title}
              </Link>
              <div className="text-xs text-muted font-mono mt-0.5">
                {formatRelative(m.imported_at)} · {m.item_count} pytań
              </div>
            </div>
            <Button asChild size="lg" className="min-h-12 self-stretch sm:self-auto">
              <Link href={`/sessions/deep-dive/${m.id}`} className="inline-flex items-center gap-2">
                Zacznij Deep Dive
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
