export class CostLimitExceededError extends Error {
  constructor(
    public readonly kind: "monthly_hard" | "per_call",
    public readonly currentUsd: number,
    public readonly limitUsd: number
  ) {
    super(
      `Cost limit exceeded (${kind}): ${currentUsd.toFixed(4)} USD vs limit ${limitUsd.toFixed(2)} USD`
    );
    this.name = "CostLimitExceededError";
  }
}

export class AIProviderError extends Error {
  constructor(
    public readonly provider: "anthropic" | "voyage",
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AIProviderError";
  }
}
