/**
 * Sonnet wrapper that generates audit questions for one material.
 * Wrapped by trackAICall at the call site.
 */

import { z } from "zod";
import { type ToolDefinition } from "./anthropic";
import { completeWithToolValidated } from "./tool-output";
import { buildGenerateAuditSystemPrompt } from "./prompts/generate-audit";
import type { AuditTrigger, Category } from "@/lib/db/types";
import type { TokenUsage } from "./pricing";

const QuestionSchema = z.object({
  question: z.string().min(5),
  answer_reference: z.string().min(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const AuditOutputSchema = z.object({
  questions: z.array(QuestionSchema).length(1),
});

const SUBMIT_AUDIT_TOOL: ToolDefinition = {
  name: "submit_audit_questions",
  description: "Submit exactly 1 fresh, non-duplicate audit question for the material.",
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          properties: {
            question: { type: "string", minLength: 5 },
            answer_reference: { type: "string", minLength: 5 },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          },
          required: ["question", "answer_reference", "difficulty"],
        },
      },
    },
    required: ["questions"],
  },
};

export type AuditQuestion = z.infer<typeof QuestionSchema>;

export interface GenerateAuditInput {
  category: Category;
  trigger: AuditTrigger;
  /** Numer audytu materiału (1, 2, 3, …) — steruje głębokością pytania. */
  round: number;
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
    "Wygeneruj dokładnie 1 nowe pytanie audytowe w formacie JSON.",
  ].join("\n");

  const out = await completeWithToolValidated({
    model: "claude-sonnet-4-6",
    systemPrompt: buildGenerateAuditSystemPrompt(input.category, input.trigger, input.round),
    userMessage,
    maxTokens: 1500,
    temperature: 0.7,
    cacheSystemPrompt: true,
    tool: SUBMIT_AUDIT_TOOL,
    schema: AuditOutputSchema,
    context: "generateAuditQuestions",
  });

  return { result: out.data.questions, usage: out.usage };
}
