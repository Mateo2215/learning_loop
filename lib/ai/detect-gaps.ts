/**
 * Sonnet ranker that turns rule-based gap candidates into prioritized rows
 * with severity. Wrapped by trackAICall at the call site.
 */

import { z } from "zod";
import { complete } from "./anthropic";
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

  const out = await complete({
    model: "claude-sonnet-4-6",
    systemPrompt: DETECT_GAPS_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1500,
    temperature: 0.4,
    cacheSystemPrompt: true,
  });

  let s = out.text.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) s = s.slice(firstBrace, lastBrace + 1);

  const parsed = OutputSchema.parse(JSON.parse(s));
  return { result: parsed.gaps, usage: out.usage };
}
