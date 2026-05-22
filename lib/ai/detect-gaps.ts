/**
 * Sonnet ranker that turns rule-based gap candidates into prioritized rows
 * with severity. Wrapped by trackAICall at the call site.
 */

import { z } from "zod";
import { type ToolDefinition } from "./anthropic";
import { completeWithToolValidated } from "./tool-output";
import { DETECT_GAPS_SYSTEM_PROMPT } from "./prompts/detect-gaps";
import type { GapCandidate } from "@/lib/gaps/detector";
import type { TokenUsage } from "./pricing";

const RankedGapSchema = z.object({
  gap_type: z.enum([
    "low_correct_rate",
    "stale_topic",
    "rising_failures",
    "never_consolidated",
  ]),
  title: z.string().min(3),
  severity: z.enum(["low", "medium", "high"]),
  affected_tags: z.array(z.string()).default([]),
  affected_materials: z.array(z.string()).default([]),
});

const OutputSchema = z.object({
  gaps: z.array(RankedGapSchema).max(8),
});

const SUBMIT_GAPS_TOOL: ToolDefinition = {
  name: "submit_ranked_gaps",
  description: "Submit up to 8 ranked knowledge gaps with severity.",
  inputSchema: {
    type: "object",
    properties: {
      gaps: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            gap_type: { type: "string", enum: ["low_correct_rate", "stale_topic", "rising_failures", "never_consolidated"] },
            title: { type: "string", minLength: 3 },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            affected_tags: { type: "array", items: { type: "string" } },
            affected_materials: { type: "array", items: { type: "string", description: "Material UUID." } },
          },
          required: ["gap_type", "title", "severity", "affected_tags", "affected_materials"],
        },
      },
    },
    required: ["gaps"],
  },
};

export type RankedGap = z.infer<typeof RankedGapSchema>;

export interface DetectGapsResponse {
  result: RankedGap[];
  usage: TokenUsage;
}

export async function rankGapCandidates(
  candidates: GapCandidate[]
): Promise<DetectGapsResponse> {
  const userMessage = [
    "Kandydaci na luki wiedzy:",
    JSON.stringify(candidates, null, 2),
    "",
    "Zwróć max 8 najistotniejszych w ustalonym formacie JSON.",
  ].join("\n");

  const out = await completeWithToolValidated({
    model: "claude-sonnet-4-6",
    systemPrompt: DETECT_GAPS_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1500,
    temperature: 0.4,
    cacheSystemPrompt: true,
    tool: SUBMIT_GAPS_TOOL,
    schema: OutputSchema,
    context: "rankGapCandidates",
  });

  return { result: out.data.gaps, usage: out.usage };
}
