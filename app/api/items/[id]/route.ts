import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/db/types";

const PatchBodySchema = z.object({
  question: z.string().min(5).max(2000).optional(),
  answer_reference: z.string().min(1).max(4000).optional(),
});

/**
 * PATCH /api/items/:id
 *
 * Edit `question` and/or `answer_reference`. On the FIRST edit we copy the
 * current question into `original_question` so we keep history; subsequent
 * edits only bump `edit_count`. Audit-only items are immutable here (they're
 * generated per-audit and shouldn't drift).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (!parsed.data.question && !parsed.data.answer_reference) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("items")
    .select("id, question, original_question, edit_count, audit_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "item not found" }, { status: 404 });
  const e = existing as Pick<Item, "id" | "question" | "original_question" | "edit_count" | "audit_id">;
  if (e.audit_id) {
    return NextResponse.json(
      { error: "audit items are not editable" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { edit_count: (e.edit_count ?? 0) + 1 };
  if (parsed.data.question !== undefined) update.question = parsed.data.question;
  if (parsed.data.answer_reference !== undefined) update.answer_reference = parsed.data.answer_reference;
  if (e.original_question == null) {
    update.original_question = e.question;
  }

  const { error } = await supabase.from("items").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
