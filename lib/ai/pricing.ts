/**
 * AI pricing constants. Verify monthly against:
 *   https://docs.claude.com/en/docs/about-claude/pricing
 *   https://docs.voyageai.com/docs/pricing
 *
 * All numbers are USD per 1M tokens.
 */

export type ModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "voyage-3";

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite?: number;
}

export const PRICING: Record<ModelId, ModelPricing> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "voyage-3": { input: 0.06, output: 0, cacheRead: 0 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
}

export function calculateCost(model: ModelId, usage: TokenUsage): number {
  const p = PRICING[model];
  const cachedIn = usage.cachedInputTokens ?? 0;
  const freshIn = Math.max(0, usage.inputTokens - cachedIn);
  const cacheCreate = usage.cacheCreationTokens ?? 0;

  const inputCost = (freshIn * p.input) / 1_000_000;
  const cacheReadCost = (cachedIn * p.cacheRead) / 1_000_000;
  const cacheWriteCost = (cacheCreate * (p.cacheWrite ?? p.input)) / 1_000_000;
  const outputCost = (usage.outputTokens * p.output) / 1_000_000;

  return inputCost + cacheReadCost + cacheWriteCost + outputCost;
}

export const COST_LIMITS = {
  monthlySoftUsd: 5,
  monthlyHardUsd: 8,
  perCallUsd: 0.5,
} as const;
