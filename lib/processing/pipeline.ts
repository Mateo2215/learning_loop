/**
 * Material import pipeline. Runs sequentially through 9 steps per CLAUDE.md.
 * Owns lifecycle of one `processing_jobs` row + creates one `materials` row +
 * creates many `items` rows + `topic_audits` rows.
 *
 * Called from /api/materials/import after the row is created. Each step writes
 * progress; failures mark the job as failed and re-throw.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackAICall } from "@/lib/ai/track";
import { embed } from "@/lib/ai/voyage";
import { compressMaterial, autoTagMaterial } from "./compress-and-tag";
import { generateClozeCards, generateOpenQuestions } from "./generate-items";
import { initialFsrsState } from "@/lib/fsrs/scheduler";
import type { Category, ImportJobPayload } from "@/lib/db/types";

const DEDUP_AUTO_MERGE_THRESHOLD = 0.92;
const DEDUP_FLAG_THRESHOLD = 0.85;
// Empirical: short gap text (title + tags) vs full-document material gives
// cosine in the 0.55-0.75 range even on the same topic. CLAUDE.md proposed
// 0.80 in the abstract — too strict for the asymmetric short-vs-long match.
const GAP_MATCH_THRESHOLD = 0.6;

interface PipelineContext {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  payload: ImportJobPayload;
}

export async function processMaterial(ctx: PipelineContext): Promise<{ materialId: string }> {
  const { supabase, userId, jobId, payload } = ctx;
  // Tracks the inserted material so the catch handler can mark it failed.
  // The happy path uses a local `const materialId` (narrowed to string).
  let createdMaterialId: string | null = null;

  await markJob(supabase, jobId, { status: "running", progress: 5, started_at: new Date().toISOString() });

  try {
    // Step 1: parse — already done at API boundary, raw text in payload.raw_text.
    // Step 2: detect category — for M1 we trust user-supplied category from form.
    const category: Category = payload.category;

    // Step 3: embedding (Voyage-3, 1024 dims)
    const embedRes = await trackAICall({
      supabase,
      userId,
      operation: "embed_material",
      model: "voyage-3",
      metadata: { jobId, source: "import_pipeline" },
      call: () => embed(payload.raw_text).then((r) => ({ result: r.embedding, usage: r.usage })),
    });
    const embedding = embedRes.result;
    await markJob(supabase, jobId, { progress: 15 });

    // Step 4: duplicate check via cosine similarity (RPC match_materials).
    // >0.92 → flagged as likely duplicate (we record relation but still continue
    // import so the user has both — auto-merging is destructive). 0.85-0.92 →
    // related material, recorded as a soft link. <0.85 → ignore.
    const dedupCandidates = await findSimilarMaterials(supabase, embedding);
    await markJob(supabase, jobId, { progress: 20 });

    // Step 5: compress (Haiku). stop_reason="max_tokens" means the
    // compressed output hit the cap and may be missing the tail of the
    // source — track it so we can warn the user post-import.
    const compressedRes = await trackAICall({
      supabase,
      userId,
      operation: "compress_material",
      model: "claude-haiku-4-5",
      metadata: { jobId, source: "import_pipeline" },
      call: () =>
        compressMaterial(payload.raw_text).then((r) => ({
          result: { compressed: r.compressed, wasTruncated: r.wasTruncated },
          usage: r.usage,
        })),
    });
    const compressed = compressedRes.result.compressed;
    const wasTruncated = compressedRes.result.wasTruncated;
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
        was_truncated: wasTruncated,
      })
      .select("id")
      .single();
    if (insertErr || !material) throw new Error(`materials insert failed: ${insertErr?.message}`);
    const materialId = material.id;
    createdMaterialId = materialId;
    await markJob(supabase, jobId, { progress: 55 });

    // Persist dedup relations now that we have a material_id to link from.
    if (dedupCandidates.length > 0) {
      const relationRows = dedupCandidates.map((c) => ({
        user_id: userId,
        material_a_id: materialId,
        material_b_id: c.id,
        relation_type: c.similarity >= DEDUP_AUTO_MERGE_THRESHOLD ? ("merged" as const) : ("related" as const),
        similarity_score: Number(c.similarity.toFixed(3)),
      }));
      const { error: relErr } = await supabase.from("material_relations").insert(relationRows);
      if (relErr) console.warn("[pipeline] dedup relation insert failed:", relErr.message);
    }

    // Loop closure: see if any open knowledge_gap matches this new material.
    // Best match (if above threshold) gets stored on materials.suggested_gap_id
    // so the material detail view can prompt the user with confirm/dismiss.
    const gapCandidate = await findBestGapCandidate(supabase, embedding);
    if (gapCandidate) {
      await supabase
        .from("materials")
        .update({ suggested_gap_id: gapCandidate.id })
        .eq("id", materialId);
    }

    // Step 7a: generate cloze cards (Haiku)
    const clozeRes = await trackAICall({
      supabase,
      userId,
      operation: "generate_cloze",
      model: "claude-sonnet-4-6",
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
    const now = new Date().getTime();
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
        was_truncated: wasTruncated,
        tags,
        dedup_candidates: dedupCandidates.map((c) => ({
          id: c.id,
          title: c.title,
          similarity: Number(c.similarity.toFixed(3)),
          relation: c.similarity >= DEDUP_AUTO_MERGE_THRESHOLD ? "merged" : "related",
        })),
        gap_candidate: gapCandidate
          ? {
              id: gapCandidate.id,
              title: gapCandidate.title,
              similarity: Number(gapCandidate.similarity.toFixed(3)),
            }
          : null,
      },
    });

    return { materialId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = createdMaterialId
      ? { material_id: createdMaterialId, partial_material: true }
      : undefined;

    if (createdMaterialId) {
      const { error: materialErr } = await supabase
        .from("materials")
        .update({ status: "failed" })
        .eq("id", createdMaterialId)
        .eq("user_id", userId);
      if (materialErr) console.warn("[pipeline] mark material failed failed:", materialErr.message);
    }

    await markJob(supabase, jobId, {
      status: "failed",
      error: message,
      completed_at: new Date().toISOString(),
      ...(result ? { result } : {}),
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

interface SimilarMaterial {
  id: string;
  similarity: number;
  title: string;
}

/**
 * RPC wrapper around `match_materials` (cosine similarity over user's
 * existing material embeddings). Threshold = the lower of the two dedup
 * cutoffs, so we get both "merged" and "related" candidates in one call.
 */
async function findSimilarMaterials(
  supabase: SupabaseClient,
  embedding: number[]
): Promise<SimilarMaterial[]> {
  const { data, error } = await supabase.rpc("match_materials", {
    query_embedding: embedding,
    match_threshold: DEDUP_FLAG_THRESHOLD,
    match_count: 5,
    exclude_id: null,
  });
  if (error) {
    console.warn("[pipeline] match_materials RPC failed:", error.message);
    return [];
  }
  return (data ?? []) as SimilarMaterial[];
}

interface SimilarGap {
  id: string;
  similarity: number;
  title: string;
  gap_type: string;
}

async function findBestGapCandidate(
  supabase: SupabaseClient,
  embedding: number[]
): Promise<SimilarGap | null> {
  const { data, error } = await supabase.rpc("match_gaps", {
    query_embedding: embedding,
    match_threshold: GAP_MATCH_THRESHOLD,
    match_count: 1,
  });
  if (error) {
    console.warn("[pipeline] match_gaps RPC failed:", error.message);
    return null;
  }
  const list = (data ?? []) as SimilarGap[];
  return list[0] ?? null;
}
