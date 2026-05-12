import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prepareAudit } from "@/lib/audits/scheduler";
import { isLeechRotationDue, pickLeechCandidates } from "@/lib/db/leeches";
import { endActiveSessions, findActiveSession, type ActiveSession } from "@/lib/sessions/active-guard";
import { capDeepDiveRoundSize, DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";
import { previewIntervals, type IntervalPreview } from "@/lib/fsrs/scheduler";
import type { Item } from "@/lib/db/types";

const DAILY_NEW_CARD_LIMIT = 50;

const StartBodySchema = z.object({
  mode: z.enum(["review", "deep_dive", "audit"]),
  material_id: z.string().uuid().optional(),
  audit_id: z.string().uuid().optional(),
  item_count: z.number().int().min(1).max(50).default(20),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  force: z.boolean().default(false),
  shuffle: z.boolean().default(false),
  bypass_new_limit: z.boolean().default(false),
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
  const { mode, material_id, audit_id, item_count, device, force, shuffle, bypass_new_limit } = parsed.data;

  if (mode === "deep_dive" && !material_id) {
    return NextResponse.json(
      { error: "material_id required for deep_dive mode" },
      { status: 400 }
    );
  }

  // Deep Dive pauses are durable: resume the same material even if the session
  // is older than the generic cross-device stale cutoff.
  if (mode === "deep_dive" && material_id && !force) {
    const paused = await findPausedDeepDiveSession(supabase, user.id, material_id);
    if (paused) {
      const competing = await findActiveSession(supabase, user.id);
      if (competing && competing.id !== paused.id) {
        return NextResponse.json(
          {
            error: "active_session_elsewhere",
            active_session: competing,
          },
          { status: 409 }
        );
      }
      const resumed = await resumeDeepDiveSession(supabase, user.id, paused);
      if (resumed) return NextResponse.json(resumed);
      await endSessionWithCompletedCount(supabase, paused.id);
    }
  }

  // Cross-device guard: only one active session at a time. Other active session
  // types, or Deep Dive for another material, still require takeover.
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

  if (mode === "review") {
    const result = await selectReviewItems(supabase, user.id, item_count, {
      shuffle,
      materialId: material_id,
      bypassNewLimit: bypass_new_limit,
    });

    if (result.kind === "cap_reached") {
      return NextResponse.json(
        { error: "new_card_limit_reached", blocked: result.blocked },
        { status: 422 },
      );
    }

    if (result.items.length === 0) {
      return NextResponse.json({ error: "no_items_available" }, { status: 404 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, mode, items_planned: result.items.length, device: "desktop" })
      .select("id, started_at")
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: `session insert failed: ${sessionErr?.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ session_id: session.id, started_at: session.started_at, items: result.items });
  }

  const items = await selectDeepDiveItems(
    supabase,
    user.id,
    material_id!,
    capDeepDiveRoundSize(item_count)
  );

  if (items.length === 0) {
    return NextResponse.json({ error: "no_items_available" }, { status: 404 });
  }

  const materialTitle = await getMaterialTitle(supabase, user.id, material_id!);

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      mode,
      items_planned: items.length,
      material_id: material_id!,
      planned_item_ids: items.map((item) => item.id),
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

  return NextResponse.json({
    session_id: session.id,
    started_at: session.started_at,
    items,
    material_title: materialTitle,
    resumed: false,
    completed_item_ids: [],
    next_index: 0,
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

async function findPausedDeepDiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string
): Promise<ActiveSession | null> {
  const { data } = await supabase
    .from("sessions")
    .select("id, mode, device, material_id, planned_item_ids, items_planned, items_completed, started_at")
    .eq("user_id", userId)
    .eq("mode", "deep_dive")
    .eq("material_id", materialId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ActiveSession | null) ?? null;
}

async function resumeDeepDiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  session: ActiveSession
) {
  const plannedIds = session.planned_item_ids ?? [];
  if (plannedIds.length === 0 || !session.material_id) return null;

  const [items, completedItemIds, materialTitle] = await Promise.all([
    selectDeepDiveItemsByIds(supabase, userId, plannedIds),
    getCompletedItemIds(supabase, session.id),
    getMaterialTitle(supabase, userId, session.material_id),
  ]);

  if (items.length === 0) return null;

  const completedSet = new Set(completedItemIds);
  const completedPlannedIds = plannedIds.filter((id) => completedSet.has(id));
  if (completedPlannedIds.length >= DEEP_DIVE_ROUND_SIZE) return null;

  const remainingSlots = DEEP_DIVE_ROUND_SIZE - completedPlannedIds.length;
  const nextUnansweredIds = plannedIds
    .filter((id) => !completedSet.has(id))
    .slice(0, remainingSlots);
  const effectivePlannedIds = [...completedPlannedIds, ...nextUnansweredIds];
  if (effectivePlannedIds.length === 0) return null;

  const effectiveItems = itemsByPlannedOrder(items, effectivePlannedIds);
  const effectiveCompletedSet = new Set(completedPlannedIds);
  const nextIndex = effectiveItems.findIndex((item) => !effectiveCompletedSet.has(item.id));
  if (nextIndex < 0) return null;

  if (
    effectivePlannedIds.length !== plannedIds.length ||
    effectivePlannedIds.some((id, index) => id !== plannedIds[index])
  ) {
    await supabase
      .from("sessions")
      .update({
        planned_item_ids: effectivePlannedIds,
        items_planned: effectivePlannedIds.length,
      })
      .eq("id", session.id);
  }

  return {
    session_id: session.id,
    started_at: session.started_at,
    items: effectiveItems,
    material_title: materialTitle,
    resumed: true,
    completed_item_ids: completedPlannedIds,
    next_index: nextIndex,
  };
}

async function getCompletedItemIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("reviews")
    .select("item_id")
    .eq("session_id", sessionId);

  return [...new Set((data ?? []).map((row) => (row as { item_id: string }).item_id))];
}

async function endSessionWithCompletedCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<void> {
  const { count: completed } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
      items_completed: completed ?? 0,
    })
    .eq("id", sessionId);
}

async function getMaterialTitle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  materialId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("materials")
    .select("title")
    .eq("user_id", userId)
    .eq("id", materialId)
    .maybeSingle();

  return (data as { title: string } | null)?.title ?? null;
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
type SelectReviewResult =
  | { kind: "ok"; items: ReviewItem[] }
  | { kind: "cap_reached"; blocked: number };

async function selectReviewItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
  options: { shuffle?: boolean; materialId?: string; bypassNewLimit?: boolean } = {}
): Promise<SelectReviewResult> {
  const { shuffle, materialId, bypassNewLimit } = options;

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
    return { kind: "ok", items: shuffleArray(withPreviews(data ?? [])) };
  }
  const nowIso = new Date().toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: dueRows } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("user_id", userId)
    .eq("type", "cloze")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .lte("fsrs_due_date", nowIso)
    .order("fsrs_due_date", { ascending: true })
    .limit(limit);

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

  const newBudget = bypassNewLimit ? limit : Math.max(0, DAILY_NEW_CARD_LIMIT - newSeenToday);

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

  // When the cap blocked all items, signal the caller so it can offer a bypass.
  if (filtered.length === 0 && dueItems.some((i) => i.fsrs_review_count === 0) && newBudget === 0) {
    return { kind: "cap_reached", blocked: dueItems.filter((i) => i.fsrs_review_count === 0).length };
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
    return { kind: "ok", items: shuffle ? shuffleArray(out) : out };
  }

  return { kind: "ok", items: shuffle ? shuffleArray(filtered) : filtered };
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
    .order("created_at", { ascending: true });

  const items = withPreviews(data ?? []);
  if (items.length === 0) return [];

  const latestReviewByItem = await getLatestReviewByItem(supabase, userId, items.map((item) => item.id));
  const originalOrder = new Map(items.map((item, index) => [item.id, index]));

  return [...items]
    .sort((a, b) => {
      const aReviewedAt = latestReviewByItem.get(a.id);
      const bReviewedAt = latestReviewByItem.get(b.id);
      if (!aReviewedAt && bReviewedAt) return -1;
      if (aReviewedAt && !bReviewedAt) return 1;
      if (!aReviewedAt && !bReviewedAt) {
        return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
      }
      return new Date(aReviewedAt!).getTime() - new Date(bReviewedAt!).getTime();
    })
    .slice(0, limit);
}

async function selectDeepDiveItemsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemIds: string[]
): Promise<ReviewItem[]> {
  if (itemIds.length === 0) return [];

  const { data } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("user_id", userId)
    .eq("type", "open")
    .eq("is_suspended", false)
    .is("audit_id", null)
    .in("id", itemIds);

  const byId = new Map(withPreviews(data ?? []).map((item) => [item.id, item]));
  return itemIds.map((id) => byId.get(id)).filter((item): item is ReviewItem => Boolean(item));
}

async function getLatestReviewByItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemIds: string[]
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();

  const { data } = await supabase
    .from("reviews")
    .select("item_id, created_at")
    .eq("user_id", userId)
    .in("item_id", itemIds)
    .order("created_at", { ascending: false });

  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    const review = row as { item_id: string; created_at: string };
    if (!latest.has(review.item_id)) latest.set(review.item_id, review.created_at);
  }
  return latest;
}

function itemsByPlannedOrder(items: ReviewItem[], plannedIds: string[]): ReviewItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return plannedIds.map((id) => byId.get(id)).filter((item): item is ReviewItem => Boolean(item));
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
