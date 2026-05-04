import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyRating, type FsrsRating } from "@/lib/fsrs/scheduler";
import { trackAICall } from "@/lib/ai/track";
import { validateOpenAnswer } from "@/lib/ai/validate-open";
import type { Category, Item } from "@/lib/db/types";

/**
 * POST /api/sessions/sync-offline
 *
 * Batch-flush queued reviews. The client sends `{ reviews: [...] }` from
 * IndexedDB; we reply with per-review `{ client_id, ok, error? }` so the
 * client knows what to delete and what to retry.
 *
 * Cloze: idempotent (FSRS update + review insert).
 * Open: triggers Sonnet validation per-review through trackAICall. We loop
 * sequentially to play nice with rate limits — small batches expected.
 */

const ReviewSchema = z.object({
  client_id: z.string().min(1),
  session_id: z.string().uuid(),
  item_id: z.string().uuid(),
  fsrs_rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  user_answer: z.string().min(1).optional(),
  response_time_ms: z.number().int().nonnegative().optional(),
});

const BodySchema = z.object({
  reviews: z.array(ReviewSchema).min(1).max(50),
});

interface ResultRow {
  client_id: string;
  ok: boolean;
  error?: string;
  evaluation?: "correct" | "partially_correct" | "incorrect";
}

export async function POST(request: NextRequest) {
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

  const results: ResultRow[] = [];
  for (const r of parsed.data.reviews) {
    try {
      const row = await processOne(supabase, user.id, r);
      results.push(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      results.push({ client_id: r.client_id, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, results });
}

type SupabaseSrv = Awaited<ReturnType<typeof createClient>>;

async function processOne(
  supabase: SupabaseSrv,
  userId: string,
  r: z.infer<typeof ReviewSchema>
): Promise<ResultRow> {
  const { data: item } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, category, fsrs_stability, fsrs_difficulty, fsrs_due_date, fsrs_last_review, fsrs_review_count, fsrs_lapse_count")
    .eq("id", r.item_id)
    .maybeSingle();

  if (!item) return { client_id: r.client_id, ok: false, error: "item not found" };
  const it = item as Pick<
    Item,
    | "id" | "material_id" | "type" | "question" | "answer_reference" | "category"
    | "fsrs_stability" | "fsrs_difficulty" | "fsrs_due_date" | "fsrs_last_review"
    | "fsrs_review_count" | "fsrs_lapse_count"
  >;

  if (it.type === "cloze") {
    if (!r.fsrs_rating) {
      return { client_id: r.client_id, ok: false, error: "fsrs_rating required for cloze" };
    }
    const { itemUpdate } = applyRating(it, r.fsrs_rating as FsrsRating);
    const { error: itemErr } = await supabase.from("items").update(itemUpdate).eq("id", r.item_id);
    if (itemErr) return { client_id: r.client_id, ok: false, error: itemErr.message };

    const { error: reviewErr } = await supabase.from("reviews").insert({
      user_id: userId,
      item_id: r.item_id,
      material_id: it.material_id,
      session_id: r.session_id,
      fsrs_rating: r.fsrs_rating,
      response_time_ms: r.response_time_ms,
      is_offline_queued: true,
      validated_at: new Date().toISOString(),
    });
    if (reviewErr) return { client_id: r.client_id, ok: false, error: reviewErr.message };
    return { client_id: r.client_id, ok: true };
  }

  if (it.type === "open") {
    if (!r.user_answer || r.user_answer.trim().length < 3) {
      return { client_id: r.client_id, ok: false, error: "user_answer too short" };
    }
    if (!it.answer_reference) {
      return { client_id: r.client_id, ok: false, error: "item missing answer_reference" };
    }

    let validation;
    try {
      const tracked = await trackAICall({
        supabase,
        userId,
        operation: "validate_open_answer",
        model: "claude-sonnet-4-6",
        materialId: it.material_id,
        sessionId: r.session_id,
        metadata: { item_id: r.item_id, source: "sync_offline", category: it.category },
        call: () =>
          validateOpenAnswer({
            category: it.category as Category,
            question: it.question,
            referenceAnswer: it.answer_reference!,
            userAnswer: r.user_answer!.trim(),
          }).then((x) => ({ result: x.result, usage: x.usage })),
      });
      validation = tracked.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "validation failed";
      return { client_id: r.client_id, ok: false, error: message };
    }

    const { error: reviewErr } = await supabase.from("reviews").insert({
      user_id: userId,
      item_id: r.item_id,
      material_id: it.material_id,
      session_id: r.session_id,
      user_answer: r.user_answer.trim(),
      ai_evaluation: validation.evaluation,
      ai_feedback_positive: validation.feedback_positive,
      ai_feedback_negative: validation.feedback_negative,
      response_time_ms: r.response_time_ms,
      is_offline_queued: true,
      validated_at: new Date().toISOString(),
    });
    if (reviewErr) return { client_id: r.client_id, ok: false, error: reviewErr.message };
    return { client_id: r.client_id, ok: true, evaluation: validation.evaluation };
  }

  return { client_id: r.client_id, ok: false, error: `unsupported type: ${it.type}` };
}
