/**
 * Mastery model dla pytań otwartych w Deep Dive.
 *
 * Stan każdego pytania wyliczany ze score'a ostatniego review. Stan
 * sekcji (materiału = puli ~5 open questions) wyliczany z agregatu.
 * Leech detection: 3 ostatnie reviews z score <7 → is_leech=true,
 * ostatnie review ≥7 → is_leech=false (auto-reset).
 *
 * Wszystko jako czyste funkcje — bez I/O, łatwe do testowania.
 */

export type QuestionStatus = "new" | "mastered" | "weak";

export type SectionStatus =
  | "fresh"
  | "in_progress"
  | "needs_followup"
  | "done"
  | "below_threshold";

export const MASTERY_SCORE_THRESHOLD = 7;
export const LEECH_FAILURE_THRESHOLD = 3;

export function computeQuestionStatus(latestScore: number | null): QuestionStatus {
  if (latestScore === null) return "new";
  if (latestScore >= MASTERY_SCORE_THRESHOLD) return "mastered";
  return "weak";
}

export interface SectionStats {
  status: SectionStatus;
  total: number;
  scored: number;
  weak_count: number;
  mastered_count: number;
  new_count: number;
  avg: number | null;
}

export function computeSectionStatus(latestScores: Array<number | null>): SectionStats {
  const total = latestScores.length;
  const scoredValues = latestScores.filter((s): s is number => s !== null);
  const scored = scoredValues.length;
  const new_count = total - scored;

  let weak_count = 0;
  let mastered_count = 0;
  for (const score of scoredValues) {
    if (score >= MASTERY_SCORE_THRESHOLD) mastered_count += 1;
    else weak_count += 1;
  }

  const avg = scored > 0 ? scoredValues.reduce((a, b) => a + b, 0) / scored : null;

  let status: SectionStatus;
  if (total === 0) {
    status = "fresh";
  } else if (scored === 0) {
    status = "fresh";
  } else if (scored < total) {
    status = "in_progress";
  } else if (weak_count > 0) {
    status = "needs_followup";
  } else if (avg !== null && avg >= MASTERY_SCORE_THRESHOLD) {
    status = "done";
  } else {
    status = "below_threshold";
  }

  return { status, total, scored, weak_count, mastered_count, new_count, avg };
}

/**
 * Decyzja o is_leech dla pytania otwartego po nowym review.
 *
 * @param recentScores — score'y posortowane DESC (najnowszy pierwszy), max 3 ostatnie
 * @param currentlyLeech — obecny stan is_leech na items
 * @returns null = bez zmiany; true = zaznacz leech; false = zdejmij leech
 */
export function shouldUpdateLeech(
  recentScores: number[],
  currentlyLeech: boolean,
): boolean | null {
  if (recentScores.length === 0) return null;

  const latestScore = recentScores[0];

  // Auto-reset: ostatnia odpowiedź dobra → już nie leech
  if (latestScore >= MASTERY_SCORE_THRESHOLD) {
    return currentlyLeech ? false : null;
  }

  // Mark: 3 ostatnie wszystkie słabe → leech
  if (
    recentScores.length >= LEECH_FAILURE_THRESHOLD &&
    recentScores
      .slice(0, LEECH_FAILURE_THRESHOLD)
      .every((s) => s < MASTERY_SCORE_THRESHOLD)
  ) {
    return currentlyLeech ? null : true;
  }

  return null;
}
