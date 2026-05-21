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
