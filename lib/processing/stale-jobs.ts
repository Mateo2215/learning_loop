import type { SupabaseClient } from "@supabase/supabase-js";

export const STALE_IMPORT_JOB_AFTER_MS = 15 * 60 * 1000;
export const STALE_IMPORT_JOB_ERROR = "Import timed out or was interrupted before completion.";

interface StaleCheckJob {
  status: string;
  updated_at: string;
}

export function isStaleImportJob(job: StaleCheckJob, nowMs = Date.now()): boolean {
  if (job.status !== "pending" && job.status !== "running") return false;

  const updatedAtMs = new Date(job.updated_at).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;

  return nowMs - updatedAtMs > STALE_IMPORT_JOB_AFTER_MS;
}

export async function markStaleImportJobs(
  supabase: SupabaseClient,
  userId: string,
  now = new Date()
): Promise<void> {
  const cutoff = new Date(now.getTime() - STALE_IMPORT_JOB_AFTER_MS).toISOString();

  const { error } = await supabase
    .from("processing_jobs")
    .update({
      status: "failed",
      error: STALE_IMPORT_JOB_ERROR,
      completed_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .eq("job_type", "import")
    .in("status", ["pending", "running"])
    .lt("updated_at", cutoff);

  if (error) {
    console.warn("[processing_jobs] stale import cleanup failed:", error.message);
  }
}

export async function markImportJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  now = new Date()
): Promise<void> {
  const { error } = await supabase
    .from("processing_jobs")
    .update({
      status: "failed",
      error: STALE_IMPORT_JOB_ERROR,
      completed_at: now.toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.warn("[processing_jobs] stale import update failed:", error.message);
  }
}
