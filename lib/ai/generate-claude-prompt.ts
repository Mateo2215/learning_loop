/**
 * Sonnet wrapper that generates the Claude.ai prompt for a knowledge gap.
 * Output is plain text — no JSON, no schema. Wrapped by trackAICall at the
 * call site.
 */

import { complete } from "./anthropic";
import { GENERATE_CLAUDE_PROMPT_SYSTEM } from "./prompts/generate-claude-prompt";
import type { GapType } from "@/lib/db/types";
import type { TokenUsage } from "./pricing";

export interface GenerateClaudePromptInput {
  title: string;
  gap_type: GapType;
  affected_tags: string[];
  affected_materials: string[];
  /** Polish category label (e.g. "finansów", "programowania") */
  domain: string;
}

export interface GenerateClaudePromptResponse {
  result: string;
  usage: TokenUsage;
}

export async function generateClaudePrompt(
  input: GenerateClaudePromptInput
): Promise<GenerateClaudePromptResponse> {
  const userMessage = [
    "Luka wiedzy:",
    JSON.stringify(input, null, 2),
    "",
    "Zwróć gotowy prompt zgodnie z szablonem.",
  ].join("\n");

  const out = await complete({
    model: "claude-sonnet-4-6",
    systemPrompt: GENERATE_CLAUDE_PROMPT_SYSTEM,
    userMessage,
    maxTokens: 1500,
    temperature: 0.5,
    cacheSystemPrompt: true,
  });

  // No JSON parsing — just trim accidental code-fence wrappers.
  let s = out.text.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:[a-z]+)?\s*/, "").replace(/\s*```$/, "");
  return { result: s.trim(), usage: out.usage };
}
