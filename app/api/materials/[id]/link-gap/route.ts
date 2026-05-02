import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  action: z.enum(["confirm", "dismiss"]),
});

/**
 * POST /api/materials/:id/link-gap
 *
 * Resolves the suggested-gap banner on a material.
 *   confirm — flips the linked gap to status='addressed' (with addressed_by/at)
 *             and writes a `material_relations` row of type 'addresses_gap'.
 *   dismiss — just clears `materials.suggested_gap_id`.
 *
 * Either way, the suggested_gap_id is cleared so the banner stops showing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: materialId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 400 });
  }
  const { action } = parsed.data;

  const { data: matRow } = await supabase
    .from("materials")
    .select("id, suggested_gap_id")
    .eq("id", materialId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!matRow) return NextResponse.json({ error: "material not found" }, { status: 404 });
  const gapId = (matRow as { suggested_gap_id: string | null }).suggested_gap_id;
  if (!gapId) {
    return NextResponse.json({ error: "no gap to link" }, { status: 400 });
  }

  if (action === "confirm") {
    const nowIso = new Date().toISOString();
    const { error: gapErr } = await supabase
      .from("knowledge_gaps")
      .update({
        status: "addressed",
        addressed_by_material_id: materialId,
        addressed_at: nowIso,
      })
      .eq("id", gapId)
      .eq("user_id", user.id);
    if (gapErr) {
      return NextResponse.json({ error: gapErr.message }, { status: 500 });
    }
    // material_relations is material-to-material only (CHECK constraint forbids
    // self-links). The link-back lives on knowledge_gaps.addressed_by_material_id.
  }

  await supabase
    .from("materials")
    .update({ suggested_gap_id: null })
    .eq("id", materialId);

  return NextResponse.json({ ok: true });
}
