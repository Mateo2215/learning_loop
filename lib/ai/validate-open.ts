/**
 * Sonnet-based validator for open-ended answers. Wrapped by trackAICall at
 * session/answer route. System prompt is per-category and cached (5-min TTL).
 */

import { z } from "zod";
import { complete } from "./anthropic";
import { buildValidateOpenSystemPrompt } from "./prompts/validate-open";
import type { Category } from "@/lib/db/types";
import type { TokenUsage } from "./pricing";

const ValidateOpenSchema = z.object({
  evaluation: z.enum(["correct", "partially_correct", "incorrect"]),
  feedback_positive: z.string().default(""),
  feedback_negative: z.string().default(""),
});

export type ValidateOpenResult = z.infer<typeof ValidateOpenSchema>;

export interface ValidateOpenInput {
  category: Category;
  question: string;
  referenceAnswer: string;
  userAnswer: string;
  /** Optional calibration offset in [-1, +1]; 0 means neutral. */
  calibrationOffset?: number;
}

export interface ValidateOpenResponse {
  result: ValidateOpenResult;
  usage: TokenUsage;
}

export async function validateOpenAnswer(input: ValidateOpenInput): Promise<ValidateOpenResponse> {
  const userMessage = [
    `Pytanie:\n${input.question}`,
    `\nWzorcowa odpowiedź:\n${input.referenceAnswer}`,
    `\nOdpowiedź uczącego się:\n${input.userAnswer}`,
  ].join("\n");

  const out = await complete({
    model: "claude-sonnet-4-6",
    systemPrompt: buildValidateOpenSystemPrompt(input.category, input.calibrationOffset ?? 0),
    userMessage,
    maxTokens: 600,
    temperature: 0.3,
    cacheSystemPrompt: true,
  });

  let s = out.text.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) s = s.slice(firstBrace, lastBrace + 1);

  const parsed = ValidateOpenSchema.parse(JSON.parse(s));
  return { result: parsed, usage: out.usage };
}
