import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/user/clear-data
 *
 * Wipes all user content: materials, items, reviews, sessions, audits,
 * gaps, costs, and calibration. The auth account is preserved.
 *
 * Order matters because of FK constraints. Materials cascade-delete
 * their items, reviews, topic_audits and material_relations, but
 * sessions, knowledge_gaps, processing_jobs, usage_logs and
 * calibration_offsets must be cleared explicitly.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const uid = user.id;

  await supabase.from("sessions").delete().eq("user_id", uid);
  await supabase.from("knowledge_gaps").delete().eq("user_id", uid);
  await supabase.from("materials").delete().eq("user_id", uid);
  await supabase.from("processing_jobs").delete().eq("user_id", uid);
  await supabase.from("usage_logs").delete().eq("user_id", uid);
  await supabase.from("calibration_offsets").delete().eq("user_id", uid);

  return NextResponse.json({ ok: true });
}
