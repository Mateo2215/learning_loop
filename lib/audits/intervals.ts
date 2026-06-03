/**
 * Adaptacyjne interwały audytu.
 *
 * Audyt materiału startuje po jego opanowaniu (round 1). Po każdym wykonanym
 * audycie kolejny odstęp zależy od wyniku pojedynczego pytania (score 1–10):
 *   - dobry  (≥7) → awans o szczebel drabiny (dłużej, materiał rzadziej)
 *   - średni (4–6) → ten sam szczebel (powtórz podobny odstęp)
 *   - słaby  (≤3) → spadek o szczebel (wraca szybciej), podłoga 7 dni
 *
 * Czyste funkcje — bez I/O, łatwe do testowania.
 */

/** Drabina interwałów w dniach. Sukces wspina się wyżej, porażka spada. */
export const AUDIT_INTERVAL_LADDER = [7, 21, 60, 150, 365] as const;

/**
 * Próg „dobrej" odpowiedzi audytowej. Niezależny od bramy zaliczenia materiału
 * (section-status) — dotyczy pojedynczej odpowiedzi audytowej i decyduje tylko
 * o awansie/spadku na drabinie interwałów.
 */
export const AUDIT_GOOD_SCORE = 7;
/** Górna granica odpowiedzi „słabej". */
export const AUDIT_POOR_SCORE = 3;

/** Najkrótszy możliwy odstęp do kolejnego audytu (dni). */
export const AUDIT_MIN_INTERVAL_DAYS = AUDIT_INTERVAL_LADDER[0];

function ladderDays(round: number): number {
  const idx = Math.min(Math.max(round, 1), AUDIT_INTERVAL_LADDER.length) - 1;
  return AUDIT_INTERVAL_LADDER[idx];
}

export interface NextAudit {
  intervalDays: number;
  nextRound: number;
}

/**
 * Wylicza rundę i odstęp kolejnego audytu na podstawie ukończonej rundy i wyniku.
 *
 * @param round — runda właśnie ukończonego audytu (1-indeksowana)
 * @param score — wynik 1–10 z review pojedynczego pytania audytowego
 */
export function nextAuditInterval(round: number, score: number): NextAudit {
  const current = Math.max(1, Math.floor(round));

  let nextRound: number;
  if (score >= AUDIT_GOOD_SCORE) {
    nextRound = current + 1; // awans
  } else if (score <= AUDIT_POOR_SCORE) {
    nextRound = Math.max(1, current - 1); // spadek
  } else {
    nextRound = current; // bez zmian
  }

  const intervalDays = Math.max(AUDIT_MIN_INTERVAL_DAYS, ladderDays(nextRound));
  return { intervalDays, nextRound };
}
