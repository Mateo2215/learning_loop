import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/export/json
 *
 * Manual JSON export of the current user's data. Streams the response with
 * a Content-Disposition header so the browser triggers a download.
 *
 * Excluded from the dump: `materials.embedding` (1024 floats × N rows would
 * blow up the payload) and any `user_id` columns (single-tenant — exported
 * blob shouldn't carry the auth UUID across machines).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const [
    { data: materials },
    { data: items },
    { data: reviews },
    { data: sessions },
    { data: topicAudits },
    { data: knowledgeGaps },
    { data: calibrationOffsets },
    { data: usageLogs },
    { data: materialRelations },
  ] = await Promise.all([
    supabase
      .from("materials")
      .select("id, title, category, content_compressed, source_filename, source_url, source_type, tags, parent_material_id, insight_note, application_note, status, imported_at, deleted_at, created_at, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("items")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("reviews")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("topic_audits")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("knowledge_gaps")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("calibration_offsets")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("usage_logs")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("material_relations")
      .select("*")
      .eq("user_id", user.id),
  ]);

  // Strip user_id from every row before serialization.
  const stripUser = <T extends Record<string, unknown>>(rows: T[] | null): T[] => {
    if (!rows) return [];
    return rows.map((row) => {
      const copy = { ...row };
      delete (copy as { user_id?: unknown }).user_id;
      return copy;
    });
  };

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    counts: {
      materials: materials?.length ?? 0,
      items: items?.length ?? 0,
      reviews: reviews?.length ?? 0,
      sessions: sessions?.length ?? 0,
      topic_audits: topicAudits?.length ?? 0,
      knowledge_gaps: knowledgeGaps?.length ?? 0,
      calibration_offsets: calibrationOffsets?.length ?? 0,
      usage_logs: usageLogs?.length ?? 0,
      material_relations: materialRelations?.length ?? 0,
    },
    materials: stripUser(materials ?? []),
    items: stripUser(items ?? []),
    reviews: stripUser(reviews ?? []),
    sessions: stripUser(sessions ?? []),
    topic_audits: stripUser(topicAudits ?? []),
    knowledge_gaps: stripUser(knowledgeGaps ?? []),
    calibration_offsets: stripUser(calibrationOffsets ?? []),
    usage_logs: stripUser(usageLogs ?? []),
    material_relations: stripUser(materialRelations ?? []),
  };

  const filename = `learning-loop-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
