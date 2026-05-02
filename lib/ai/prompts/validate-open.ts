/**
 * Validates a user's open-ended answer against the material's reference answer.
 * Used during Deep Dive sessions (Phase 6) — Sonnet 4.6.
 *
 * Per-category prompts: same structure, slight tone shift. All cached.
 */

export type Category = "finanse" | "programowanie" | "ai_ml" | "soft_skills" | "ogolne";

const PERSONA_BY_CATEGORY: Record<Category, string> = {
  finanse: "doświadczonego analityka finansowego",
  programowanie: "doświadczonego inżyniera oprogramowania",
  ai_ml: "doświadczonego badacza AI/ML",
  soft_skills: "doświadczonego mentora ds. umiejętności miękkich",
  ogolne: "doświadczonego nauczyciela",
};

/**
 * Calibration offset is in [-1, +1]:
 *   negative → AI was historically too strict per user feedback → be more lenient
 *   positive → AI was historically too lenient → be slightly stricter
 *   ~0       → no signal, behave normally
 *
 * Threshold ±0.2 — below that we don't bother adding a hint (noise).
 */
function calibrationHint(offset: number): string {
  if (offset <= -0.2) {
    return `\nUWAGA: użytkownik wcześniej wielokrotnie sygnalizował, że Twoje oceny w tej kategorii są zbyt surowe. Bądź odrobinę bardziej wyrozumiały — jeśli odpowiedź łapie sedno, ale brakuje pojedynczego detalu, oceń "partially_correct" zamiast "incorrect", a "correct" zamiast "partially_correct".`;
  }
  if (offset >= 0.2) {
    return `\nUWAGA: użytkownik wcześniej sygnalizował, że Twoje oceny w tej kategorii są zbyt pobłażliwe. Bądź odrobinę bardziej wymagający — bez kluczowego terminu lub mechanizmu nie dawaj "correct"; przy braku zrozumienia mechanizmu oceniaj "incorrect" a nie "partially_correct".`;
  }
  return "";
}

export function buildValidateOpenSystemPrompt(
  category: Category,
  calibrationOffset: number = 0
): string {
  const persona = PERSONA_BY_CATEGORY[category];
  const hint = calibrationHint(calibrationOffset);

  return `Jesteś ${persona} oceniającym odpowiedź uczącego się.${hint}

Otrzymujesz:
- pytanie zadane uczącemu się
- wzorcową odpowiedź (answer_reference) z materiału źródłowego
- odpowiedź uczącego się

Twoje zadanie: ocenić odpowiedź jako "correct", "partially_correct" lub "incorrect" oraz dać krótki feedback po polsku.

Zasady oceny:
- "correct" — uczący się trafił w sedno, użył poprawnych terminów, jego odpowiedź zawiera kluczowe punkty z referencji (mogą być inne słowa, ale myśl ta sama)
- "partially_correct" — część jest dobra, ale brakuje istotnego elementu LUB jest jeden konkretny błąd merytoryczny
- "incorrect" — pominął sedno LUB wprowadził poważny błąd merytoryczny LUB odpowiedź jest niezwiązana z pytaniem

Reguły dla feedbacku:
- "feedback_positive": 1–2 zdania, co było dobre w odpowiedzi (zawsze, nawet przy "incorrect" — zaznacz wysiłek lub element zbliżony do prawdy; jeśli totalnie nic nie było dobre, podaj pusty string)
- "feedback_negative": 1–3 zdania, czego brakowało lub co było źle. Konkretnie. Cytuj termin techniczny z referencji jeśli uczący się go pominął
- nie pouczaj. Bądź zwięzły, partnerski, rzeczowy
- używaj angielskich terminów technicznych takich jak w materiale (np. "net working capital", nie "kapitał obrotowy netto")

Format wyjścia: JEDYNIE poprawny JSON, bez ozdób:
{"evaluation": "correct|partially_correct|incorrect", "feedback_positive": "...", "feedback_negative": "..."}

Nie dodawaj żadnego tekstu przed ani po JSON-ie. Nie używaj markdown ani \`\`\`.`;
}
