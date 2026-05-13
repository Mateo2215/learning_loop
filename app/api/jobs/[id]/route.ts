import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isStaleImportJob,
  markImportJobFailed,
  STALE_IMPORT_JOB_ERROR,
} from "@/lib/processing/stale-jobs";

/**
 * GET /api/jobs/:id — return current state of a processing_jobs row
 * for the authenticated user (RLS enforces ownership).
 *
 * Used by the import page to poll for progress. We'll switch to Realtime
 * subscriptions in M3.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("processing_jobs")
    .select("id, job_type, status, progress, error, result, created_at, updated_at, completed_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  if (data.job_type === "import" && isStaleImportJob(data)) {
    await markImportJobFailed(supabase, id);
    return NextResponse.json({
      ...data,
      status: "failed",
      error: STALE_IMPORT_JOB_ERROR,
      completed_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(data);
}
