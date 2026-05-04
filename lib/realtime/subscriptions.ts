"use client";

/**
 * Thin wrappers around Supabase Realtime channels. Each helper returns the
 * channel handle; caller must `.unsubscribe()` (or `removeChannel()`) on cleanup.
 *
 * Tables must be in the `supabase_realtime` publication for events to fire.
 * Migration 0005 adds processing_jobs, materials, sessions to the publication.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type ChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T>;
};

/**
 * Subscribe to UPDATE events on a single processing_jobs row.
 * Calls `onChange` with the freshly updated row.
 */
export function subscribeProcessingJob<T extends { id: string }>(
  jobId: string,
  onChange: (row: T) => void
): RealtimeChannel {
  const supabase = createClient();
  const channel = supabase
    .channel(`processing_jobs:${jobId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "processing_jobs",
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        const row = (payload as unknown as ChangePayload<T>).new;
        if (row && row.id === jobId) onChange(row);
      }
    )
    .subscribe();
  return channel;
}

/**
 * Subscribe to material status changes for a given user — used by the
 * dashboard / fresh-materials widget to refresh after import completes.
 */
export function subscribeMaterials<T>(
  userId: string,
  onChange: (payload: ChangePayload<T>) => void
): RealtimeChannel {
  const supabase = createClient();
  const channel = supabase
    .channel(`materials:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "materials",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onChange(payload as unknown as ChangePayload<T>)
    )
    .subscribe();
  return channel;
}
