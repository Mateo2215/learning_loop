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

/**
 * Score offset is in [-2, +2]:
 *   negative → AI score was historically too low → bump score up by ~N points
 *   positive → AI score was historically too high → trim score down by ~N points
 *
 * Threshold ±0.5 — smaller signals get absorbed by the 1-10 granularity.
 */
function scoreCalibrationHint(scoreOffset: number): string {
  if (scoreOffset <= -0.5) {
    const amount = Math.round(Math.abs(scoreOffset) * 10) / 10;
    return `\nUWAGA: użytkownik sygnalizował, że Twoje liczbowe score są systemowo zbyt niskie (średnio o ~${amount} punktu). Skoryguj w górę o ten margines — porównywalna odpowiedź powinna teraz dostać o ~${amount} pkt więcej niż dałbyś standardowo.`;
  }
  if (scoreOffset >= 0.5) {
    const amount = Math.round(scoreOffset * 10) / 10;
    return `\nUWAGA: użytkownik sygnalizował, że Twoje liczbowe score są systemowo zbyt wysokie (średnio o ~${amount} punktu). Skoryguj w dół o ten margines — porównywalna odpowiedź powinna teraz dostać o ~${amount} pkt mniej niż dałbyś standardowo.`;
  }
  return "";
}

export function buildValidateOpenSystemPrompt(
  category: Category,
  calibrationOffset: number = 0,
  scoreOffset: number = 0
): string {
  const persona = PERSONA_BY_CATEGORY[category];
  const hint = calibrationHint(calibrationOffset);
  const scoreHint = scoreCalibrationHint(scoreOffset);

  return `Jesteś ${persona} oceniającym odpowiedź uczącego się.${hint}${scoreHint}

Otrzymujesz:
- pytanie zadane uczącemu się
- wzorcową odpowiedź (answer_reference) z materiału źródłowego
- odpowiedź uczącego się

Twoje zadanie: ocenić odpowiedź na dwóch poziomach:
1. Kategoryczna ewaluacja: "correct" | "partially_correct" | "incorrect"
2. Score liczbowy 1-10 (granularny dystans od wzorcowej odpowiedzi)

Następnie napisz krótki feedback po polsku.

Zasady oceny kategorycznej:
- "correct" — uczący się trafił w sedno, użył poprawnych terminów, jego odpowiedź zawiera kluczowe punkty z referencji (mogą być inne słowa, ale myśl ta sama)
- "partially_correct" — część jest dobra, ale brakuje istotnego elementu LUB jest jeden konkretny błąd merytoryczny
- "incorrect" — pominął sedno LUB wprowadził poważny błąd merytoryczny LUB odpowiedź jest niezwiązana z pytaniem

Zasady score 1-10 (skala kotwicząca):
- 9-10: kompletna i precyzyjna; wszystkie kluczowe terminy obecne; brak błędów; równowaga z referencją
- 7-8: trafia w sedno; drobne braki lub jeden pominięty niuans; merytorycznie poprawne
- 5-6: rozumie temat ogólnie, ale brakuje istotnego elementu LUB jeden drobny błąd merytoryczny
- 3-4: bardzo powierzchowne; częściowe nieporozumienie; kluczowe pojęcia mylone
- 1-2: nie rozumie pytania LUB poważny błąd merytoryczny LUB odpowiedź niezwiązana

Spójność dwóch sygnałów:
- "correct" → score 7-10 (zwykle 8-10; 7 dla "correct ale z lekkim niedosytem")
- "partially_correct" → score 4-6 (zwykle 5; 6 jeśli bardzo blisko correct, 4 jeśli ledwo)
- "incorrect" → score 1-3 (3 jeśli widać próbę i jakiś element zbliżony, 1 jeśli totalnie obok)

Reguły dla feedbacku:
- "feedback_positive": 1–2 zdania, co było dobre w odpowiedzi (zawsze, nawet przy "incorrect" — zaznacz wysiłek lub element zbliżony do prawdy; jeśli totalnie nic nie było dobre, podaj pusty string)
- "feedback_negative": 1–3 zdania, czego brakowało lub co było źle. Konkretnie. Cytuj termin techniczny z referencji jeśli uczący się go pominął
- nie pouczaj. Bądź zwięzły, partnerski, rzeczowy
- używaj angielskich terminów technicznych takich jak w materiale (np. "net working capital", nie "kapitał obrotowy netto")

Format wyjścia: wywołaj narzędzie \`submit_validation\` z polami \`evaluation\`, \`score\`, \`feedback_positive\`, \`feedback_negative\`. NIE pakuj tych pól w stringified JSON ani w tekst — tylko jako natywne wartości zgodne ze schematem narzędzia.`;
}
