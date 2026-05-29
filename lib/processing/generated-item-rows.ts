/**
 * Pure row builder for generated study items. Keeps AI/Supabase orchestration
 * separate from deterministic insert-row logic so regressions are easy to test.
 */

import { initialFsrsState } from "@/lib/fsrs/scheduler";
import type { Category, Difficulty } from "@/lib/db/types";
import type { ClozeCard, OpenQuestion } from "@/lib/processing/generate-items";

export interface GeneratedItemMaterial {
  id: string;
  category: Category;
  tags: string[] | null;
}

export interface ExistingGeneratedQuestion {
  question: string | null;
}

export interface GeneratedItemRow {
  user_id: string;
  material_id: string;
  type: "cloze" | "open";
  question: string;
  answer_reference: string;
  cloze_data?: { front: string; answer: string };
  difficulty: Difficulty;
  category: Category;
  tags: string[];
  fsrs_stability?: null;
  fsrs_difficulty?: null;
  fsrs_due_date?: string;
  fsrs_last_review?: null;
  fsrs_review_count?: 0;
  fsrs_lapse_count?: 0;
}

export interface BuildGeneratedItemRowsInput {
  userId: string;
  material: GeneratedItemMaterial;
  clozeCards: ClozeCard[];
  openQuestions: OpenQuestion[];
  existingQuestions?: ExistingGeneratedQuestion[];
  now?: Date;
}

export function buildGeneratedItemRows({
  userId,
  material,
  clozeCards,
  openQuestions,
  existingQuestions = [],
  now = new Date(),
}: BuildGeneratedItemRowsInput): GeneratedItemRow[] {
  const tags = material.tags ?? [];
  const seen = new Set(
    existingQuestions
      .map((item) => normalizeGeneratedQuestion(item.question ?? ""))
      .filter(Boolean),
  );
  const rows: GeneratedItemRow[] = [];

  function addIfUnique(row: GeneratedItemRow): void {
    const normalized = normalizeGeneratedQuestion(row.question);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    rows.push(row);
  }

  for (const card of clozeCards) {
    addIfUnique({
      user_id: userId,
      material_id: material.id,
      type: "cloze",
      question: card.front,
      answer_reference: card.answer,
      cloze_data: { front: card.front, answer: card.answer },
      difficulty: card.difficulty,
      category: material.category,
      tags,
      ...initialFsrsState(now),
    });
  }

  for (const question of openQuestions) {
    addIfUnique({
      user_id: userId,
      material_id: material.id,
      type: "open",
      question: question.question,
      answer_reference: question.answer_reference,
      difficulty: question.difficulty,
      category: material.category,
      tags,
    });
  }

  return rows;
}

export function normalizeGeneratedQuestion(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
