import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Material } from "@/lib/db/types";

const QuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]).optional(),
  tag: z.string().trim().max(50).optional(),
  status: z.enum(["processing", "ready", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * GET /api/search
 *
 * Quick + filtered search across materials. Text query matches against title
 * + content_compressed via ILIKE — fast enough at our scale (<1000 materials).
 * Filters (category, tag, status) compose AND with the text query.
 *
 * Semantic mode (Voyage embeddings) will arrive as a `mode=semantic` branch
 * once the Voyage API key is provisioned. A real Postgres FTS column with the
 * existing GIN index will replace ILIKE in the same migration.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { q, category, tag, status, limit } = parsed.data;

  let query = supabase
    .from("materials")
    .select("id, title, category, tags, status, imported_at, content_compressed")
    .is("deleted_at", null);

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (tag) query = query.contains("tags", [tag]);

  if (q && q.length > 0) {
    // Sanitize for both ILIKE wildcards AND PostgREST `.or()` separator parsing.
    // Commas, parens, dots, asterisks and ampersands are operators inside an
    // .or() string — strip them so a query like "foo,bar" or "(test)" can't
    // be parsed as nested filter syntax. We also escape the ILIKE meta chars.
    const safe = q
      .replace(/[,()*&]/g, " ")
      .replace(/[%_\\]/g, "\\$&")
      .trim();
    if (safe.length > 0) {
      query = query.or(`title.ilike.%${safe}%,content_compressed.ilike.%${safe}%`);
    }
  }

  query = query.order("imported_at", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    results: trimResults(data as MaterialResult[], q),
  });
}

type MaterialResult = Pick<
  Material,
  "id" | "title" | "category" | "tags" | "status" | "imported_at" | "content_compressed"
>;

/**
 * Build a small content snippet around the query term (or the start of the
 * material) so the UI shows where the match occurred.
 */
function trimResults(rows: MaterialResult[] | null, q: string | undefined) {
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    tags: r.tags,
    status: r.status,
    imported_at: r.imported_at,
    snippet: buildSnippet(r.content_compressed, q, 180),
  }));
}

function buildSnippet(content: string | null, q: string | undefined, maxLen: number): string | null {
  if (!content) return null;
  if (!q) return content.slice(0, maxLen) + (content.length > maxLen ? "…" : "");
  const lc = content.toLowerCase();
  const idx = lc.indexOf(q.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? "…" : "");
  const start = Math.max(0, idx - 50);
  const end = Math.min(content.length, idx + q.length + 130);
  return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
}
