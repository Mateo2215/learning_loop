import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * POST /api/user/delete-account
 *
 * Deletes all user data from every table, then removes the auth user via the
 * service role key. The client should redirect to /login after receiving 200.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const uid = user.id;

  // Delete content tables (RLS-protected, user deletes their own rows).
  await supabase.from("reviews").delete().eq("user_id", uid);
  await supabase.from("sessions").delete().eq("user_id", uid);
  await supabase.from("topic_audits").delete().eq("user_id", uid);
  await supabase.from("knowledge_gaps").delete().eq("user_id", uid);
  await supabase.from("processing_jobs").delete().eq("user_id", uid);
  await supabase.from("calibration_offsets").delete().eq("user_id", uid);
  await supabase.from("usage_logs").delete().eq("user_id", uid);
  await supabase.from("items").delete().eq("user_id", uid);

  // material_relations uses material_a_id FK — cascade should handle it,
  // but delete explicitly to be safe.
  const { data: matIds } = await supabase
    .from("materials")
    .select("id")
    .eq("user_id", uid);
  if (matIds && matIds.length > 0) {
    const ids = (matIds as { id: string }[]).map((m) => m.id);
    await supabase.from("material_relations").delete().in("material_a_id", ids);
    await supabase.from("material_relations").delete().in("material_b_id", ids);
  }
  await supabase.from("materials").delete().eq("user_id", uid);

  // Sign out the user's current session before deleting the auth record.
  await supabase.auth.signOut();

  // Remove the auth user — requires service role key to bypass auth guards.
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (adminUrl && adminKey) {
    const admin = createAdminClient(adminUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.auth.admin.deleteUser(uid);
  }

  return NextResponse.json({ ok: true });
}
