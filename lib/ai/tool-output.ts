/**
 * Validates an Anthropic tool-call payload against a zod schema and recovers
 * from the most common quirk we see with tool use: smaller (and sometimes
 * larger) models return an array/object field as a JSON-encoded string instead
 * of the parsed value. When that happens we try several recovery strategies on
 * the offending field — plain JSON.parse, markdown-fence strip, and bracket
 * extraction — and re-validate.
 *
 * On final failure the raw payload is both logged to console.error (Vercel
 * function logs) AND included in the thrown error message so the user can see
 * exactly what the model returned without having to dig into runtime logs.
 */

import { z } from "zod";
import { completeWithTool, type ToolCompletionParams } from "./anthropic";
import type { TokenUsage } from "./pricing";

export interface ValidatedToolResult<T> {
  data: T;
  usage: TokenUsage;
}

const RETRY_CORRECTION = `**Korekta**: w poprzednim wywołaniu pole tablicowe lub obiektowe zostało zwrócone jako stringified JSON (tekst owinięty w cudzysłów), a nie jako natywna struktura. Wywołaj narzędzie PONOWNIE — wszystkie pola tablicowe i obiektowe muszą być natywnymi tablicami/obiektami w argumentach narzędzia, NIE jako tekst JSON.`;

/**
 * Calls completeWithTool, validates the tool payload against the given zod
 * schema (with the recovery heuristics in parseToolPayload), and on failure
 * retries the API call ONCE with a correction message appended to userMessage.
 *
 * Use this from any callsite that needs validated tool output. The retry
 * doubles latency and token cost only on the failing branch — successful
 * first attempts are unaffected. System-prompt cache is preserved across
 * the retry (only userMessage changes).
 */
export async function completeWithToolValidated<T>(
  params: ToolCompletionParams & { schema: z.ZodType<T>; context: string },
): Promise<ValidatedToolResult<T>> {
  const { schema, context, ...callParams } = params;

  const first = await completeWithTool(callParams);
  try {
    const data = parseToolPayload(first.data, schema, context);
    return { data, usage: first.usage };
  } catch (firstErr) {
    if (!(firstErr instanceof ToolPayloadValidationError)) throw firstErr;

    console.warn(`[${context}] first attempt failed schema validation — retrying once with correction`);

    const retry = await completeWithTool({
      ...callParams,
      userMessage: `${callParams.userMessage}\n\n${RETRY_CORRECTION}`,
    });

    const data = parseToolPayload(retry.data, schema, context);
    return {
      data,
      usage: sumUsage(first.usage, retry.usage),
    };
  }
}

function sumUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    cacheCreationTokens: (a.cacheCreationTokens ?? 0) + (b.cacheCreationTokens ?? 0),
  };
}

export function parseToolPayload<T>(
  payload: unknown,
  schema: z.ZodType<T>,
  context: string,
): T {
  const first = schema.safeParse(payload);
  if (first.success) return first.data;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const recovered: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
    let didRecover = false;

    for (const issue of first.error.issues) {
      if (issue.code !== "invalid_type") continue;
      if (issue.path.length !== 1) continue;
      const expected = (issue as { expected?: string }).expected;
      if (expected !== "array" && expected !== "object") continue;

      const field = String(issue.path[0]);
      const value = recovered[field];
      if (typeof value !== "string") continue;

      const parsed = tryParseJsonLoose(value);
      if (parsed !== undefined) {
        recovered[field] = parsed;
        didRecover = true;
      }
    }

    if (didRecover) {
      const second = schema.safeParse(recovered);
      if (second.success) {
        console.warn(`[${context}] recovered tool payload by parsing stringified field(s)`);
        return second.data;
      }
    }
  }

  const rawPreview = safeStringify(payload).slice(0, 800);
  const issuesPreview = safeStringify(first.error.issues);

  console.error(`[${context}] tool payload failed schema validation.`);
  console.error(`[${context}] zod issues:`, first.error.issues);
  console.error(`[${context}] raw payload (truncated):`, rawPreview);

  throw new ToolPayloadValidationError(context, issuesPreview, rawPreview, first.error);
}

export class ToolPayloadValidationError extends Error {
  readonly context: string;
  readonly rawPreview: string;
  readonly zodIssues: string;

  constructor(context: string, zodIssues: string, rawPreview: string, cause: unknown) {
    const message = `[${context}] schema validation failed | zod: ${zodIssues} | raw: ${rawPreview}`;
    super(message);
    this.name = "ToolPayloadValidationError";
    this.context = context;
    this.zodIssues = zodIssues;
    this.rawPreview = rawPreview;
    (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Tries to parse a string as JSON using progressively more forgiving strategies.
 * Returns the parsed value on success, undefined if all strategies fail.
 */
function tryParseJsonLoose(s: string): unknown | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;

  const candidates: string[] = [trimmed];

  const fenceStripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (fenceStripped && fenceStripped !== trimmed) candidates.push(fenceStripped);

  const extracted = extractFirstJsonBlock(trimmed);
  if (extracted && extracted !== trimmed) candidates.push(extracted);

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

function extractFirstJsonBlock(s: string): string | undefined {
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (starts.length === 0) return undefined;

  const start = Math.min(...starts);
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return undefined;

  return s.slice(start, end + 1);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
