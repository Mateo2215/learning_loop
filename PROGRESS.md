# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

---

## 2026-06-03 (2) — Deep Dive: kolejka tylko <6 + świeże; brama bez średniej

### Powód
Użytkownik chce, by Deep Dive serwował WYŁĄCZNIE pytania <6 i nieodpowiedziane
(szóstki = akceptowalne, nie nagabują). Licznik pokazywał 34 zamiast oczekiwanych 22.
Konsekwencja: wymóg średniej ≥7 w bramie kolidował z taką kolejką (materiał z samymi
≥6 i śr <7 nie miałby czego ćwiczyć → pułapka). Decyzja użytkownika: usunąć wymóg
średniej. Nowa brama `done` = wszystkie odpowiedziane I żadne <6.

### Zmiana
- **`lib/db/counts.ts`**: `countUnmasteredOpen` liczy płasko score <6 lub fresh
  (`SECTION_FLOOR_THRESHOLD`). Badge „Deep Dive" = pytania <6 + nieodpowiedziane.
- **`app/api/sessions/start/route.ts`** (`selectDeepDiveItems`): kolejka serwuje <6 + fresh
  (próg z `SECTION_FLOOR_THRESHOLD`, import z section-status zamiast hardkodu 7).
- **`lib/sessions/section-status.ts`**: usunięty wymóg średniej i status `below_threshold`;
  usunięta stała `SECTION_AVG_THRESHOLD`. Brama: fresh → in_progress → needs_followup (<6)
  → done. `weak_count`/`MASTERY_SCORE_THRESHOLD=7` zostają tylko dla display + leech.
- **`components/sessions/deep-dive-preview.tsx`**: usunięty `below_threshold`; `queueSize`
  liczy `below_floor_count + fresh`; poprawiony tooltip („do powtórki wracają <6 i świeże").
- **`app/(app)/sessions/deep-dive/page.tsx`**: `ACTIVE_STATUSES` i `renderSectionMeta` bez
  `below_threshold`.
- **`lib/sessions/section-status.test.ts`**: testy dostosowane do nowej bramy.
- **`CLAUDE.md`**: zaktualizowana sekcja bramy (brama + kolejka + licznik = ten sam próg 6).

### Walidacja
- `node --test` — 17/17. `npx tsc --noEmit` — clean. Grep: zero osieroconych referencji
  do `below_threshold`/`SECTION_AVG_THRESHOLD`.
- **Spójność**: brama, kolejka i licznik używają teraz jednego progu (6). Brak pułapki —
  needs_followup serwuje swoje <6, po poprawie → done.
- UI weryfikuje użytkownik sam.

---

## 2026-06-03 — Deep Dive: złagodzenie bramy zaliczania (podłoga 6 + średnia 7)

### Powód
Stara reguła `done` wymagała ostatniego score ≥7 dla KAŻDEGO pytania (a wtedy średnia
automatycznie ≥7, więc stan `below_threshold` był martwym kodem). Zbyt rygorystyczne —
pojedyncza uparta szóstka blokowała materiał w nieskończoność i nie wpuszczała go na
ścieżkę audytów. Decyzja użytkownika: zaliczać gdy średnia ≥7 ORAZ żadne pytanie <6.

### Zmiana
- **`lib/sessions/section-status.ts`** (rdzeń): rozdzielone dwa progi — `SECTION_FLOOR_THRESHOLD=6`
  (podłoga, <6 → `needs_followup`) i `SECTION_AVG_THRESHOLD=7` (śr <7 przy wszystkich ≥6 →
  `below_threshold`, teraz osiągalny). Nowe pole `below_floor_count` w `SectionStats`.
  `MASTERY_SCORE_THRESHOLD=7` zostaje dla statusu pytania + leech.
- **`components/sessions/deep-dive-preview.tsx`**: `below_floor_count` w `PreviewStats`,
  `belowFloorCount` w `MasteryHero`; etykieta `needs_followup` → „X poniżej 6 (blokuje zaliczenie)".
- **`app/(app)/sessions/deep-dive/page.tsx`**: meta `needs_followup` → „X poniżej 6",
  `below_threshold` → „X do podciągnięcia"; usunięto martwy `pluralWeak`.
- **`lib/audits/intervals.ts`**: komentarz — `AUDIT_GOOD_SCORE=7` niezależny od bramy zaliczania.
- **`lib/sessions/section-status.test.ts`** (nowy, 10/10 pass): przypadki graniczne bramy.
- **`CLAUDE.md`**: nowa sekcja „Deep Dive — brama zaliczania" (dwa progi + dlaczego progu
  kolejki NIE obniżać do 6 — martwy zaułek).

