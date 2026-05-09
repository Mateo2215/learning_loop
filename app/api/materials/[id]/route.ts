// DELETE /api/materials/:id — soft-delete material + suspend its items + skip pending audits
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: material } = await supabase
    .from("materials")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!material) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  await Promise.all([
    supabase
      .from("materials")
      .update({ deleted_at: now })
      .eq("id", id),
    supabase
      .from("items")
      .update({ is_suspended: true })
      .eq("material_id", id)
      .eq("user_id", user.id),
    supabase
      .from("topic_audits")
      .update({ status: "skipped" })
      .eq("material_id", id)
      .eq("status", "pending"),
  ]);

  return NextResponse.json({ success: true });
}
