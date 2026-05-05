import type { createClient } from "@/lib/supabase/server";

/**
 * A session is "active" when ended_at is null AND it was started within the
 * last STALE_AFTER_HOURS. Older sessions are abandoned (browser closed mid-flow)
 * and should not block a new session on a different device.
 */
const STALE_AFTER_HOURS = 6;

export interface ActiveSession {
  id: string;
  mode: "review" | "deep_dive" | "audit";
  device: "desktop" | "mobile" | string | null;
  started_at: string;
}

export async function findActiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ActiveSession | null> {
  const cutoffIso = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("sessions")
    .select("id, mode, device, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .gte("started_at", cutoffIso)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ActiveSession | null) ?? null;
}

/**
 * End any active sessions for this user. Used when the client passes force=true
 * to take over from a stale or another-device session.
 */
export async function endActiveSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null);
}
