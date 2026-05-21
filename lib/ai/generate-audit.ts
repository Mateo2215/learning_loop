/**
 * Sonnet wrapper that generates audit questions for one material.
 * Wrapped by trackAICall at the call site.
 */

import { z } from "zod";
import { completeWithTool, type ToolDefinition } from "./anthropic";
import { parseToolPayload } from "./tool-output";
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

const SUBMIT_AUDIT_TOOL: ToolDefinition = {
  name: "submit_audit_questions",
  description: "Submit 3-6 fresh, non-duplicate audit questions for the material.",
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 3,
        maxItems: 6,
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

  const out = await completeWithTool({
    model: "claude-sonnet-4-6",
    systemPrompt: buildGenerateAuditSystemPrompt(input.category, input.trigger),
    userMessage,
    maxTokens: 1500,
    temperature: 0.7,
    cacheSystemPrompt: true,
    tool: SUBMIT_AUDIT_TOOL,
  });

  const parsed = parseToolPayload(out.data, AuditOutputSchema, "generateAuditQuestions");
  return { result: parsed.questions, usage: out.usage };
}
