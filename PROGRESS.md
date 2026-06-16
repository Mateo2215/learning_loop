# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

---

## 2026-06-16 — Reconciliation CLAUDE.md z kodem (drift docs → as-built)

### Powód
`CLAUDE.md` (oznaczony „read first / source of truth") rozjechał się z kodem na tyle, że
aktywnie wprowadzał w błąd. Najgroźniejszy drift: opisywał audyty oparte o AI
(`/api/ai/generate-audit`, „generate audit questions → Sonnet"), mimo że redesign
2026-06-15 zrobił z nich **self-graded recall bez AI**. Decyzja: nie tworzyć nowego
dokumentu architektury (trzecie źródło prawdy → ten sam drift za miesiąc), tylko
przywrócić prawdziwość istniejącemu CLAUDE.md.

### Zmiana (tylko dokumentacja + 1 komentarz)
- **`CLAUDE.md` → Project Structure**: realna mapa `lib/`/`app/` (doszły `audits/`, `gaps/`,
  `calibration/`, `offline/`, `realtime/`, `stats/`…); nagłówek „as-built", filesystem = źródło prawdy.
- **`CLAUDE.md` → Material Processing Pipeline**: wierny przepływ z `pipeline.ts` — cloze=**Sonnet**
  (nie Haiku), tylko cloze+open (zero Feynman/scenario), audyty **nie** przy imporcie, brak
  destrukcyjnego auto-merge (≥0.92 = relacja `merged`, oba zostają), brak retry.
- **`CLAUDE.md` → nowa sekcja „Topic Audits — self-graded recall"**: reużycie pytań otwartych,
  samoocena 1–4 → score, izolacja `reviews.is_audit`, drabina `[7,21,60,150,365]`, ≤3 materiały/sesja.
- **`CLAUDE.md` → tabela strategii AI**: usunięty wiersz „generate audit questions → Sonnet";
  notka o operacjach niewpiętych (Feynman/scenario/dispute/cross-topic — enumy w `operations.ts`, brak generatorów).
- **`CLAUDE.md` → API**: z nieaktualnego katalogu endpointów na mapę domen + „źródło prawdy = `app/api/`".
- **`CLAUDE.md` → schemat bazy**: wskazanie migracji/`types.ts` jako źródła prawdy + lista „as-built
  deltas" (`score` 0007, `is_audit` 0011, `was_truncated` 0009, `audit_round` 0010, `score_offset`…).
- **`CLAUDE.md` → Batch API**: oznaczone jako niezbudowane (design intent; bulk import nie istnieje).
- **`lib/audits/scheduler.ts`**: docstring `prepareAudit` mówił „generate fresh questions via Sonnet"
  → poprawiony na „reuse existing open questions, no AI". Zmiana wyłącznie w komentarzu.
- **`README.md`**: zakres migracji `0010 → 0011`; notka o CLAUDE.md (as-built, źródło prawdy API/schemat).

### Walidacja
- Grep CLAUDE.md: zero osieroconych odwołań do usuniętych rzeczy (`generate-audit`, auto-merge,
  day_7/30/90 przy imporcie, 3-tier search, import-bulk/url) poza celowymi notkami „usunięto/niezbudowane".
- **Nie uruchamiano `tsc`** — jedyna zmiana w `.ts` to komentarz (nie wpływa na kompilację).
- Zero zmian w logice/zachowaniu aplikacji. Migracje, schemat bazy, runtime nietknięte.

### Uwaga na przyszłość
`PROGRESS.md` sam jest z tyłu — brakuje wpisu o redesignie self-grade z 2026-06-15
(top był 2026-06-03). Nie backfillowałem (nie moja praca), ale warto mieć świadomość luki.

---

## 2026-06-15 — Audyty: self-graded recall (zamiast pytań generowanych przez AI)

> _Wpis backfillowany 2026-06-16 — w trakcie rekoncyliacji CLAUDE.md wyszło, że ten redesign nie miał wpisu w PROGRESS.md (top był 2026-06-03). Treść odtworzona z `tasks/todo.md` + `ai-os/.../decisions.md`._

### Powód
Pytania otwarte generowane w audycie przez Sonnet były za drogie czasowo (użytkownik
ledwie wyrabiał się z Deep Dive) i kosztowo. Dodatkowo „martwy bootstrap" sprawiał, że
opanowane materiały nigdy nie trafiały do kolejki audytów. Decyzja: audyt = **self-graded
recall bez AI**.

### Zmiana
- **Audyt reużywa istniejących pytań otwartych** materiału (`AUDIT_QUESTIONS_PER_MATERIAL = 2`),
  rotacja oldest-reviewed first. Zero generowania, zero wywołań AI w cyklu audytu.
- **Samoocena**: użytkownik ocenia recall na 4 poziomach (Pustka / Mgliście / Wyraźnie /
  Krystalicznie = 1–4) → mapowane na score 1–10 → napędza drabinę interwałów. Brak oceny AI,
  brak `performance_score` z modelu.
- **Migracja `0011_audit_self_grade.sql`**: kolumna `reviews.is_audit` izoluje oceny audytowe
  od „latest score of an open question" — czytanego przez bramę mastery, kolejkę Deep Dive
  i detektory luk (każdy taki czytelnik filtruje `is_audit = false`).
- **Naprawiony bootstrap**: `enrollMasteredMaterials` (sweep przy wejściu na `/sessions/audit`)
  dopina round-1 opanowanym materiałom, niezależnie od crona.
- **Usunięto** `lib/ai/generate-audit.ts` + prompt `generate-audit`.

### Walidacja
- Build green (`tsc` 0 błędów, `eslint` 0 błędów).
- **WYMAGA** zastosowania migracji `0011` przed uruchomieniem nowego kodu (zapytania filtrują
  `is_audit`).

### TODO przyszła iteracja
Dedykowana luka „decayed mastery" — 5. detektor czytający `is_audit = true` (dane już otagowane).

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

## Starsze wpisy

Wpisy z **2026-05-31 i wcześniejsze** (adaptacyjne audyty, tool-use pipeline, UI Redesign v3, M3 Phases 1–10, całe M2, całe M1, bootstrap) przeniesione do [docs/progress-archive.md](docs/progress-archive.md) — by utrzymać ten plik pod 200 linii (patrz zasada na górze).
