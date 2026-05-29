import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ArrowRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SectionHeader } from "@/components/shared/section-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MaterialCard } from "@/components/materials/material-card";
import { CATEGORIES, CATEGORY_LABELS, type Category, type MaterialStatus } from "@/lib/db/types";

interface SearchParams {
  q?: string;
  cat?: string;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, cat } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("materials")
    .select("id, title, category, tags, imported_at, status")
    .is("deleted_at", null)
    .order("imported_at", { ascending: false });

  if (q && q.trim().length > 0) {
    query = query.ilike("title", `%${q.trim()}%`);
  }
  if (cat && (CATEGORIES as readonly string[]).includes(cat)) {
    query = query.eq("category", cat);
  }

  const { data: materials, error } = await query;

  // Pobierz wszystkie items dla widocznych materiałów, żeby policzyć segmenty.
  const ids = (materials ?? []).map((m) => m.id);
  const itemsByMaterial = new Map<
    string,
    Array<{ stability: number | null }>
  >();
  if (ids.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("material_id, fsrs_stability")
      .in("material_id", ids);
    for (const row of itemRows ?? []) {
      const r = row as { material_id: string; fsrs_stability: number | null };
      const list = itemsByMaterial.get(r.material_id) ?? [];
      list.push({ stability: r.fsrs_stability });
      itemsByMaterial.set(r.material_id, list);
    }
  }

  const groups = groupByMonth((materials ?? []) as MaterialRow[]);
  const filterChips = buildFilterChips(materials, cat);
  const nowMs = new Date().getTime();

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Materiały"
        sub="Twoja biblioteka pętli powtórek."
        actions={
          <Button asChild className="gap-2">
            <Link href="/materials/import">
              <Plus className="h-4 w-4" />
              Dodaj materiał
            </Link>
          </Button>
        }
      />

      {/* Search + filter chips */}
      <div className="mt-6 mb-8 flex flex-col md:flex-row md:items-center gap-3">
        <form action="/materials" method="get" className="flex-1 max-w-md">
          {cat && <input type="hidden" name="cat" value={cat} />}
          <label className="flex items-center gap-2 bg-surface border border-line rounded-lg px-4 py-2.5">
            <Search className="h-4 w-4 text-muted shrink-0" />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Szukaj w materiałach…"
              className="flex-1 bg-transparent outline-none text-[14px] text-fg placeholder:text-muted"
            />
          </label>
        </form>
        <div className="flex flex-wrap gap-2">
          {filterChips.map((c) => (
            <Link
              key={c.value ?? "all"}
              href={buildHref(q, c.value)}
              aria-current={c.active ? "page" : undefined}
            >
              <Chip variant={c.active ? "accent" : "default"}>
                {c.label} · {c.count}
              </Chip>
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-bad mb-4">Błąd: {error.message}</p>}

      {!error && (!materials || materials.length === 0) && (
        <EmptyState
          title={q || cat ? "Brak wyników" : "Brak materiałów"}
          description={
            q || cat
              ? "Nie znaleziono materiałów dla tych filtrów. Spróbuj zmienić wyszukiwanie."
              : "Zaimportuj pierwszy materiał, żeby zacząć generowanie fiszek i pytań."
          }
          cta={
            <Button asChild>
              <Link href="/materials/import">
                Zaimportuj pierwszy <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      )}

      {materials && materials.length > 0 && (
        <div className="space-y-10">
          {groups.map(([groupLabel, rows]) => (
            <section key={groupLabel}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
                {groupLabel}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((m) => {
                  const items = itemsByMaterial.get(m.id) ?? [];
                  const segments = computeSegments(items);
                  const stale = isStale(m.imported_at, nowMs);
                  return (
                    <MaterialCard
                      key={m.id}
                      id={m.id}
                      title={m.title}
                      category={m.category}
                      tags={m.tags ?? []}
                      importedAt={m.imported_at}
                      itemsTotal={items.length}
                      segments={segments}
                      status={m.status}
                      isStale={stale}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface MaterialRow {
  id: string;
  title: string;
  category: Category;
  tags: string[] | null;
  imported_at: string;
  status: MaterialStatus;
}

interface FilterChip {
  label: string;
  value: string | null;
  count: number;
  active: boolean;
}

function buildFilterChips(
  materials: { category: Category }[] | null,
  current: string | undefined,
): FilterChip[] {
  const all = materials ?? [];
  const counts = new Map<Category, number>();
  for (const m of all) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);

  const chips: FilterChip[] = [
    {
      label: "Wszystkie",
      value: null,
      count: all.length,
      active: !current,
    },
  ];
  for (const c of CATEGORIES) {
    chips.push({
      label: CATEGORY_LABELS[c],
      value: c,
      count: counts.get(c) ?? 0,
      active: current === c,
    });
  }
  return chips;
}

function buildHref(q: string | undefined, cat: string | null): string {
  const sp = new URLSearchParams();
  if (q && q.trim()) sp.set("q", q.trim());
  if (cat) sp.set("cat", cat);
  const qs = sp.toString();
  return qs ? `/materials?${qs}` : "/materials";
}

function groupByMonth(rows: MaterialRow[]): [string, MaterialRow[]][] {
  const groups = new Map<string, MaterialRow[]>();
  for (const r of rows) {
    const d = new Date(r.imported_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  // Format do "MAJ 2026"
  return Array.from(groups.entries()).map(([key, list]) => {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    const label = new Intl.DateTimeFormat("pl-PL", {
      month: "long",
      year: "numeric",
    })
      .format(d)
      .toUpperCase();
    return [label, list] as [string, MaterialRow[]];
  });
}

function computeSegments(items: { stability: number | null }[]): {
  mature: number;
  young: number;
  learning: number;
  new: number;
} {
  const seg = { mature: 0, young: 0, learning: 0, new: 0 };
  for (const it of items) {
    const s = it.stability;
    if (s === null || s === undefined) {
      seg.new += 1;
    } else if (s >= 30) {
      seg.mature += 1;
    } else if (s >= 7) {
      seg.young += 1;
    } else {
      seg.learning += 1;
    }
  }
  return seg;
}

function isStale(iso: string, nowMs: number): boolean {
  const days = (nowMs - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  return days > 30;
}
