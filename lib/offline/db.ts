"use client";

/**
 * IndexedDB wrapper for offline session support.
 *
 * Two stores:
 *   - cached_sessions: snapshot of a session at start (id, mode, items[]).
 *     Lets the user re-open mid-session offline and replay through items.
 *   - pending_reviews: answers queued while offline (cloze ratings or open
 *     answers). Flushed by `lib/offline/queue.ts` when connectivity returns.
 *
 * Schema version 1. Bump and add migration in `upgrade()` if shape changes.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "learning-loop";
const DB_VERSION = 1;

export interface CachedSession {
  session_id: string;
  mode: "review" | "deep_dive" | "audit";
  started_at: string;
  items: CachedItem[];
}

export interface CachedItem {
  id: string;
  material_id: string;
  type: "cloze" | "open";
  question: string;
  answer_reference: string | null;
  cloze_data: { front: string; answer: string } | null;
  difficulty: "easy" | "medium" | "hard" | null;
  fsrs_review_count: number;
  is_leech?: boolean;
}

export interface PendingReview {
  /** Auto-generated client UUID */
  id: string;
  session_id: string;
  item_id: string;
  /** Required for cloze sessions */
  fsrs_rating?: 1 | 2 | 3 | 4;
  /** Required for open sessions */
  user_answer?: string;
  response_time_ms?: number;
  queued_at: number;
  sync_status: "pending" | "syncing" | "synced" | "failed";
  last_error?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cached_sessions")) {
          db.createObjectStore("cached_sessions", { keyPath: "session_id" });
        }
        if (!db.objectStoreNames.contains("pending_reviews")) {
          const store = db.createObjectStore("pending_reviews", { keyPath: "id" });
          store.createIndex("session_id", "session_id", { unique: false });
          store.createIndex("sync_status", "sync_status", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

export async function putCachedSession(session: CachedSession): Promise<void> {
  const db = await getDb();
  await db.put("cached_sessions", session);
}

export async function getCachedSession(sessionId: string): Promise<CachedSession | undefined> {
  const db = await getDb();
  return db.get("cached_sessions", sessionId);
}

export async function deleteCachedSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete("cached_sessions", sessionId);
}

export async function addPendingReview(review: PendingReview): Promise<void> {
  const db = await getDb();
  await db.put("pending_reviews", review);
}

export async function listPendingReviews(
  sessionId?: string
): Promise<PendingReview[]> {
  const db = await getDb();
  if (sessionId) {
    return db.getAllFromIndex("pending_reviews", "session_id", sessionId);
  }
  return db.getAll("pending_reviews");
}

export async function listSyncablePendingReviews(): Promise<PendingReview[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("pending_reviews", "sync_status", "pending");
  return all;
}

export async function updatePendingReview(
  id: string,
  patch: Partial<PendingReview>
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("pending_reviews", "readwrite");
  const store = tx.objectStore("pending_reviews");
  const existing = await store.get(id);
  if (!existing) {
    await tx.done;
    return;
  }
  await store.put({ ...existing, ...patch });
  await tx.done;
}

export async function deletePendingReview(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("pending_reviews", id);
}

export async function countPendingReviews(): Promise<number> {
  const db = await getDb();
  const tx = db.transaction("pending_reviews", "readonly");
  const idx = tx.objectStore("pending_reviews").index("sync_status");
  return idx.count("pending");
}

export function makeReviewId(): string {
  // Simple client-side ID — only used as IDB key, never sent to server.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
