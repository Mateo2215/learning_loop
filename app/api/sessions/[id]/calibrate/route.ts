import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CalibrateBodySchema = z.object({
  review_id: z.string().uuid(),
  calibration: z.enum(["agree", "too_strict", "too_lenient"]),
});

/**
 * POST /api/sessions/:id/calibrate
 *
 * User feedback on the AI's evaluation of their open answer:
 *   "agree"        — AI was right
 *   "too_strict"   — AI graded harsher than user thinks they deserved
 *   "too_lenient"  — AI was too generous
 *
 * Phase 6 simply persists the calibration on the reviews row. Phase 2-of-M2
 * will roll these up into `calibration_offsets` and apply per-category bias
 * correction in future validations.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // session id present in URL but not directly needed — RLS covers ownership.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = CalibrateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("reviews")
    .update({ user_calibration: parsed.data.calibration })
    .eq("id", parsed.data.review_id);

  if (error) {
    return NextResponse.json({ error: `calibration save failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
