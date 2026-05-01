import { VoyageAIClient } from "voyageai";
import { AIProviderError } from "./errors";
import type { TokenUsage } from "./pricing";

let cachedClient: VoyageAIClient | null = null;

function client(): VoyageAIClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new AIProviderError("voyage", "VOYAGE_API_KEY is not set");
  cachedClient = new VoyageAIClient({ apiKey });
  return cachedClient;
}

export interface EmbedResult {
  embedding: number[];
  usage: TokenUsage;
}

/**
 * Embed a single text using voyage-3 (1024 dimensions, multilingual including Polish).
 *
 * Do NOT call this directly from app code — wrap in trackAICall().
 */
export async function embed(text: string): Promise<EmbedResult> {
  let response;
  try {
    response = await client().embed({
      input: [text],
      model: "voyage-3",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AIProviderError("voyage", `embed failed: ${message}`, err);
  }

  const vec = response.data?.[0]?.embedding;
  if (!vec) throw new AIProviderError("voyage", "no embedding in response");

  return {
    embedding: vec,
    usage: {
      inputTokens: response.usage?.totalTokens ?? 0,
      outputTokens: 0,
    },
  };
}
