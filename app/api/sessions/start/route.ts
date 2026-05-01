import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/db/types";

const StartBodySchema = z.object({
  mode: z.enum(["review", "deep_dive"]),
  material_id: z.string().uuid().optional(),
  item_count: z.number().int().min(1).max(50).default(20),
});

/**
 * POST /api/sessions/start
 *
 * `mode: 'review'`
 *   Returns up to `item_count` cloze items that are due now (or earlier),
 *   ordered by due date ascending. New items (never reviewed) are interleaved.
 *   Hard cap: 25 new items per day (CLAUDE.md). Reviews are unlimited.
 *
 * `mode: 'deep_dive'`
 *   Requires `material_id`. Returns up to `item_count` open questions for that
 *   material, ordered by created_at.
 *
 * Pre-loads all items so a session can complete offline if the user goes
 * offline mid-session (M3 will use this contract for IndexedDB caching).
 */
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

  const parsed = StartBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { mode, material_id, item_count } = parsed.data;

  if (mode === "deep_dive" && !material_id) {
    return NextResponse.json(
      { error: "material_id required for deep_dive mode" },
      { status: 400 }
    );
  }

  const items = mode === "review"
    ? await selectReviewItems(supabase, user.id, item_count)
    : await selectDeepDiveItems(supabase, user.id, material_id!, item_count);

  if (items.length === 0) {
    return NextResponse.json({ error: "no_items_available" }, { status: 404 });
  }

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      mode,
      items_planned: items.length,
      device: "desktop",
    })
    .select("id, started_at")
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: `session insert failed: ${sessionErr?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session_id: session.id,
    started_at: session.started_at,
    items,
  });
}

/**
 * Review queue: cloze items where due_date <= now, plus newly-generated items
 * (review_count = 0). Capped at 25 new items per day to match CLAUDE.md.
 */
async function selectReviewItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number
): Promise<ReviewItem[]> {
  const nowIso = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: dueRows } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, cloze_data, difficulty, fsrs_due_date, fsrs_review_count")
    .eq("user_id", userId)
    .eq("type", "cloze")
    .eq("is_suspended", false)
    .lte("fsrs_due_date", nowIso)
    .order("fsrs_due_date", { ascending: true })
    .limit(limit);

  // Separate "new" (never reviewed) from "review" (seen before).
  const dueItems = (dueRows ?? []) as ReviewItem[];

  // Cap new items per day. Look up how many new cards user already saw today.
  const { count: newSeenToday } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString())
    .gt("fsrs_rating", 0);

  const newAlreadyReviewed = newSeenToday ?? 0;
  const newBudget = Math.max(0, 25 - newAlreadyReviewed);

  // Filter — for items with review_count = 0, only let `newBudget` through.
  const out: ReviewItem[] = [];
  let newAdded = 0;
  for (const item of dueItems) {
    if (item.fsrs_review_count === 0) {
      if (newAdded >= newBudget) continue;
      newAdded++;
    }
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

async function selectDeepDiveItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string,
  limit: number
): Promise<ReviewItem[]> {
  const { data } = await supabase
    .from("items")
    .select("id, material_id, type, question, answer_reference, cloze_data, difficulty, fsrs_due_date, fsrs_review_count")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as ReviewItem[];
}

type ReviewItem = Pick<
  Item,
  "id" | "material_id" | "type" | "question" | "answer_reference" | "cloze_data" | "difficulty" | "fsrs_due_date" | "fsrs_review_count"
>;
