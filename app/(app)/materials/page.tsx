import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, type Material } from "@/lib/db/types";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, title, category, status, tags, imported_at")
    .is("deleted_at", null)
    .order("imported_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Materiały</h1>
        <Button size="sm" asChild>
          <Link href="/materials/import">+ Nowy materiał</Link>
        </Button>
      </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            Błąd: {error.message}
          </p>
        )}

        {!error && (!materials || materials.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Brak materiałów</CardTitle>
              <CardDescription>
                Zaimportuj pierwszy materiał, żeby zacząć generowanie fiszek i pytań.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/materials/import">Zaimportuj pierwszy →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {materials && materials.length > 0 && (
          <div className="grid gap-3">
            {materials.map((m) => (
              <MaterialRow key={m.id} material={m as MaterialRowData} />
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
      className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-medium truncate">{material.title}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {CATEGORY_LABELS[material.category]} • {formatDate(material.imported_at)}
          </p>
          {material.tags && material.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {material.tags.slice(0, 5).map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <StatusBadge status={material.status} />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: Material["status"] }) {
  const styles: Record<Material["status"], string> = {
    processing: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
    failed: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  };
  const labels: Record<Material["status"], string> = {
    processing: "W trakcie…",
    ready: "Gotowy",
    failed: "Błąd",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
