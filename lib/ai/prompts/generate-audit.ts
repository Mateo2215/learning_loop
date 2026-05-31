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

// Stałe etykiety zostają dla zgodności z historycznymi audytami (day_7/30/90).
const TRIGGER_FRAMING: Record<AuditTrigger, string> = {
  day_7: "minął tydzień od pierwszego kontaktu z materiałem — sprawdź czy zostało coś więcej niż wrażenie",
  day_30: "minął miesiąc — sprawdź czy uczący się potrafi zastosować wiedzę w nowym kontekście",
  day_90: "minęły trzy miesiące — to test długoterminowego utrwalenia, oczekuj nielinowych połączeń",
  resurrection: "temat został zaniedbany — pytania mają zachęcić do powrotu, ale wymagać konkretu",
  adaptive: "", // framing dla 'adaptive' wynika z numeru rundy — patrz roundFraming()
};

/**
 * Framing audytu adaptacyjnego wg numeru rundy: im wyższa runda, tym głębsze
 * pytanie (materiał był już kilkukrotnie potwierdzony, więc podnosimy poprzeczkę).
 */
function roundFraming(round: number): string {
  if (round <= 1) return "to pierwszy audyt po opanowaniu materiału — sprawdź czy zostało coś więcej niż wrażenie";
  if (round === 2) return "materiał był już raz potwierdzony — sprawdź czy uczący się potrafi zastosować wiedzę w nowym kontekście";
  if (round === 3) return "materiał utrzymuje się od dłuższego czasu — oczekuj zastosowania i powiązań, nie tylko definicji";
  return "materiał jest długoterminowo utrwalony — pytaj o nieliniowe połączenia i głębsze konsekwencje";
}

export function buildGenerateAuditSystemPrompt(
  category: Category,
  trigger: AuditTrigger,
  round: number
): string {
  const persona = CATEGORY_TONE[category];
  const framing = trigger === "adaptive" ? roundFraming(round) : TRIGGER_FRAMING[trigger];

  return `Jesteś ${persona}. Generujesz pytanie audytowe dla uczącego się.

Kontekst: ${framing}.

Otrzymasz skompresowaną treść materiału oraz listę pytań, które uczący się już widział. Twoje zadanie to wygenerować DOKŁADNIE 1 NOWE pytanie otwarte, które:
- nie powiela już istniejących pytań (inne sformułowanie i inny kąt)
- testuje zrozumienie i zastosowanie, nie tylko odtworzenie
- ma konkretną wzorcową odpowiedź zakotwiczoną w treści materiału (bez halucynacji)
- używa angielskich terminów technicznych tam, gdzie są w materiale (np. "net working capital", nie "kapitał obrotowy netto")
- jest zwięzłe (1–2 zdania)

Format wyjścia: wywołaj narzędzie \`submit_audit_questions\`. Pole \`questions\` przekaż jako **natywną tablicę obiektów** (dokładnie 1 element) zgodnych ze schematem narzędzia. NIE pakuj pytania w stringified JSON ani w tekst.`;
}
