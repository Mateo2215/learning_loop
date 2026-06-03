/**
 * Mastery model dla pytań otwartych w Deep Dive.
 *
 * Stan każdego pytania wyliczany ze score'a ostatniego review. Stan
 * sekcji (materiału = puli ~5 open questions) wyliczany z agregatu.
 * Leech detection: 3 ostatnie reviews z score <7 → is_leech=true,
 * ostatnie review ≥7 → is_leech=false (auto-reset).
 *
 * Brama zaliczenia materiału (status 'done'): WSZYSTKIE pytania odpowiedziane
 * ORAZ żadne poniżej twardej podłogi SECTION_FLOOR_THRESHOLD (6). Pytanie <6
 * → needs_followup. Średnia jest tylko informacją (nie bramkuje).
 * Spójne z kolejką Deep Dive, która serwuje wyłącznie pytania <6 i świeże —
 * szóstka (≥ podłogi) jest akceptowalna i nie wraca do powtórki.
 *
 * MASTERY_SCORE_THRESHOLD (7) pozostaje progiem „opanowania" pojedynczego
 * pytania (display: opanowane vs słabe) i leech detection — niezależnie od bramy.
 *
 * Wszystko jako czyste funkcje — bez I/O, łatwe do testowania.
 */

export type QuestionStatus = "new" | "mastered" | "weak";

export type SectionStatus =
  | "fresh"
  | "in_progress"
  | "needs_followup"
  | "done";

export const MASTERY_SCORE_THRESHOLD = 7;
/** Twarda podłoga: pytanie poniżej tego progu blokuje zaliczenie (i wraca do Deep Dive). */
export const SECTION_FLOOR_THRESHOLD = 6;
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
  /** Pytania poniżej progu opanowania (score <7) — wracają do powtórki. */
  weak_count: number;
  /** Pytania poniżej twardej podłogi (score <6) — blokują zaliczenie. */
  below_floor_count: number;
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
  let below_floor_count = 0;
  for (const score of scoredValues) {
    if (score >= MASTERY_SCORE_THRESHOLD) mastered_count += 1;
    else weak_count += 1;
    if (score < SECTION_FLOOR_THRESHOLD) below_floor_count += 1;
  }

  const avg = scored > 0 ? scoredValues.reduce((a, b) => a + b, 0) / scored : null;

  let status: SectionStatus;
  if (scored === 0) {
    status = "fresh";
  } else if (scored < total) {
    status = "in_progress";
  } else if (below_floor_count > 0) {
    // Twarda luka: jakieś pytanie poniżej podłogi 6 → wymaga poprawy.
    status = "needs_followup";
  } else {
    // Wszystkie odpowiedziane i żadne <6 → zaliczone.
    status = "done";
  }

  return { status, total, scored, weak_count, below_floor_count, mastered_count, new_count, avg };
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
