import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, type Material } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { Tag } from "@/components/shared/tag";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, title, category, status, tags, imported_at")
    .is("deleted_at", null)
    .order("imported_at", { ascending: false });

  const groups = groupByDate((materials ?? []) as MaterialRowData[]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title={
          <>
            Materiały
            {materials && (
              <span className="text-muted font-mono text-base ml-3 align-middle">
                · {materials.length}
              </span>
            )}
          </>
        }
        actions={
          <Button size="sm" asChild>
            <Link href="/materials/import">+ Nowy</Link>
          </Button>
        }
      />

      {error && <p className="text-sm text-bad mb-4">Błąd: {error.message}</p>}

      {!error && (!materials || materials.length === 0) && (
        <EmptyState
          title="Brak materiałów"
          description="Zaimportuj pierwszy materiał, żeby zacząć generowanie fiszek i pytań."
          cta={
            <Button asChild>
              <Link href="/materials/import">Zaimportuj pierwszy →</Link>
            </Button>
          }
        />
      )}

      {materials && materials.length > 0 && (
        <div className="space-y-8">
          {groups.map(([groupLabel, rows]) => (
            <section key={groupLabel}>
              <h3 className="font-serif text-xs uppercase tracking-widest text-muted mb-2">
                {groupLabel}
              </h3>
              <ul className="border-y border-line divide-y divide-line">
                {rows.map((m) => (
                  <li key={m.id}>
                    <MaterialRow material={m} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type MaterialRowData = Pick<Material, "id" | "title" | "category" | "status" | "tags" | "imported_at">;

function MaterialRow({ material }: { material: MaterialRowData }) {
  return (
    <Link
      href={`/materials/${material.id}`}
      className="flex items-start justify-between gap-4 py-3 hover:bg-elevated/40 px-2 -mx-2 rounded-md transition-colors"
    >
      <div className="flex-1 min-w-0">
        <h2 className="font-serif text-base font-medium truncate">{material.title}</h2>
        <p className="text-xs text-muted mt-0.5 font-mono">
          {CATEGORY_LABELS[material.category]} · {formatDate(material.imported_at)}
        </p>
        {material.tags && material.tags.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1 mt-2">
            {material.tags.slice(0, 5).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </div>
      {material.status !== "ready" && (
        <StatusPill variant={material.status === "processing" ? "processing" : "failed"}>
          {material.status === "processing" ? "W trakcie" : "Błąd"}
        </StatusPill>
      )}
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(rows: MaterialRowData[]): [string, MaterialRowData[]][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, MaterialRowData[]>();
  for (const r of rows) {
    const d = new Date(r.imported_at);
    const dStart = new Date(d);
    dStart.setHours(0, 0, 0, 0);

    let key: string;
    if (dStart.getTime() === today.getTime()) key = "Dziś";
    else if (dStart.getTime() === yesterday.getTime()) key = "Wczoraj";
    else
      key = d.toLocaleDateString("pl-PL", {
        month: "long",
        year: "numeric",
      });

    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
}
