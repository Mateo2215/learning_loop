import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchClient } from "./search-client";

export default async function SearchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pull all tags currently in use so the filter dropdown shows real options.
  const { data: tagRows } = await supabase
    .from("materials")
    .select("tags")
    .is("deleted_at", null);

  const allTags = new Set<string>();
  for (const row of (tagRows ?? []) as { tags: string[] | null }[]) {
    for (const t of row.tags ?? []) allTags.add(t);
  }
  const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b, "pl"));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Szukaj</h1>
      <p className="text-sm text-muted mb-6">
        Wyszukaj w tytułach i treści swoich materiałów. Filtry sumują się z zapytaniem.
      </p>
      <SearchClient availableTags={sortedTags} />
    </div>
  );
}
