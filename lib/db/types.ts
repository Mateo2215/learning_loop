/**
 * Manual type definitions matching `supabase/migrations/0001_init.sql`.
 *
 * Ideally these are auto-generated via `supabase gen types typescript --project-id …`,
 * but that requires a separate Supabase CLI access token. We can switch over later
 * if maintenance becomes a burden — for now the schema is stable and small enough
 * to track by hand. If the SQL migration changes, update this file in the same PR.
 */

export type Category = "finanse" | "programowanie" | "ai_ml" | "soft_skills" | "ogolne";

export type MaterialStatus = "processing" | "ready" | "failed";

export type SourceType = "docx" | "md" | "txt" | "paste" | "url";

export type ItemType = "cloze" | "open" | "feynman" | "scenario";

export type Difficulty = "easy" | "medium" | "hard";

export type SessionMode = "deep_dive" | "review" | "audit" | "gap_check";

export type AIEvaluation = "correct" | "partially_correct" | "incorrect";

export type Calibration = "agree" | "too_strict" | "too_lenient";

export type AuditTrigger = "day_7" | "day_30" | "day_90" | "resurrection";

export type AuditStatus = "pending" | "completed" | "skipped";

export type GapType = "low_correct_rate" | "stale_topic" | "rising_failures" | "never_consolidated";

export type GapSeverity = "low" | "medium" | "high";

export type GapStatus = "open" | "addressed" | "dismissed";

export type ProcessingJobType = "import" | "generate_items" | "compute_gaps";

export type ProcessingJobStatus = "pending" | "running" | "completed" | "failed";

export interface Material {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  content_compressed: string | null;
  source_filename: string | null;
  source_url: string | null;
  source_type: SourceType | null;
  tags: string[];
  embedding: number[] | null;
  parent_material_id: string | null;
  insight_note: string | null;
  application_note: string | null;
  status: MaterialStatus;
  imported_at: string;
  deleted_at: string | null;
  suggested_gap_id: string | null;
  was_truncated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  material_id: string;
  type: ItemType;
  question: string;
  answer_reference: string | null;
  cloze_data: { front: string; answer: string } | null;
  difficulty: Difficulty | null;
  category: Category;
  tags: string[];
  is_suspended: boolean;
  is_leech: boolean;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_due_date: string | null;
  fsrs_last_review: string | null;
  fsrs_review_count: number;
  fsrs_lapse_count: number;
  original_question: string | null;
  edit_count: number;
  audit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  mode: SessionMode;
  material_id: string | null;
  planned_item_ids: string[];
  started_at: string;
  ended_at: string | null;
  items_planned: number | null;
  items_completed: number;
  device: "desktop" | "mobile" | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  user_id: string;
  job_type: ProcessingJobType;
  status: ProcessingJobStatus;
  progress: number;
  payload: ImportJobPayload | Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload shape for `processing_jobs` rows of `job_type = 'import'`.
 * Stored as jsonb. Validated via zod at API boundary in `app/api/materials/import`.
 */
export interface ImportJobPayload {
  title: string;
  category: Category;
  source_type: SourceType;
  source_filename: string | null;
  /** Raw extracted text — passed to pipeline, NOT persisted to materials table. */
  raw_text: string;
}

export interface TopicAudit {
  id: string;
  user_id: string;
  material_id: string;
  session_id: string | null;
  scheduled_for: string;
  trigger: AuditTrigger;
  status: AuditStatus;
  completed_at: string | null;
  performance_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeGap {
  id: string;
  user_id: string;
  title: string | null;
  gap_type: GapType;
  affected_tags: string[];
  affected_materials: string[];
  severity: GapSeverity;
  detected_at: string;
  generated_prompt: string | null;
  status: GapStatus;
  addressed_by_material_id: string | null;
  addressed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORIES: readonly Category[] = [
  "finanse",
  "programowanie",
  "ai_ml",
  "soft_skills",
  "ogolne",
] as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  finanse: "Finanse",
  programowanie: "Programowanie",
  ai_ml: "AI / ML",
  soft_skills: "Soft skills",
  ogolne: "Ogólne",
};
