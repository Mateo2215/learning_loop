/**
 * Material import pipeline. Runs sequentially through 9 steps per CLAUDE.md.
 * Owns lifecycle of one `processing_jobs` row + creates one `materials` row +
 * creates many `items` rows + (later) `topic_audits` rows.
 *
 * Called from /api/materials/import after the row is created. Each step writes
 * progress; failures mark the job as failed and re-throw.
 *
 * NOTE: step 3 (embed) currently uses a deterministic mock vector because we
 * don't have a Voyage API key yet. Replace with real `embed()` from lib/ai/voyage
 * before relying on dedup or semantic search. Marked TODO(voyage) below.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackAICall } from "@/lib/ai/track";
import { compressMaterial, autoTagMaterial } from "./compress-and-tag";
import { generateClozeCards, generateOpenQuestions } from "./generate-items";
import { initialFsrsState } from "@/lib/fsrs/scheduler";
import type { Category, ImportJobPayload } from "@/lib/db/types";

const VECTOR_DIM = 1024;

interface PipelineContext {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  payload: ImportJobPayload;
}

export async function processMaterial(ctx: PipelineContext): Promise<{ materialId: string }> {
  const { supabase, userId, jobId, payload } = ctx;

  await markJob(supabase, jobId, { status: "running", progress: 5, started_at: new Date().toISOString() });

  try {
    // Step 1: parse — already done at API boundary, raw text in payload.raw_text.
    // Step 2: detect category — for M1 we trust user-supplied category from form.
    const category: Category = payload.category;

    // Step 3: embedding (TODO(voyage) — replace mock with real call)
    const embedding = mockEmbedding(payload.raw_text);
    await markJob(supabase, jobId, { progress: 15 });

    // Step 4: duplicate check — skip while embedding is mocked.
    // (When real embeddings land: cosine sim > 0.92 = auto-merge, 0.85-0.92 = flag.)

    // Step 5: compress (Haiku)
    const compressedRes = await trackAICall({
      supabase,
      userId,
      operation: "compress_material",
      model: "claude-haiku-4-5",
      metadata: { jobId, source: "import_pipeline" },
      call: () => compressMaterial(payload.raw_text).then((r) => ({ result: r.compressed, usage: r.usage })),
    });
    const compressed = compressedRes.result;
    await markJob(supabase, jobId, { progress: 30 });

    // Step 6: auto-tag (Haiku)
    const tagsRes = await trackAICall({
      supabase,
      userId,
      operation: "auto_tag_material",
      model: "claude-haiku-4-5",
      metadata: { jobId, source: "import_pipeline" },
      call: () => autoTagMaterial(compressed).then((r) => ({ result: r.tags, usage: r.usage })),
    });
    const tags = tagsRes.result;
    await markJob(supabase, jobId, { progress: 45 });

    // Persist material now (before generating items, so items can FK to it).
    const { data: material, error: insertErr } = await supabase
      .from("materials")
      .insert({
        user_id: userId,
        title: payload.title,
        category,
        content_compressed: compressed,
        source_filename: payload.source_filename,
        source_type: payload.source_type,
        tags,
        embedding,
        status: "processing",
      })
      .select("id")
      .single();
    if (insertErr || !material) throw new Error(`materials insert failed: ${insertErr?.message}`);
    const materialId = material.id;
    await markJob(supabase, jobId, { progress: 55 });

    // Step 7a: generate cloze cards (Haiku)
    const clozeRes = await trackAICall({
      supabase,
      userId,
      operation: "generate_cloze",
      model: "claude-haiku-4-5",
      materialId,
      metadata: { jobId },
      call: () => generateClozeCards(compressed).then((r) => ({ result: r.cards, usage: r.usage })),
    });
    const fsrsInit = initialFsrsState();
    const clozeRows = clozeRes.result.map((card) => ({
      user_id: userId,
      material_id: materialId,
      type: "cloze" as const,
      question: card.front,
      answer_reference: card.answer,
      cloze_data: { front: card.front, answer: card.answer },
      difficulty: card.difficulty,
      category,
      tags,
      ...fsrsInit,
    }));
    if (clozeRows.length > 0) {
      const { error } = await supabase.from("items").insert(clozeRows);
      if (error) throw new Error(`cloze items insert failed: ${error.message}`);
    }
    await markJob(supabase, jobId, { progress: 75 });

    // Step 7b: generate open questions (Haiku)
    const openRes = await trackAICall({
      supabase,
      userId,
      operation: "generate_open",
      model: "claude-haiku-4-5",
      materialId,
      metadata: { jobId },
      call: () => generateOpenQuestions(compressed).then((r) => ({ result: r.questions, usage: r.usage })),
    });
    const openRows = openRes.result.map((q) => ({
      user_id: userId,
      material_id: materialId,
      type: "open" as const,
      question: q.question,
      answer_reference: q.answer_reference,
      difficulty: q.difficulty,
      category,
      tags,
    }));
    if (openRows.length > 0) {
      const { error } = await supabase.from("items").insert(openRows);
      if (error) throw new Error(`open items insert failed: ${error.message}`);
    }
    await markJob(supabase, jobId, { progress: 90 });

    // Step 8: schedule audits (day_7, day_30, day_90)
    const now = Date.now();
    const auditRows = [
      { user_id: userId, material_id: materialId, scheduled_for: new Date(now + 7 * 86400_000).toISOString(), trigger: "day_7" as const },
      { user_id: userId, material_id: materialId, scheduled_for: new Date(now + 30 * 86400_000).toISOString(), trigger: "day_30" as const },
      { user_id: userId, material_id: materialId, scheduled_for: new Date(now + 90 * 86400_000).toISOString(), trigger: "day_90" as const },
    ];
    const { error: auditErr } = await supabase.from("topic_audits").insert(auditRows);
    if (auditErr) {
      // Non-fatal — log but continue. Audits can be re-scheduled later.
      console.warn("[pipeline] audit scheduling failed:", auditErr.message);
    }

    // Step 9: mark material ready
    const { error: readyErr } = await supabase
      .from("materials")
      .update({ status: "ready" })
      .eq("id", materialId);
    if (readyErr) throw new Error(`mark ready failed: ${readyErr.message}`);

    await markJob(supabase, jobId, {
      status: "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
      result: {
        material_id: materialId,
        cloze_count: clozeRows.length,
        open_count: openRows.length,
        tags,
      },
    });

    return { materialId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJob(supabase, jobId, {
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
    });
    throw err;
  }
}

interface JobUpdate {
  status?: "pending" | "running" | "completed" | "failed";
  progress?: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: Record<string, unknown>;
}

async function markJob(supabase: SupabaseClient, jobId: string, update: JobUpdate): Promise<void> {
  const { error } = await supabase.from("processing_jobs").update(update).eq("id", jobId);
  if (error) console.warn("[pipeline] job update failed:", error.message, update);
}

/**
 * Deterministic placeholder vector based on text hash. Same text → same vector,
 * but vectors are not semantically meaningful — they are noise. Used only so
 * the schema constraint `embedding vector(1024)` is satisfied during M1 testing.
 *
 * TODO(voyage): replace with real embedding from `lib/ai/voyage.ts` before any
 * dedup or semantic-search feature ships.
 */
function mockEmbedding(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) | 0;
  const out = new Array<number>(VECTOR_DIM);
  let s = seed || 1;
  for (let i = 0; i < VECTOR_DIM; i++) {
    s = (s * 1664525 + 1013904223) | 0;
    out[i] = ((s & 0xffff) / 0xffff) * 2 - 1;
  }
  return out;
}
