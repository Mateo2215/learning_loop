/**
 * Wraps Haiku item-generation prompts and returns parsed, validated items
 * ready to insert into the `items` table. Token usage flows back to the caller.
 */

import { z } from "zod";
import { complete } from "@/lib/ai/anthropic";
import { GENERATE_CLOZE_SYSTEM_PROMPT } from "@/lib/ai/prompts/generate-cloze";
import { GENERATE_OPEN_SYSTEM_PROMPT } from "@/lib/ai/prompts/generate-open";
import type { TokenUsage } from "@/lib/ai/pricing";

const ClozeCardSchema = z.object({
  front: z.string().min(1),
  answer: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const ClozeBatchSchema = z.object({
  cards: z.array(ClozeCardSchema).min(1).max(50),
});

const OpenQuestionSchema = z.object({
  question: z.string().min(5),
  answer_reference: z.string().min(20),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const OpenBatchSchema = z.object({
  questions: z.array(OpenQuestionSchema).min(1).max(12),
});

export type ClozeCard = z.infer<typeof ClozeCardSchema>;
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export interface GenerateClozeResult {
  cards: ClozeCard[];
  usage: TokenUsage;
}

export async function generateClozeCards(compressedContent: string): Promise<GenerateClozeResult> {
  const out = await complete({
    model: "claude-haiku-4-5",
    systemPrompt: GENERATE_CLOZE_SYSTEM_PROMPT,
    userMessage: `Materiał:\n\n${compressedContent}`,
    maxTokens: 4000,
    temperature: 0.7,
    cacheSystemPrompt: true,
  });

  const parsed = parseJsonStrict(out.text);
  const validated = ClozeBatchSchema.parse(parsed);
  return { cards: validated.cards, usage: out.usage };
}

export interface GenerateOpenResult {
  questions: OpenQuestion[];
  usage: TokenUsage;
}

export async function generateOpenQuestions(compressedContent: string): Promise<GenerateOpenResult> {
  const out = await complete({
    model: "claude-haiku-4-5",
    systemPrompt: GENERATE_OPEN_SYSTEM_PROMPT,
    userMessage: `Materiał:\n\n${compressedContent}`,
    maxTokens: 3000,
    temperature: 0.7,
    cacheSystemPrompt: true,
  });

  const parsed = parseJsonStrict(out.text);
  const validated = OpenBatchSchema.parse(parsed);
  return { questions: validated.questions, usage: out.usage };
}

/**
 * Tolerant JSON parser — strips markdown fences and leading/trailing prose,
 * then fixes unescaped control characters (newlines, tabs) inside string
 * values, which Haiku occasionally emits on dense financial/technical content.
 */
function parseJsonStrict(text: string): unknown {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(s);
  } catch {
    // Second attempt: escape literal control characters inside JSON strings.
    // Tracks parser state char-by-char so we only touch characters inside strings.
    return JSON.parse(escapeControlCharsInStrings(s));
  }
}

function escapeControlCharsInStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }
  return result;
}