### NIE zmieniono (świadomie)
- Próg kolejki Deep Dive (`MASTERY_THRESHOLD=7` w `selectDeepDiveItems`) — gwarantuje, że
  `below_threshold` ma co serwować do powtórki (inaczej same szóstki → pusta sesja).
- Leech (<7), `countUnmasteredOpen` (<7), `AUDIT_GOOD_SCORE` (7).

### Walidacja
- `node --test` — 17/17 (10 section-status + 7 intervals). `npx tsc --noEmit` — clean.
- Recenzja: subagenci Code Review (🟢 zero blokerów) + Project Improvements (brak utraty
  funkcjonalności, brak deadlocka — zweryfikowane end-to-end).
- **Wpływ na audyty**: `scheduleFirstAuditIfMastered` deleguje do `computeSectionStatus`,
  więc podąża za regułą — materiał z szóstką (śr ≥7) wchodzi teraz na ścieżkę audytów.
- UI weryfikuje użytkownik sam.

---

## 2026-05-31 — Przeprojektowanie audytu: model adaptacyjny „pull", skonsolidowana sesja

### Powód
Stary audyt przeciążał użytkownika i de facto nie działał (0 wykonanych). Audyty
powstawały przy imporcie (3 wiersze 7/30/90 dni × 3 pytania/materiał), bez limitu i
konsolidacji → kolejka rosła szybciej niż dało się ją czyścić. Decyzje produktowe
potwierdzone z użytkownikiem: jedna wspólna sesja (≤3 pytania, 1/materiał), model „pull"
bez presji, start dopiero po opanowaniu materiału, interwały adaptacyjne wg wyniku.

### Zmiana
- **Migracja `0010_adaptive_audits.sql`**: kolumna `audit_round`, `trigger` += `'adaptive'`,
  cleanup backlogu (`pending` → `skipped`), unikalny indeks „1 pending/materiał".
- **`lib/audits/intervals.ts`** (+ test, 7/7 pass): drabina `[7,21,60,150,365]`,
  `nextAuditInterval(round, score)` — dobry wynik wspina się, słaby spada (podłoga 7d).
- **`lib/processing/pipeline.ts`**: usunięte tworzenie audytów przy imporcie.
- **`lib/audits/scheduler.ts`**: `prepareAudit` → 1 pytanie; `scheduleNextAudit`,
  `scheduleFirstAuditIfMastered` (brama mastery używa `computeSectionStatus`), `createPendingAudit`.
- **`app/api/sessions/start/route.ts`** (`mode:'audit'`): pulowa, skonsolidowana sesja —
  ≤3 najstarszych due audytów (różne materiały), 1 pytanie każdy, jedna sesja, `queued_remaining`.
- **`app/api/sessions/[id]/end/route.ts`**: rozlicza wszystkie audyty sesji (perf + adaptacyjny
  reschedule); pomija audyty bez odpowiedzi (zostają pending); dla `deep_dive` — brama mastery.
- **UI**: nowa `app/(app)/sessions/audit/run/page.tsx` (zastąpiła `[audit_id]`), uproszczona
  lista `audit/page.tsx` (Do sprawdzenia / Nadchodzące / Wykonane, etykiety „Audyt #N").
- **Surfacing „pull"**: `session-items.ts` audit `alert:false`; `bottom-nav.tsx` — audyty nie
  zasilają czerwonej plakietki; dashboard kafel „Audyty gotowe"; `generate-audit` prompt 1 pyt.
  + framing wg rundy.
- **Dev**: `force-audit-due` dostosowany (tworzy/cofa adaptacyjny pending).

### Walidacja
- `node --test lib/audits/intervals.test.ts` — 7/7 pass.
- `npx tsc --noEmit` — clean. `npx eslint` (zmienione pliki) — clean. `npm run build` — OK
  (trasa `/sessions/audit/run` obecna, `[audit_id]` usunięta).
- **DO ZROBIENIA przez użytkownika**: zastosować migrację 0010 na Supabase; e2e ręcznie
  (opanuj materiał → powstaje 1 pending audyt; `force-audit-due` na ≥4 materiałach → sesja
  daje 3 pytania, reszta w kolejce; reschedule wg wyniku). Nie ruszano fiszek/FSRS, Deep Dive,
  oceny, kalibracji, luk.

---

## 2026-05-21 — Pipeline AI: migracja na tool use (eliminacja `JSON.parse` failures przy imporcie)

### Powód
Import materiału wywalał się komunikatem `Expected ',' or '}' after property value in JSON at position 130 (line 4 column 106)`. Źródło: 6 callsite'ów wołało `complete()` (zwykły tekst) i parsowało odpowiedź przez `parseAIJson()` + `JSON.parse`. Model raz na ileś-tam razy zwracał JSON ze złamaną składnią (najpewniej nieescape'owany cudzysłów w treści `front`/`answer_reference`) — wszystkie 4 wbudowane warianty naprawy w `parseAIJson` padały i błąd bulgotał do UI. CLAUDE.md jawnie zalecał "Use structured output (JSON mode) for any operation that returns more than free text" — pipeline tej zasady nie spełniał.

