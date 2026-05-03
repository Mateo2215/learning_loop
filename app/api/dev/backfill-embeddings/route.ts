import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackAICall } from "@/lib/ai/track";
import { embed } from "@/lib/ai/voyage";

/**
 * POST /api/dev/backfill-embeddings
 *
 * One-shot helper. Re-embeds:
 *   - All materials owned by the current user (replaces the deterministic stub
 *     vectors that pre-Voyage imports got).
 *   - All knowledge_gaps that don't yet have an embedding.
 *
 * Disabled in production. Each call is logged via trackAICall.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  // Materials: take title + first 4000 chars of content_compressed as embed input.
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, content_compressed")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  let materialsUpdated = 0;
  let materialsFailed = 0;
  for (const row of (materials ?? []) as { id: string; title: string; content_compressed: string | null }[]) {
    const text = `${row.title}\n\n${(row.content_compressed ?? "").slice(0, 4000)}`;
    try {
      const tracked = await trackAICall({
        supabase,
        userId: user.id,
        operation: "embed_material",
        model: "voyage-3",
        materialId: row.id,
        metadata: { source: "backfill_materials" },
        call: () => embed(text).then((r) => ({ result: r.embedding, usage: r.usage })),
      });
      const { error } = await supabase
        .from("materials")
        .update({ embedding: tracked.result })
        .eq("id", row.id);
      if (error) materialsFailed += 1;
      else materialsUpdated += 1;
    } catch {
      materialsFailed += 1;
    }
  }

  // Gaps: only those without an embedding.
  const { data: gaps } = await supabase
    .from("knowledge_gaps")
    .select("id, title, affected_tags")
    .eq("user_id", user.id)
    .is("embedding", null);

  let gapsUpdated = 0;
  let gapsFailed = 0;
  const gapErrors: Array<{ id: string; reason: string }> = [];
  for (const g of (gaps ?? []) as { id: string; title: string | null; affected_tags: string[] | null }[]) {
    const text = [g.title ?? "", ...(g.affected_tags ?? [])].filter(Boolean).join(" — ");
    if (!text) {
      gapsFailed += 1;
      gapErrors.push({ id: g.id, reason: "empty embed text (no title or tags)" });
      continue;
    }
    try {
      const tracked = await trackAICall({
        supabase,
        userId: user.id,
        operation: "embed_material",
        model: "voyage-3",
        metadata: { source: "backfill_gaps", gap_id: g.id },
        call: () => embed(text).then((r) => ({ result: r.embedding, usage: r.usage })),
      });
      const { error } = await supabase
        .from("knowledge_gaps")
        .update({ embedding: tracked.result })
        .eq("id", g.id);
      if (error) {
        gapsFailed += 1;
        gapErrors.push({ id: g.id, reason: `update error: ${error.message}` });
      } else {
        gapsUpdated += 1;
      }
    } catch (err) {
      gapsFailed += 1;
      gapErrors.push({ id: g.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    materials: { updated: materialsUpdated, failed: materialsFailed },
    gaps: { updated: gapsUpdated, failed: gapsFailed, errors: gapErrors },
  });
}
