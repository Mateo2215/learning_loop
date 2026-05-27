/**
 * Lightweight count queries that feed the mobile session picker (bottom sheet)
 * and the "Sesje" tab badge. All use `head: true` so Postgres returns only the
 * count, never the rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SessionCounts {
  /** Cloze items due for review now (daily-new cap not applied here). */
  reviewsDue: number;
  /** Open questions available for Deep Dive (excludes audit-only items). */
  deepDiveAvailable: number;
  /** Pending audits whose scheduled_for has passed (overdue). */
  auditsDue: number;
  /** Knowledge gaps still open. */
  gapsOpen: number;
}

async function countOrZero(
  query: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/**
 * One round-trip per counter (four cheap COUNT queries). Failures degrade to 0
 * so a transient error never blanks the whole nav.
 */
export async function getSessionCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionCounts> {
  const nowIso = new Date().toISOString();

  const [reviewsDue, deepDiveAvailable, auditsDue, gapsOpen] = await Promise.all([
    countOrZero(
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "cloze")
        .eq("is_suspended", false)
        .is("audit_id", null)
        .lte("fsrs_due_date", nowIso)
    ),
    countOrZero(
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "open")
        .eq("is_suspended", false)
        .is("audit_id", null)
    ),
    countOrZero(
      supabase
        .from("topic_audits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
    ),
    countOrZero(
      supabase
        .from("knowledge_gaps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "open")
    ),
  ]);

  return { reviewsDue, deepDiveAvailable, auditsDue, gapsOpen };
}
