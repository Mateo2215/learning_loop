import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prepareAudit } from "@/lib/audits/scheduler";
import { isLeechRotationDue, pickLeechCandidates } from "@/lib/db/leeches";
import { endActiveSessions, findActiveSession } from "@/lib/sessions/active-guard";
import { previewIntervals, type IntervalPreview } from "@/lib/fsrs/scheduler";
import type { Item } from "@/lib/db/types";

const StartBodySchema = z.object({
  mode: z.enum(["review", "deep_dive", "audit"]),
  material_id: z.string().uuid().optional(),
  audit_id: z.string().uuid().optional(),
  item_count: z.number().int().min(1).max(50).default(20),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  force: z.boolean().default(false),
  shuffle: z.boolean().default(false),
});

/**
 * POST /api/sessions/start
 *
 * `mode: 'review'`     — due cloze items, daily new-card cap honored.
 * `mode: 'deep_dive'`  — open questions for `material_id`, excluding audit-only items.
 * `mode: 'audit'`      — generate (or reuse) questions for `audit_id`. Returns an
 *                         audit-flavored session with the freshly inserted items.
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
  const { mode, material_id, audit_id, item_count, device, force, shuffle } = parsed.data;

  // Cross-device guard: only one active session at a time. The client can pass
  // force=true to end the existing one and take over (e.g. user confirms the
  // "active session on another device" prompt).
  const existing = await findActiveSession(supabase, user.id);
  if (existing && !force) {
    return NextResponse.json(
      {
        error: "active_session_elsewhere",
        active_session: existing,
      },
      { status: 409 }
    );
  }
  if (existing && force) {
    await endActiveSessions(supabase, user.id);
  }

  if (mode === "deep_dive" && !material_id) {
    return NextResponse.json(
      { error: "material_id required for deep_dive mode" },
      { status: 400 }
    );
  }
  if (mode === "audit" && !audit_id) {
    return NextResponse.json(
      { error: "audit_id required for audit mode" },
      { status: 400 }
    );
  }

  // Audit mode: prepare items + return them. Each audit owns one session.
  if (mode === "audit") {
    let prepared;
    try {
      prepared = await prepareAudit(supabase, user.id, audit_id!);
    } catch (err) {
      const message = err instanceof Error ? err.message : "audit prepare failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        mode: "audit",
        items_planned: prepared.items.length,
        device,
      })
      .select("id, started_at")
      .single();
    if (sessionErr || !session) {
      return NextResponse.json(
        { error: `session insert failed: ${sessionErr?.message}` },
        { status: 500 }
      );
    }

    // Link the audit to its session for traceability.
    await supabase
      .from("topic_audits")
      .update({ session_id: session.id })
      .eq("id", audit_id!);

    return NextResponse.json({
      session_id: session.id,
      started_at: session.started_at,
      audit: {
        id: prepared.audit.id,
        material_id: prepared.material.id,
        material_title: prepared.material.title,
        trigger: prepared.audit.trigger,
      },
      items: prepared.items,
    });
  }

  const items = mode === "review"
    ? await selectReviewItems(supabase, user.id, item_count, { shuffle, materialId: material_id })
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

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Review queue: cloze items where due_date <= now, plus newly-generated items
 * (review_count = 0). Capped at 25 new items per day to match CLAUDE.md.
 * Audit-only items (audit_id not null) never appear here.
 *
 * Leech rotation (M2 Phase 3): if it's been ≥7 days since the user reviewed a
 * leech, prepend up to 2 leeches to the front of the queue regardless of due
 * date. Forces them out of the long tail.
 *
 * shuffle=true + materialId: returns all non-suspended cloze items from that
 * material in random order (ignores due dates — intentional for manual review).
 */