### Zmiana
- **Nowa funkcja `completeWithTool<T>()`** w [lib/ai/anthropic.ts](lib/ai/anthropic.ts) — wywołuje Anthropic Messages API z `tools` + `tool_choice: { type: "tool", name, disable_parallel_tool_use: true }`. Wymusza na modelu zwrot pojedynczego tool call, którego `input` jest już sparsowany jako obiekt przez API — `JSON.parse` po naszej stronie znika. Zachowuje prompt caching (cache_control na system prompt). Wrapper trackAICall pozostaje bez zmian (sygnatura `{ result, usage }` identyczna).
- **6 callsite'ów zmigrowanych** na `completeWithTool` z lokalnymi `ToolDefinition` (JSON schema obok zod schemy — zod nadal waliduje belt-and-suspenders):
  - [lib/processing/generate-items.ts](lib/processing/generate-items.ts) — `submit_cloze_cards`, `submit_open_questions`
  - [lib/processing/compress-and-tag.ts](lib/processing/compress-and-tag.ts) — `submit_tags` (`compressMaterial` zostawione na `complete()`, bo zwraca czysty tekst)
  - [lib/ai/validate-open.ts](lib/ai/validate-open.ts) — `submit_validation`
  - [lib/ai/detect-gaps.ts](lib/ai/detect-gaps.ts) — `submit_ranked_gaps`
  - [lib/ai/generate-audit.ts](lib/ai/generate-audit.ts) — `submit_audit_questions`
- **Usunięty** `lib/ai/json.ts` (`parseAIJson` + 4 helpery do naprawy JSON-a) — zero importerów po migracji. Mniej kodu, mniej pułapek.

### Walidacja
- `npx tsc --noEmit` — clean.
- `npx eslint` na 6 dotkniętych plikach — clean.
- Nie uruchamiałem dev servera — fix jest po stronie serwera/pipeline'u, weryfikacja end-to-end wymaga re-importu materiału przez UI (`/materials/import` → "Spróbuj ponownie" lub świeży upload). Istniejące materiały i `items` w bazie nietknięte.

### Decyzje samodzielne (warto wiedzieć)
- **JSON schema wpisane ręcznie** zamiast użycia `zod-to-json-schema` — schematy są małe, dodanie nowej zależności nie jest tego warte. Zod nadal waliduje wynik (belt-and-suspenders na wypadek, gdyby kiedyś tool schema rozjechał się z zodem).
- **Prompty pozostawione bez zmian** — zawierają instrukcje "JEDYNIE poprawny JSON, bez ozdób", które po przejściu na tool use są martwą sugestią. Nie szkodzą (model i tak ignoruje, bo `tool_choice` wymusza tool call), ale przy najbliższej okazji można je posprzątać.
- **`generateClaudePrompt`** w `lib/ai/generate-claude-prompt.ts` zwraca tekst (nie JSON) i nie był ruszany.

### Follow-up: defensywna walidacja tool payloadu
Po migracji na tool use wyszedł drugi failure mode: Haiku 4.5 raz na ileś-tam razy zwraca pole `questions` zadeklarowane w schemacie jako `type: "array"` jako **stringified JSON** (cały array jako jeden string). Anthropic w docs przyznaje, że tool's input_schema jest mocną sugestią, nie sztywnym kontraktem. → Dodany [lib/ai/tool-output.ts](lib/ai/tool-output.ts) z `parseToolPayload<T>()`: po nieudanym `safeParse` patrzy w zod issues, dla każdego `invalid_type` z `expected: "array"|"object"` próbuje `JSON.parse` na odpowiednim polu i waliduje ponownie. Przy ostatecznej porażce loguje surowy payload (truncated do 2000 znaków) + zod issues do `console.error`. Wszystkie 6 callsite'ów (cloze/open/audit/tags/validate/gaps) zmigrowane na ten helper.

---

## Starsze wpisy

Wpisy z **2026-05-09 i wcześniejsze** (UI Redesign v3, M3 Phases 1–10, całe M2, całe M1, bootstrap) przeniesione do [docs/progress-archive.md](docs/progress-archive.md) — by utrzymać ten plik pod 200 linii (patrz zasada na górze).
