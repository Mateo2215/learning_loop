// PATCH + DELETE /api/materials/:id
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["finanse", "programowanie", "ai_ml", "soft_skills", "ogolne"] as const;

const PatchBodySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z.enum(CATEGORIES).optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  insight_note: z.string().max(1000).optional(),
  application_note: z.string().max(1000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.category !== undefined) update.category = parsed.data.category;
  if (parsed.data.tags !== undefined) update.tags = Array.from(new Set(parsed.data.tags));
  if (parsed.data.insight_note !== undefined) update.insight_note = parsed.data.insight_note;
  if (parsed.data.application_note !== undefined) update.application_note = parsed.data.application_note;

  const { error } = await supabase
    .from("materials")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: material } = await supabase
    .from("materials")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  await Promise.all([
    supabase
      .from("materials")
      .update({ deleted_at: now })
      .eq("id", id),
    supabase
      .from("items")
      .update({ is_suspended: true })
      .eq("material_id", id)
      .eq("user_id", user.id),
    supabase
      .from("topic_audits")
      .update({ status: "skipped" })
      .eq("material_id", id)
      .eq("status", "pending"),
  ]);

  return NextResponse.json({ success: true });
}
