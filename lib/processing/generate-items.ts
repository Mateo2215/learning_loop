/**
 * Wraps Haiku item-generation prompts and returns parsed, validated items
 * ready to insert into the `items` table. Token usage flows back to the caller.
 */

import { z } from "zod";
import { complete } from "@/lib/ai/anthropic";
import { parseAIJson } from "@/lib/ai/json";
import { GENERATE_CLOZE_SYSTEM_PROMPT } from "@/lib/ai/prompts/generate-cloze";
import { GENERATE_OPEN_SYSTEM_PROMPT } from "@/lib/ai/prompts/generate-open";
import { DEEP_DIVE_ROUND_SIZE } from "@/lib/sessions/deep-dive";
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

const EXAMPLE_DETAIL_CUES = [
  "w przykladzie",
  "w case study",
  "case study",
  "studium przypadku",
  "dla spolki",
  "dla firmy",
  "przykladowej spolki",
  "przykladowej firmy",
  "w scenariuszu",
  "w analizowanym przypadku",
  "w zaprezentowanym przykladzie",
];

const EXAMPLE_ENTITY_CUES = [
  "dla spolki",
  "dla firmy",
  "przykladowej spolki",
  "przykladowej firmy",
];

const CASE_RESULT_CUES = [
  "wartosc przedsiebiorstwa",
  "enterprise value",
  "equity value",
  "wycena wynosi",
  "wynik obliczen",
  "wyniosla",
  "wyniosl",
  "wynosi",
  "oszacowano na",
  "wyceniono na",
];

export interface GenerateClozeResult {
  cards: ClozeCard[];
  usage: TokenUsage;
}

export async function generateClozeCards(compressedContent: string): Promise<GenerateClozeResult> {
  const out = await complete({
    model: "claude-sonnet-4-6",
    systemPrompt: GENERATE_CLOZE_SYSTEM_PROMPT,
    userMessage: `Materiał:\n\n${compressedContent}`,
    maxTokens: 4000,
    temperature: 0.7,
    cacheSystemPrompt: true,
  });

  const parsed = parseAIJson(out.text);
  const validated = ClozeBatchSchema.parse(parsed);
  return { cards: filterLowValueClozeCards(validated.cards), usage: out.usage };
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

  const parsed = parseAIJson(out.text);
  const validated = OpenBatchSchema.parse(parsed);
  return { questions: validated.questions.slice(0, DEEP_DIVE_ROUND_SIZE), usage: out.usage };
}

function filterLowValueClozeCards(cards: ClozeCard[]): ClozeCard[] {
  return cards.filter((card) => !isLowValueExampleDetail(card));
}

function isLowValueExampleDetail(card: ClozeCard): boolean {
  const front = normalizeForHeuristic(card.front);
  const answer = normalizeForHeuristic(card.answer);

  const hasExampleCue = EXAMPLE_DETAIL_CUES.some((cue) => front.includes(cue));
  if (!hasExampleCue) return false;

  const hasCaseResultCue = CASE_RESULT_CUES.some((cue) => front.includes(cue));
  if (hasCaseResultCue && looksLikeArbitraryNumericAnswer(answer)) return true;

  const hasEntityCue = EXAMPLE_ENTITY_CUES.some((cue) => front.includes(cue));
  return hasEntityCue && looksLikeArbitraryEntityAnswer(card.answer);
}

function looksLikeArbitraryNumericAnswer(answer: string): boolean {
  if (answer.length === 0) return false;

  const hasDigit = /\d/.test(answer);
  const hasMoneyOrPercent = /[%$€£]|(?:\b|_)(?:zl|pln|usd|eur|gbp|mln|mld|tys|million|billion)(?:\b|_)/.test(answer);
  const isStandaloneNumber = /^[\d\s.,+-]+(?:%|x|zl|pln|usd|eur|gbp|mln|mld|tys|lat|lata|rok|years?)?$/.test(answer);
  return hasDigit && (hasMoneyOrPercent || isStandaloneNumber);
}

function looksLikeArbitraryEntityAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (trimmed.length === 0) return false;

  if (/^[A-Z0-9]{2,8}$/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length <= 3 && /^[\p{L}\d\s.&-]+$/u.test(trimmed);
}

function normalizeForHeuristic(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\{\{c1::|}}/g, "")
    .replace(/[^\p{L}\p{N}%$€£.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
