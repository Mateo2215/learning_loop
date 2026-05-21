import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError } from "./errors";
import type { ModelId, TokenUsage } from "./pricing";

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AIProviderError("anthropic", "ANTHROPIC_API_KEY is not set");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export type AnthropicModel = Extract<ModelId, "claude-haiku-4-5" | "claude-sonnet-4-6">;

/**
 * Map our short model IDs to the actual Anthropic API model strings.
 * Single source of truth — change versions here and the rest of the app follows.
 */
export const ANTHROPIC_MODEL_IDS: Record<AnthropicModel, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
};

export interface CompletionParams {
  model: AnthropicModel;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
}

export interface CompletionResult {
  text: string;
  usage: TokenUsage;
}

/**
 * Thin wrapper around messages.create. Use `cacheSystemPrompt: true` for any
 * system prompt that will be reused (validation, generation templates) —
 * 70-90% cost savings on input tokens after the first call within a 5-min window.
 *
 * Do NOT call this directly from app code — wrap in trackAICall().
 */
export async function complete(params: CompletionParams): Promise<CompletionResult> {
  const system = params.cacheSystemPrompt
    ? [{ type: "text" as const, text: params.systemPrompt, cache_control: { type: "ephemeral" as const } }]
    : params.systemPrompt;

  let response;
  try {
    response = await client().messages.create({
      model: ANTHROPIC_MODEL_IDS[params.model],
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 1,
      system,
      messages: [{ role: "user", content: params.userMessage }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIProviderError("anthropic", `messages.create failed: ${message}`, err);
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new AIProviderError("anthropic", "no text content block in response");
  }

  return {
    text: textBlock.text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolCompletionParams {
  model: AnthropicModel;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
  tool: ToolDefinition;
}

export interface ToolCompletionResult<T> {
  data: T;
  usage: TokenUsage;
}

/**
 * Forces the model to emit a single tool call matching `tool.inputSchema`.
 * The returned `data` is the tool's already-parsed input object — no JSON.parse
 * on our side, so malformed-JSON failures are eliminated at the API layer.
 *
 * Use this for any operation that returns structured output. Use `complete()`
 * only when the model is supposed to return free text (e.g. compression).
 *
 * Do NOT call directly from app code — wrap in trackAICall().
 */
export async function completeWithTool<T>(params: ToolCompletionParams): Promise<ToolCompletionResult<T>> {
  const system = params.cacheSystemPrompt
    ? [{ type: "text" as const, text: params.systemPrompt, cache_control: { type: "ephemeral" as const } }]
    : params.systemPrompt;

  let response;
  try {
    response = await client().messages.create({
      model: ANTHROPIC_MODEL_IDS[params.model],
      max_tokens: params.maxTokens,
      temperature: params.temperature ?? 1,
      system,
      tools: [{
        name: params.tool.name,
        description: params.tool.description,
        input_schema: params.tool.inputSchema,
      }],
      tool_choice: { type: "tool", name: params.tool.name, disable_parallel_tool_use: true },
      messages: [{ role: "user", content: params.userMessage }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIProviderError("anthropic", `messages.create (tool) failed: ${message}`, err);
  }

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    const textBlock = response.content.find((b) => b.type === "text");
    const fallback = textBlock?.type === "text" ? textBlock.text.slice(0, 500) : "(no text)";
    console.error(`[completeWithTool] expected tool_use "${params.tool.name}", got: ${fallback}`);
    throw new AIProviderError("anthropic", `no tool_use block for "${params.tool.name}"`);
  }

  return {
    data: toolBlock.input as T,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
