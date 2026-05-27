import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionCounts } from "@/lib/db/counts";

/**
 * GET /api/sessions/counts
 *
 * Feeds the mobile session picker (bottom sheet) and the "Sesje" tab badge:
 * how many reviews are due, deep-dive questions exist, audits are overdue, and
 * knowledge gaps are open. Read-only, cheap COUNT queries.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  try {
    const counts = await getSessionCounts(supabase, user.id);
    return NextResponse.json(counts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
