import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackAICall } from "@/lib/ai/track";
import { complete } from "@/lib/ai/anthropic";

/**
 * Dev-only smoke test for the AI layer. Calls Haiku once through trackAICall
 * and reports back what was logged to usage_logs. Auth required (uses caller's
 * Supabase session, so RLS applies normally).
 *
 * Disabled in production by NODE_ENV check.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "smoke endpoints are disabled in production" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const { result, costUsd, monthlyUsd, softHit } = await trackAICall({
      supabase,
      userId: user.id,
      operation: "smoke_test",
      model: "claude-haiku-4-5",
      metadata: { source: "smoke_endpoint" },
      call: () =>
        complete({
          model: "claude-haiku-4-5",
          systemPrompt: "Odpowiadasz po polsku, krótko, jednym zdaniem.",
          userMessage: "Powiedz 'pong' i podaj jedną liczbę pierwszą większą niż 100.",
          maxTokens: 100,
          temperature: 0,
          cacheSystemPrompt: true,
        }).then((out) => ({ result: out.text, usage: out.usage })),
    });

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      replyText: result,
      costUsd,
      monthlyUsd,
      softHit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, durationMs: Date.now() - startedAt, error: message },
      { status: 500 }
    );
  }
}
