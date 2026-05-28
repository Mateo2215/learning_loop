import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyRating, type FsrsRating } from "@/lib/fsrs/scheduler";
import { trackAICall } from "@/lib/ai/track";
import { validateOpenAnswer } from "@/lib/ai/validate-open";
import { getCalibrationOffsets } from "@/lib/calibration/aggregator";
import { shouldUpdateLeech, LEECH_FAILURE_THRESHOLD } from "@/lib/sessions/section-status";
import type { Category, Item } from "@/lib/db/types";

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

  // Pull item + FSRS state. We also fetch question + reference + category for open-question validation,
  // and is_leech for open-question leech detection (3 consecutive score <7 → leech).
  const { data: item } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, category, fsrs_stability, fsrs_difficulty, fsrs_due_date, fsrs_last_review, fsrs_review_count, fsrs_lapse_count, is_leech")
    .eq("id", item_id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "item not found" }, { status: 404 });

  const itemTyped = item as Pick<Item, "id" | "material_id" | "type" | "question" | "answer_reference" | "category" | "fsrs_stability" | "fsrs_difficulty" | "fsrs_due_date" | "fsrs_last_review" | "fsrs_review_count" | "fsrs_lapse_count" | "is_leech">;

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

  // Open question — validate via Sonnet, persist evaluation + feedback.
  if (itemTyped.type === "open") {
    if (!user_answer || user_answer.trim().length < 3) {
      return NextResponse.json(
        { error: "user_answer too short (min 3 chars)" },
        { status: 400 }
      );
    }
    if (!itemTyped.answer_reference) {
      return NextResponse.json({ error: "item missing answer_reference" }, { status: 500 });
    }

    const { evaluationOffset, scoreOffset } = await getCalibrationOffsets(
      supabase,
      user.id,
      itemTyped.category as Category
    );

    let validation;
    try {
      const tracked = await trackAICall({
        supabase,
        userId: user.id,
        operation: "validate_open_answer",
        model: "claude-sonnet-4-6",
        materialId: itemTyped.material_id,
        sessionId,
        metadata: {
          item_id,
          category: itemTyped.category,
          calibration_offset: evaluationOffset,
          score_offset: scoreOffset,
        },
        call: () =>
          validateOpenAnswer({
            category: itemTyped.category as Category,
            question: itemTyped.question,
            referenceAnswer: itemTyped.answer_reference!,
            userAnswer: user_answer.trim(),
            calibrationOffset: evaluationOffset,
            scoreOffset,
          }).then((r) => ({ result: r.result, usage: r.usage })),
      });
      validation = tracked.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "validation failed";
      return NextResponse.json({ error: `AI validation failed: ${message}` }, { status: 500 });
    }

    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        item_id,
        material_id: itemTyped.material_id,
        session_id: sessionId,
        user_answer: user_answer.trim(),
        ai_evaluation: validation.evaluation,
        score: validation.score,
        ai_feedback_positive: validation.feedback_positive,
        ai_feedback_negative: validation.feedback_negative,
        response_time_ms,
        validated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (reviewErr || !review) {
      return NextResponse.json(
        { error: `review insert failed: ${reviewErr?.message}` },
        { status: 500 }
      );
    }

    // Leech detection dla open: po świeżym review pobieramy ostatnie N reviews
    // (DESC) i sprawdzamy czy spełniona jest reguła shouldUpdateLeech.
    // Non-blocking dla user — błąd loguje, ale nie psuje odpowiedzi.
    try {
      const { data: recentRows } = await supabase
        .from("reviews")
        .select("score")
        .eq("user_id", user.id)
        .eq("item_id", item_id)
        .not("score", "is", null)
        .order("created_at", { ascending: false })
        .limit(LEECH_FAILURE_THRESHOLD);

      const recentScores = ((recentRows ?? []) as { score: number | null }[])
        .map((r) => r.score)
        .filter((s): s is number => s !== null);

      const newLeechState = shouldUpdateLeech(recentScores, itemTyped.is_leech ?? false);
      if (newLeechState !== null) {
        await supabase
          .from("items")
          .update({ is_leech: newLeechState })
          .eq("id", item_id);
      }
    } catch (err) {
      console.warn("[answer/open] leech detection failed:", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      review_id: review.id,
      evaluation: validation.evaluation,
      score: validation.score,
      feedback_positive: validation.feedback_positive,
      feedback_negative: validation.feedback_negative,
    });
  }

  return NextResponse.json({ error: `unsupported item type: ${itemTyped.type}` }, { status: 400 });
}
