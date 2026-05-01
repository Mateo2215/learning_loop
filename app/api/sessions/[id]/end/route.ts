import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sessions/:id/end
 *
 * Marks a session as ended (sets ended_at). Returns a small summary so the UI
 * can show the post-session screen without an extra GET.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  // Count reviews for this session
  const { count: completed } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await supabase
    .from("sessions")
    .update({
      ended_at: new Date().toISOString(),
      items_completed: completed ?? 0,
    })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: `session end failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items_completed: completed ?? 0 });
}
