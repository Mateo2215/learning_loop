import { calculateCost, type ModelId, type TokenUsage } from "./pricing";
import { assertPerCallLimit, enforceMonthlyLimit } from "./limits";
import type { OperationType } from "./operations";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TrackedCallParams<T> {
  supabase: SupabaseClient;
  userId: string;
  operation: OperationType;
  model: ModelId;
  materialId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  call: () => Promise<{ result: T; usage: TokenUsage }>;
}

export interface TrackedCallResult<T> {
  result: T;
  costUsd: number;
  monthlyUsd: number;
  softHit: boolean;
}

/**
 * The ONLY allowed entry point for AI API calls in this app.
 *
 * Pre-flight: enforces monthly hard limit (skips for critical operations).
 * On success: writes one row to `usage_logs` with token counts and cost.
 * On failure: still writes a row with the error in `metadata`, then re-throws.
 * Post-flight: throws CostLimitExceededError if the call alone exceeded per-call cap.
 *
 * Every Anthropic/Voyage call must go through this wrapper. No exceptions.
 */
export async function trackAICall<T>(params: TrackedCallParams<T>): Promise<TrackedCallResult<T>> {
  const { supabase, userId, operation, model } = params;
  const startedAt = Date.now();

  const { monthlyUsd: preMonthly, softHit } = await enforceMonthlyLimit(
    supabase,
    userId,
    operation
  );

  let result: T;
  let usage: TokenUsage;

  try {
    const out = await params.call();
    result = out.result;
    usage = out.usage;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logUsageRow(supabase, {
      user_id: userId,
      operation_type: operation,
      model,
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
      cost_usd: 0,
      material_id: params.materialId ?? null,
      session_id: params.sessionId ?? null,
      metadata: {
        ...(params.metadata ?? {}),
        error: message,
        durationMs: Date.now() - startedAt,
      },
    });
    throw err;
  }

  const costUsd = calculateCost(model, usage);

  await logUsageRow(supabase, {
    user_id: userId,
    operation_type: operation,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_input_tokens: usage.cachedInputTokens ?? 0,
    cost_usd: costUsd,
    material_id: params.materialId ?? null,
    session_id: params.sessionId ?? null,
    metadata: {
      ...(params.metadata ?? {}),
      durationMs: Date.now() - startedAt,
      cacheCreationTokens: usage.cacheCreationTokens ?? 0,
    },
  });

  assertPerCallLimit(costUsd);

  return { result, costUsd, monthlyUsd: preMonthly + costUsd, softHit };
}

interface UsageLogRow {
  user_id: string;
  operation_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cost_usd: number;
  material_id: string | null;
  session_id: string | null;
  metadata: Record<string, unknown>;
}

async function logUsageRow(supabase: SupabaseClient, row: UsageLogRow): Promise<void> {
  const { error } = await supabase.from("usage_logs").insert(row);
  if (error) {
    console.error("[trackAICall] failed to write usage_log row:", error.message, row);
  }
}
