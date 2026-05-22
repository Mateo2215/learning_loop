/**
 * Two simple Haiku-based stages of the import pipeline: compress (~30% length)
 * and auto-tag (3-5 tags). Each returns text/array plus token usage.
 */

import { z } from "zod";
import { complete, type ToolDefinition } from "@/lib/ai/anthropic";
import { completeWithToolValidated } from "@/lib/ai/tool-output";
import { COMPRESS_SYSTEM_PROMPT } from "@/lib/ai/prompts/compress";
import { AUTO_TAG_SYSTEM_PROMPT } from "@/lib/ai/prompts/auto-tag";
import type { TokenUsage } from "@/lib/ai/pricing";

export interface CompressResult {
  compressed: string;
  usage: TokenUsage;
}

export async function compressMaterial(rawText: string): Promise<CompressResult> {
  const out = await complete({
    model: "claude-haiku-4-5",
    systemPrompt: COMPRESS_SYSTEM_PROMPT,
    userMessage: `Tekst do skompresowania:\n\n${rawText}`,
    maxTokens: Math.min(4000, Math.ceil(rawText.length / 3)),
    temperature: 0.2,
    cacheSystemPrompt: true,
  });
  return { compressed: out.text.trim(), usage: out.usage };
}

const TagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).min(2).max(7),
});

const SUBMIT_TAGS_TOOL: ToolDefinition = {
  name: "submit_tags",
  description: "Submit 3-5 unique tags describing the material.",
  inputSchema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        minItems: 2,
        maxItems: 7,
        items: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    required: ["tags"],
  },
};

export interface AutoTagResult {
  tags: string[];
  usage: TokenUsage;
}

export async function autoTagMaterial(compressedContent: string): Promise<AutoTagResult> {
  const out = await completeWithToolValidated({
    model: "claude-haiku-4-5",
    systemPrompt: AUTO_TAG_SYSTEM_PROMPT,
    userMessage: `Materiał:\n\n${compressedContent}`,
    maxTokens: 200,
    temperature: 0.5,
    cacheSystemPrompt: true,
    tool: SUBMIT_TAGS_TOOL,
    schema: TagsSchema,
    context: "autoTagMaterial",
  });

  return { tags: Array.from(new Set(out.data.tags)), usage: out.usage };
}
