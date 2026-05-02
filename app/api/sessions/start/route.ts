import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prepareAudit } from "@/lib/audits/scheduler";
import type { Item } from "@/lib/db/types";

const StartBodySchema = z.object({
  mode: z.enum(["review", "deep_dive", "audit"]),
  material_id: z.string().uuid().optional(),
  audit_id: z.string().uuid().optional(),
  item_count: z.number().int().min(1).max(50).default(20),
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
  const { mode, material_id, audit_id, item_count } = parsed.data;

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
 * Audit-only items (audit_id not null) never appear here.
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
    .is("audit_id", null)
    .lte("fsrs_due_date", nowIso)
    .order("fsrs_due_date", { ascending: true })
    .limit(limit);

  const dueItems = (dueRows ?? []) as ReviewItem[];

  const { count: newSeenToday } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString())
    .gt("fsrs_rating", 0);

  const newAlreadyReviewed = newSeenToday ?? 0;
  const newBudget = Math.max(0, 25 - newAlreadyReviewed);

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
    .is("audit_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as ReviewItem[];
}

type ReviewItem = Pick<
  Item,
  "id" | "material_id" | "type" | "question" | "answer_reference" | "cloze_data" | "difficulty" | "fsrs_due_date" | "fsrs_review_count"
>;
