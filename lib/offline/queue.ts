"use client";

/**
 * Outbox-style queue for session answers. Components call `queueReview` always
 * — `flushQueue` decides whether to ship to the server (online) or keep
 * waiting. `online` event triggers an automatic flush.
 */

import {
  addPendingReview,
  countPendingReviews,
  deletePendingReview,
  listSyncablePendingReviews,
  makeReviewId,
  updatePendingReview,
  type PendingReview,
} from "./db";

export interface QueueReviewInput {
  session_id: string;
  item_id: string;
  fsrs_rating?: 1 | 2 | 3 | 4;
  user_answer?: string;
  response_time_ms?: number;
}

export async function queueReview(input: QueueReviewInput): Promise<string> {
  const id = makeReviewId();
  const review: PendingReview = {
    id,
    session_id: input.session_id,
    item_id: input.item_id,
    fsrs_rating: input.fsrs_rating,
    user_answer: input.user_answer,
    response_time_ms: input.response_time_ms,
    queued_at: Date.now(),
    sync_status: "pending",
  };
  await addPendingReview(review);
  return id;
}

export interface FlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Send all `sync_status='pending'` reviews to the sync-offline endpoint.
 * Successful rows get deleted from IDB; failures stay queued with the latest
 * error message.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const pending = await listSyncablePendingReviews();
  if (pending.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  // Mark all as syncing so we don't double-flush from a race
  await Promise.all(pending.map((r) => updatePendingReview(r.id, { sync_status: "syncing" })));

  const payload = pending.map((r) => ({
    client_id: r.id,
    session_id: r.session_id,
    item_id: r.item_id,
    fsrs_rating: r.fsrs_rating,
    user_answer: r.user_answer,
    response_time_ms: r.response_time_ms,
  }));

  let body: { results?: Array<{ client_id: string; ok: boolean; error?: string }> } = {};
  try {
    const res = await fetch("/api/sessions/sync-offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviews: payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    await Promise.all(
      pending.map((r) =>
        updatePendingReview(r.id, { sync_status: "pending", last_error: message })
      )
    );
    return { attempted: pending.length, succeeded: 0, failed: pending.length };
  }

  const results = body.results ?? [];
  let ok = 0;
  let bad = 0;
  for (const r of results) {
    if (r.ok) {
      await deletePendingReview(r.client_id);
      ok += 1;
    } else {
      await updatePendingReview(r.client_id, {
        sync_status: "pending",
        last_error: r.error ?? "server error",
      });
      bad += 1;
    }
  }

  // Any review that we sent but didn't get a result for stays "syncing" — flip it back.
  const acknowledged = new Set(results.map((r) => r.client_id));
  for (const r of pending) {
    if (!acknowledged.has(r.id)) {
      await updatePendingReview(r.id, {
        sync_status: "pending",
        last_error: "missing server ack",
      });
      bad += 1;
    }
  }

  return { attempted: pending.length, succeeded: ok, failed: bad };
}

export async function pendingCount(): Promise<number> {
  try {
    return await countPendingReviews();
  } catch {
    return 0;
  }
}
