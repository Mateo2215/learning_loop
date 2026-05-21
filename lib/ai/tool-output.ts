/**
 * Validates an Anthropic tool-call payload against a zod schema and recovers
 * from one common quirk: smaller models sometimes return an array/object field
 * as a JSON-encoded string instead of the parsed value. When that happens we
 * try a single JSON.parse pass on the offending field and re-validate.
 *
 * On any other validation failure the raw payload is logged so the next run
 * has enough context to diagnose without re-triggering the failure.
 */

import type { z } from "zod";

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

      try {
        recovered[field] = JSON.parse(value);
        didRecover = true;
      } catch {
        // leave as-is; final validation will report it
      }
    }

    if (didRecover) {
      const second = schema.safeParse(recovered);
      if (second.success) {
        console.warn(`[${context}] recovered tool payload by JSON-parsing stringified field(s)`);
        return second.data;
      }
    }
  }

  console.error(
    `[${context}] tool payload failed schema validation. Raw payload (truncated):`,
    JSON.stringify(payload).slice(0, 2000),
  );
  console.error(`[${context}] zod issues:`, first.error.issues);
  throw first.error;
}
