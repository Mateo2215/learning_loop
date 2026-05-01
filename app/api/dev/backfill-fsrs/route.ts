import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dev-only one-time backfill: items created before Phase 5 don't have
 * `fsrs_due_date` set. This endpoint sets due_date = now() for all cloze items
 * that are missing it, so they appear in the review queue.
 *
 * Disabled in production. Safe to call multiple times — it's a no-op on items
 * already scheduled.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev endpoints are disabled in production" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("items")
    .update({ fsrs_due_date: nowIso })
    .eq("user_id", user.id)
    .eq("type", "cloze")
    .is("fsrs_due_date", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items_updated: data?.length ?? 0 });
}
