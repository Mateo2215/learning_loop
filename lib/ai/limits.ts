import { COST_LIMITS } from "./pricing";
import { isNonCritical, type OperationType } from "./operations";
import { CostLimitExceededError } from "./errors";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sum of `cost_usd` from `usage_logs` for the current calendar month (UTC).
 * Returns 0 if there are no entries yet.
 */
export async function getMonthlyUsage(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data, error } = await supabase
    .from("usage_logs")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}

/**
 * Throws CostLimitExceededError if a non-critical operation would push us over hard limit.
 * Critical operations (validate_open_answer, validate_feynman, etc.) always pass.
 * Per-call cap is enforced AFTER the call, by inspecting actual cost.
 */
export async function enforceMonthlyLimit(
  supabase: SupabaseClient,
  userId: string,
  operation: OperationType
): Promise<{ monthlyUsd: number; softHit: boolean }> {
  const monthlyUsd = await getMonthlyUsage(supabase, userId);

  if (monthlyUsd >= COST_LIMITS.monthlyHardUsd && isNonCritical(operation)) {
    throw new CostLimitExceededError("monthly_hard", monthlyUsd, COST_LIMITS.monthlyHardUsd);
  }

  return { monthlyUsd, softHit: monthlyUsd >= COST_LIMITS.monthlySoftUsd };
}

/**
 * Per-call safety net. Run AFTER actual cost is known. Catches bugs (runaway prompts,
 * infinite loops). Does not undo the API call — but flags it loudly.
 */
export function assertPerCallLimit(costUsd: number): void {
  if (costUsd > COST_LIMITS.perCallUsd) {
    throw new CostLimitExceededError("per_call", costUsd, COST_LIMITS.perCallUsd);
  }
}