async function selectReviewItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
  options: { shuffle?: boolean; materialId?: string } = {}
): Promise<ReviewItem[]> {
  const { shuffle, materialId } = options;

  // Material-specific shuffled review: all cloze cards from that material.
  if (shuffle && materialId) {
    const { data } = await supabase
      .from("items")
      .select(ITEM_SELECT)
      .eq("user_id", userId)
      .eq("material_id", materialId)
      .eq("type", "cloze")
      .eq("is_suspended", false)
      .is("audit_id", null)
      .limit(limit);
    return shuffleArray(withPreviews(data ?? []));
  }
  const nowIso = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: dueRows, error: dueError } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("user_id", userId)
    .eq("type", "cloze")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .lte("fsrs_due_date", nowIso)
    .order("fsrs_due_date", { ascending: true })
    .limit(limit);

  console.log("[review-debug] dueRows:", dueRows?.length, "dueError:", dueError?.message);

  const dueItems = withPreviews(dueRows ?? []);

  // Count distinct NEW items introduced today (items with no reviews before today).
  // We avoid counting review rows directly — a card pressed "Again" multiple times
  // would inflate the counter and incorrectly exhaust the daily new-card budget.
  const { data: todayReviewData } = await supabase
    .from("reviews")
    .select("item_id")
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString())
    .gt("fsrs_rating", 0);

  const todayItemIds = [...new Set((todayReviewData ?? []).map((r) => (r as { item_id: string }).item_id))];

  let newSeenToday = todayItemIds.length;
  if (todayItemIds.length > 0) {
    const { data: priorReviewData } = await supabase
      .from("reviews")
      .select("item_id")
      .eq("user_id", userId)
      .in("item_id", todayItemIds)
      .lt("created_at", todayStart.toISOString());

    const priorSet = new Set((priorReviewData ?? []).map((r) => (r as { item_id: string }).item_id));
    newSeenToday = todayItemIds.filter((id) => !priorSet.has(id)).length;
  }

  const newBudget = Math.max(0, 25 - newSeenToday);
  console.log("[review-debug] todayItemIds:", todayItemIds.length, "newSeenToday:", newSeenToday, "newBudget:", newBudget, "dueItems:", dueItems.length);

  const filtered: ReviewItem[] = [];
  let newAdded = 0;
  for (const item of dueItems) {
    if (item.fsrs_review_count === 0) {
      if (newAdded >= newBudget) continue;
      newAdded++;
    }
    filtered.push(item);
    if (filtered.length >= limit) break;
  }

  // Leech rotation: prepend due-rotation leeches that aren't already in the queue.
  if (await isLeechRotationDue(supabase, userId)) {
    const leeches = await pickLeechCandidates(supabase, userId);
    const present = new Set(filtered.map((i) => i.id));
    const now = new Date();
    const fresh = leeches
      .filter((l) => !present.has(l.id))
      .map<ReviewItem>((l) => ({
        id: l.id,
        material_id: l.material_id,
        type: l.type,
        question: l.question,
        answer_reference: l.answer_reference,
        cloze_data: l.cloze_data,
        difficulty: l.difficulty,
        fsrs_stability: l.fsrs_stability,
        fsrs_difficulty: l.fsrs_difficulty,
        fsrs_due_date: l.fsrs_due_date,
        fsrs_last_review: l.fsrs_last_review,
        fsrs_review_count: l.fsrs_review_count,
        fsrs_lapse_count: l.fsrs_lapse_count,
        is_leech: true,
        preview_intervals: previewIntervals(l, now),
      }));

    const out = [...fresh, ...filtered].slice(0, limit);
    return shuffle ? shuffleArray(out) : out;
  }

  return shuffle ? shuffleArray(filtered) : filtered;
}

async function selectDeepDiveItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string,
  limit: number
): Promise<ReviewItem[]> {
  const { data } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  return withPreviews(data ?? []);
}

const ITEM_SELECT =
  "id, material_id, type, question, answer_reference, cloze_data, difficulty, " +
  "fsrs_stability, fsrs_difficulty, fsrs_due_date, fsrs_last_review, fsrs_review_count, fsrs_lapse_count, is_leech";

type ReviewItem = Pick<
  Item,
  | "id" | "material_id" | "type" | "question" | "answer_reference" | "cloze_data"
  | "difficulty" | "fsrs_stability" | "fsrs_difficulty" | "fsrs_due_date"
  | "fsrs_last_review" | "fsrs_review_count" | "fsrs_lapse_count" | "is_leech"
> & { preview_intervals: IntervalPreview };

function withPreviews(rows: unknown[]): ReviewItem[] {
  const now = new Date();
  return (rows as Omit<ReviewItem, "preview_intervals">[]).map((item) => ({
    ...item,
    preview_intervals: previewIntervals(item, now),
  }));
}
