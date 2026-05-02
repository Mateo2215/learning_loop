import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectGapsForUser } from "@/lib/gaps/runner";

/**
 * POST /api/gaps/detect — on-demand gap detection. Run by the user from the
 * /gaps page. Costs one Sonnet call (~$0.005-$0.02 depending on candidate count).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  try {
    const result = await detectGapsForUser(supabase, user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "detection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
