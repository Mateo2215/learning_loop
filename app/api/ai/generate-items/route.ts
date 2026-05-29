import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateClozeCards, generateOpenQuestions } from "@/lib/processing/generate-items";
import { buildGeneratedItemRows } from "@/lib/processing/generated-item-rows";
import { trackAICall } from "@/lib/ai/track";

/**
 * POST /api/ai/generate-items?material_id=<uuid>
 *
 * Generates additional cloze and open items for an existing material using
 * its compressed content. Inserts the new rows and returns { added: number }.
 * All AI calls go through trackAICall to enforce cost limits and logging.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const materialId = request.nextUrl.searchParams.get("material_id");
  if (!materialId) {
    return NextResponse.json({ error: "material_id query param required" }, { status: 400 });
  }

  const { data: material } = await supabase
    .from("materials")
    .select("id, content_compressed, category, tags")
    .eq("id", materialId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!material) return NextResponse.json({ error: "material not found" }, { status: 404 });
  if (!material.content_compressed) {
    return NextResponse.json({ error: "material has no compressed content" }, { status: 422 });
  }

  const { data: existingQuestions, error: existingErr } = await supabase
    .from("items")
    .select("question")
    .eq("material_id", materialId)
    .eq("user_id", user.id)
    .is("audit_id", null);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  let clozeCards: Awaited<ReturnType<typeof generateClozeCards>>["cards"] = [];
  let openQuestions: Awaited<ReturnType<typeof generateOpenQuestions>>["questions"] = [];

  try {
    const clozeResult = await trackAICall({
      supabase,
      userId: user.id,
      operation: "generate_cloze",
      model: "claude-sonnet-4-6",
      materialId,
      call: async () => {
        const r = await generateClozeCards(material.content_compressed!);
        return { result: r.cards, usage: r.usage };
      },
    });
    clozeCards = clozeResult.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generate_cloze failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const openResult = await trackAICall({
      supabase,
      userId: user.id,
      operation: "generate_open",
      model: "claude-haiku-4-5",
      materialId,
      call: async () => {
        const r = await generateOpenQuestions(material.content_compressed!);
        return { result: r.questions, usage: r.usage };
      },
    });
    openQuestions = openResult.result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generate_open failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const allRows = buildGeneratedItemRows({
    userId: user.id,
    material,
    clozeCards,
    openQuestions,
    existingQuestions: existingQuestions ?? [],
  });
  if (allRows.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  const { error: insertErr } = await supabase.from("items").insert(allRows);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ added: allRows.length });
}
