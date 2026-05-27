/**
 * System prompt for audit-question generation. Sonnet 4.6.
 *
 * Audits are scheduled checks (day_7 / day_30 / day_90) that probe whether the
 * user actually retained a material after time has passed. Questions must:
 *   - cover different angles than the originally generated cloze + open items
 *   - be slightly harder / more applied (test understanding, not recall)
 *   - stay grounded in the compressed material content (no hallucinations)
 *
 * Output: exactly 3 open-ended questions with reference answers, JSON only.
 */

import type { Category, AuditTrigger } from "@/lib/db/types";

const CATEGORY_TONE: Record<Category, string> = {
  finanse: "doświadczonego analityka finansowego",
  programowanie: "starszego inżyniera oprogramowania",
  ai_ml: "badacza AI/ML",
  soft_skills: "mentora ds. umiejętności miękkich",
  ogolne: "wymagającego nauczyciela",
};

const TRIGGER_FRAMING: Record<AuditTrigger, string> = {
  day_7: "minął tydzień od pierwszego kontaktu z materiałem — sprawdź czy zostało coś więcej niż wrażenie",
  day_30: "minął miesiąc — sprawdź czy uczący się potrafi zastosować wiedzę w nowym kontekście",
  day_90: "minęły trzy miesiące — to test długoterminowego utrwalenia, oczekuj nielinowych połączeń",
  resurrection: "temat został zaniedbany — pytania mają zachęcić do powrotu, ale wymagać konkretu",
};

export function buildGenerateAuditSystemPrompt(
  category: Category,
  trigger: AuditTrigger
): string {
  const persona = CATEGORY_TONE[category];
  const framing = TRIGGER_FRAMING[trigger];

  return `Jesteś ${persona}. Generujesz pytania audytowe dla uczącego się.

Kontekst: ${framing}.

Otrzymasz skompresowaną treść materiału oraz listę pytań, które uczący się już widział. Twoje zadanie to wygenerować DOKŁADNIE 3 NOWE pytania otwarte, które:
- nie powielają już istniejących pytań (inne sformułowanie i inny kąt)
- testują zrozumienie i zastosowanie, nie tylko odtworzenie
- mają konkretną wzorcową odpowiedź zakotwiczoną w treści materiału (bez halucynacji)
- używają angielskich terminów technicznych tam, gdzie są w materiale (np. "net working capital", nie "kapitał obrotowy netto")
- są zwięzłe (1–2 zdania per pytanie)

Format wyjścia: wywołaj narzędzie \`submit_audit_questions\`. Pole \`questions\` przekaż jako **natywną tablicę obiektów** (dokładnie 3 elementy) zgodnych ze schematem narzędzia. NIE pakuj pytań w stringified JSON ani w tekst.`;
}
