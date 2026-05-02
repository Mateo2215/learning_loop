import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackAICall } from "@/lib/ai/track";
import { generateClaudePrompt } from "@/lib/ai/generate-claude-prompt";
import type { Category, GapType, KnowledgeGap } from "@/lib/db/types";

const DOMAIN_PL: Record<Category, string> = {
  finanse: "finansów",
  programowanie: "programowania",
  ai_ml: "AI/ML",
  soft_skills: "umiejętności miękkich",
  ogolne: "tej dziedziny",
};

/**
 * POST /api/gaps/:id/generate-prompt
 *
 * Generates a ready-to-paste Claude.ai prompt for the gap. Saves the result
 * into `knowledge_gaps.generated_prompt` so we don't burn another Sonnet call
 * if the user comes back to the page. Re-runs unconditionally if the user
 * clicks "Wygeneruj ponownie" (handled in UI; route always overwrites).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data: gapRow, error: gapErr } = await supabase
    .from("knowledge_gaps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (gapErr) return NextResponse.json({ error: gapErr.message }, { status: 500 });
  if (!gapRow) return NextResponse.json({ error: "gap not found" }, { status: 404 });
  const gap = gapRow as KnowledgeGap;

  // Pick the dominant category from the affected materials (fallback to "ogolne").
  let domain: Category = "ogolne";
  if (gap.affected_materials.length > 0) {
    const { data: mats } = await supabase
      .from("materials")
      .select("category")
      .in("id", gap.affected_materials);
    const counts = new Map<Category, number>();
    for (const m of (mats ?? []) as { category: Category }[]) {
      counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
    }
    let max = 0;
    for (const [c, n] of counts) {
      if (n > max) {
        domain = c;
        max = n;
      }
    }
  }

  // Resolve material ids to titles for the AI input (clearer than UUIDs).
  let materialTitles: string[] = [];
  if (gap.affected_materials.length > 0) {
    const { data: mats } = await supabase
      .from("materials")
      .select("title")
      .in("id", gap.affected_materials);
    materialTitles = ((mats ?? []) as { title: string }[]).map((m) => m.title);
  }

  let promptText: string;
  try {
    const tracked = await trackAICall({
      supabase,
      userId: user.id,
      operation: "generate_claude_prompt",
      model: "claude-sonnet-4-6",
      metadata: { gap_id: id, gap_type: gap.gap_type as GapType },
      call: () =>
        generateClaudePrompt({
          title: gap.title ?? "Luka wiedzy",
          gap_type: gap.gap_type,
          affected_tags: gap.affected_tags,
          affected_materials: materialTitles,
          domain: DOMAIN_PL[domain],
        }).then((r) => ({ result: r.result, usage: r.usage })),
    });
    promptText = tracked.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("knowledge_gaps")
    .update({ generated_prompt: promptText })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, generated_prompt: promptText });
}
