import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyRating, type FsrsRating } from "@/lib/fsrs/scheduler";
import type { Item } from "@/lib/db/types";

const AnswerBodySchema = z.object({
  item_id: z.string().uuid(),
  fsrs_rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  user_answer: z.string().optional(),
  response_time_ms: z.number().int().nonnegative().optional(),
});

/**
 * POST /api/sessions/:id/answer
 *
 * Cloze (review): expects `fsrs_rating` (1-4). Updates FSRS state on the item,
 *   inserts a review row.
 *
 * Open (deep_dive): expects `user_answer`. Phase 6 will add Sonnet validation;
 *   for now we just persist the answer text and a `validated_at = null` row.
 *   (UI on Deep Dive page will be wired in Phase 6.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = AnswerBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { item_id, fsrs_rating, user_answer, response_time_ms } = parsed.data;

  // Confirm session belongs to user (RLS would block anyway, but explicit 404 is cleaner).
  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  // Pull item + FSRS state.
  const { data: item } = await supabase
    .from("items")
    .select("id, material_id, type, fsrs_stability, fsrs_difficulty, fsrs_due_date, fsrs_last_review, fsrs_review_count, fsrs_lapse_count")
    .eq("id", item_id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const itemTyped = item as Pick<Item, "id" | "material_id" | "type" | "fsrs_stability" | "fsrs_difficulty" | "fsrs_due_date" | "fsrs_last_review" | "fsrs_review_count" | "fsrs_lapse_count">;

  if (itemTyped.type === "cloze") {
    if (!fsrs_rating) {
      return NextResponse.json({ error: "fsrs_rating required for cloze items" }, { status: 400 });
    }

    const { itemUpdate } = applyRating(itemTyped, fsrs_rating as FsrsRating);

    const { error: itemErr } = await supabase
      .from("items")
      .update(itemUpdate)
      .eq("id", item_id);
    if (itemErr) {
      return NextResponse.json({ error: `item update failed: ${itemErr.message}` }, { status: 500 });
    }

    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        item_id,
        material_id: itemTyped.material_id,
        session_id: sessionId,
        fsrs_rating,
        response_time_ms,
        validated_at: new Date().toISOString(), // cloze is exact-match — validated immediately
      })
      .select("id")
      .single();
    if (reviewErr || !review) {
      return NextResponse.json({ error: `review insert failed: ${reviewErr?.message}` }, { status: 500 });
    }

    // session.items_completed is recalculated when /end is called (cleaner than incrementing per call).

    return NextResponse.json({
      review_id: review.id,
      next_due: itemUpdate.fsrs_due_date,
      is_leech: itemUpdate.is_leech,
    });
  }

  // Open question — Phase 6 will validate via Sonnet. For now, persist the answer.
  if (itemTyped.type === "open") {
    if (!user_answer) {
      return NextResponse.json({ error: "user_answer required for open items" }, { status: 400 });
    }

    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        item_id,
        material_id: itemTyped.material_id,
        session_id: sessionId,
        user_answer,
        response_time_ms,
        // ai_evaluation, feedback fields, validated_at — filled in Phase 6.
      })
      .select("id")
      .single();
    if (reviewErr || !review) {
      return NextResponse.json({ error: `review insert failed: ${reviewErr?.message}` }, { status: 500 });
    }

    return NextResponse.json({ review_id: review.id, validated: false });
  }

  return NextResponse.json({ error: `unsupported item type: ${itemTyped.type}` }, { status: 400 });
}
