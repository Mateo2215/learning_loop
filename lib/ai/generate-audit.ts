/**
 * Sonnet wrapper that generates audit questions for one material.
 * Wrapped by trackAICall at the call site.
 */

import { z } from "zod";
import { complete } from "./anthropic";
import { buildGenerateAuditSystemPrompt } from "./prompts/generate-audit";
import type { AuditTrigger, Category } from "@/lib/db/types";
import type { TokenUsage } from "./pricing";

const QuestionSchema = z.object({
  question: z.string().min(5),
  answer_reference: z.string().min(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const AuditOutputSchema = z.object({
  questions: z.array(QuestionSchema).min(3).max(6),
});

export type AuditQuestion = z.infer<typeof QuestionSchema>;

export interface GenerateAuditInput {
  category: Category;
  trigger: AuditTrigger;
  compressedContent: string;
  /** Existing question texts for this material — Sonnet must avoid duplicates. */
  existingQuestions: string[];
}

export interface GenerateAuditResponse {
  result: AuditQuestion[];
  usage: TokenUsage;
}

export async function generateAuditQuestions(
  input: GenerateAuditInput
): Promise<GenerateAuditResponse> {
  const existing = input.existingQuestions.length
    ? input.existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "(brak)";

  const userMessage = [
    "Treść materiału (skompresowana):",
    input.compressedContent,
    "",
    "Pytania, które uczący się już widział (NIE powielaj):",
    existing,
    "",
    "Wygeneruj 3–5 nowych pytań audytowych w formacie JSON.",
  ].join("\n");

  const out = await complete({
    model: "claude-sonnet-4-6",
    systemPrompt: buildGenerateAuditSystemPrompt(input.category, input.trigger),
    userMessage,
    maxTokens: 1500,
    temperature: 0.7,
    cacheSystemPrompt: true,
  });

  let s = out.text.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) s = s.slice(firstBrace, lastBrace + 1);

  const parsed = AuditOutputSchema.parse(JSON.parse(s));
  return { result: parsed.questions, usage: out.usage };
}
