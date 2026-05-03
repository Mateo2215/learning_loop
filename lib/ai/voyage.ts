import { AIProviderError } from "./errors";
import type { TokenUsage } from "./pricing";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
// Voyage-3 context window is 32k tokens. We pre-trim to a generous character
// budget so a 200k-char paste doesn't get rejected by the API. ~4 chars/token
// is a reasonable mixed-language heuristic; 100k chars ≈ 25k tokens.
const MAX_INPUT_CHARS = 100_000;

interface VoyageResponse {
  data?: { embedding: number[] }[];
  usage?: { total_tokens?: number };
  detail?: string;
}

export interface EmbedResult {
  embedding: number[];
  usage: TokenUsage;
}

/**
 * Embed a single text using voyage-3 (1024 dimensions, multilingual including Polish).
 *
 * Uses fetch directly rather than the voyageai npm SDK — that package's ESM
 * exports are broken under Turbopack production builds (M2 Phase 1 caught this).
 *
 * Do NOT call this directly from app code — wrap in trackAICall().
 */
export async function embed(text: string): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new AIProviderError("voyage", "VOYAGE_API_KEY is not set");

  const trimmed = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  let response: Response;
  try {
    response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: VOYAGE_MODEL, input: [trimmed] }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIProviderError("voyage", `embed network error: ${message}`, err);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as VoyageResponse;
      if (body.detail) detail = `${detail}: ${body.detail}`;
    } catch {
      /* ignore body parse failure */
    }
    throw new AIProviderError("voyage", `embed failed: ${detail}`);
  }

  const json = (await response.json()) as VoyageResponse;
  const vec = json.data?.[0]?.embedding;
  if (!vec) throw new AIProviderError("voyage", "no embedding in response");

  return {
    embedding: vec,
    usage: {
      inputTokens: json.usage?.total_tokens ?? 0,
      outputTokens: 0,
    },
  };
}
