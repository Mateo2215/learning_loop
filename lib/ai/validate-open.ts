/**
 * Sonnet-based validator for open-ended answers. Wrapped by trackAICall at
 * session/answer route. System prompt is per-category and cached (5-min TTL).
 */

import { z } from "zod";
import { completeWithTool, type ToolDefinition } from "./anthropic";
import { buildValidateOpenSystemPrompt } from "./prompts/validate-open";
import type { Category } from "@/lib/db/types";
import type { TokenUsage } from "./pricing";

const ValidateOpenSchema = z.object({
  evaluation: z.enum(["correct", "partially_correct", "incorrect"]),
  score: z.number().int().min(1).max(10),
  feedback_positive: z.string().default(""),
  feedback_negative: z.string().default(""),
});

const SUBMIT_VALIDATION_TOOL: ToolDefinition = {
  name: "submit_validation",
  description: "Submit the evaluation of the learner's open-ended answer.",
  inputSchema: {
    type: "object",
    properties: {
      evaluation: { type: "string", enum: ["correct", "partially_correct", "incorrect"] },
      score: { type: "integer", minimum: 1, maximum: 10 },
      feedback_positive: { type: "string", description: "1-2 sentences on what the learner got right (empty string if nothing)." },
      feedback_negative: { type: "string", description: "1-3 sentences on what was missing or wrong; cite specific terms from the reference." },
    },
    required: ["evaluation", "score", "feedback_positive", "feedback_negative"],
  },
};

export type ValidateOpenResult = z.infer<typeof ValidateOpenSchema>;

export interface ValidateOpenInput {
  category: Category;
  question: string;
  referenceAnswer: string;
  userAnswer: string;
  /** Optional calibration offset in [-1, +1]; 0 means neutral. */
  calibrationOffset?: number;
  /** Optional score calibration offset in [-2, +2]; 0 means neutral. */
  scoreOffset?: number;
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

  const out = await completeWithTool({
    model: "claude-sonnet-4-6",
    systemPrompt: buildValidateOpenSystemPrompt(
      input.category,
      input.calibrationOffset ?? 0,
      input.scoreOffset ?? 0
    ),
    userMessage,
    maxTokens: 600,
    temperature: 0.3,
    cacheSystemPrompt: true,
    tool: SUBMIT_VALIDATION_TOOL,
  });

  const parsed = ValidateOpenSchema.parse(out.data);
  return { result: parsed, usage: out.usage };
}
