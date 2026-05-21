# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

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

## 2026-05-09 — UI Redesign v3 wg `design_handoff/` (DONE), Phase 11 still PENDING

Wszystkie 10 ekranów Learning Loop przepisane na nowy design (warm editorial v3). Build green przez całą drogę. Logika biznesowa, kontrakty API i schemat DB nietknięte.

### Faza 0 — Fundamenty
- Nowe primitives w `components/ui/` i `components/shared/`: `chip.tsx`, `kbd.tsx`, `mastery-bar.tsx`, `kpi-card.tsx`, `progress-strip.tsx`, `section-header.tsx`.
- Refaktor `components/shared/top-nav.tsx` — sticky max-w-1024, brand "Learning Loop" z accent na "Loop", dropdowny Sesje/Menu, max-h-14, theme toggle po prawej.
- Focus mode segment layouts: `app/(app)/sessions/review/layout.tsx`, `app/(app)/sessions/deep-dive/[material_id]/layout.tsx`. `components/shared/app-chrome.tsx` (client) ukrywa TopNav/BottomNav dla session-run paths via `usePathname`. `CostLimitBanner` przekazany jako `banner` prop (server slot w client wrapperze).
- `page-header.tsx` zachowany jako alias `SectionHeader` dla wstecznej kompatybilności.

### Faza 1 — Dashboard / Materiały / Szczegół
- `/dashboard`: greeting serif, hero "Dzisiejsza pętla" w `bg-accent-soft`, streak 7-segment bar (placeholder `streakDays = 0` — TODO field), 3× KPICard "Do zrobienia dziś", FreshMaterials restyling, snapshot 4 ostatnich materiałów.
- `/materials`: server-side `?q=&cat=` filtrowanie, grupowanie po miesiącach (Polish locale), 2-col grid `MaterialCard` z `MasteryBar` (segmenty liczone z `fsrs_stability`: <1d=learning, 1-7d=young, 7-30d=mature/young, ≥30d=mature).
- `/materials/[id]`: breadcrumb mono, actions row (Tasuj/Wygeneruj — disabled TODO endpointu, Start sesji), source-icon cover (DOCX/MD/URL/paste), 4-tab refaktor (`Fiszki/Pytania otwarte/Źródło/Notatki`), grid `FlashThumb` 3-col, lista `QuestionItem`.
- Nowe komponenty: `material-card.tsx`, `flash-thumb.tsx`, `question-item.tsx`.

### Faza 1.5 — Przywrócenie edycji fiszek (regresja z Fazy 1)
- W Fazie 1 sub-agent usunął `item-list-client.tsx` (inline editing) bo nie pasowało do makiety. Endpoint `PATCH /api/items/:id` zostawał, ale UI był martwy.
- Naprawione przez `components/materials/item-edit-dialog.tsx` — własny portal-less dialog (Radix Dialog niezainstalowany; nie dodawaliśmy zależności). Klik w `FlashThumb` lub `QuestionItem` otwiera modal z dwoma textarea (Przód/Tył lub Pytanie/Odpowiedź referencyjna). Submit → PATCH → `router.refresh()` + sonner toast. Walidacja zgodna z backend zod (question ≥5 znaków, answer ≥1).
- Wrappery `<button>` z hover ikoną `Pencil` (lucide). Audit items są niewyedytowalne (backend zwraca 400) — UI tego nie odróżnia, użytkownik dostanie toast z błędem przy próbie zapisu (loose end).

### Faza 2 — Sesje (Review + Deep Dive)
- **Review** (focus mode): nowy `SessionHeader` z X/counter/timer, `ProgressStrip` 20-segment, `CardStack3D` (aktywna karta + 2 zblurowane warstwy za nią; reveal flow), `GradingButtons` 1-4 (Znów/Trudne/Dobrze/Łatwe) z next interval fallback, `SessionSidePanel` 296px desktop-only (Z źródła / Historia / Następne / Statystyki sesji). Timer client-side od `started_at`.
- **Deep Dive picker** (with TopNav): 2-col grid 300px lista materiałów + preview empty state z `BookOpen` ikoną.
- **Deep Dive active** (focus mode): centered serif question 36px, refaktor `answer-input.tsx` z floating mic button (placeholder, voice mode hook z M3 Phase 4 nadal aktywny), `Cmd/Ctrl+Enter` submit, `Esc` close z confirm. ProgressStrip footer.
- `SessionShell` zachowany (używa go nadal `/sessions/audit/[audit_id]`).
- **Zachowane**: optimistic advance, FSRS rating submit, offline queue, conflict resolution + take-over, leech indicator (przeniesiony do meta slotu CardStack3D), AI validation, calibration buttons, FeedbackDetails, dispute-ready feedback.

### Faza 3 — Audyty / Stats / Settings / Koszty
- `/sessions/audit`: legenda 7d/30d/90d, 3 sekcje (Zaległe `border-warn/30` / Nadchodzące / Ostatnio wykonane z score chip wg performance_score). Reuse `getDueAudits`, dwa nowe queries upcoming/completed.
- `/stats`: 2× hero KPI (W tym tygodniu count, Skuteczność % z 30d), 4× stat cards, **`ActivityChart` 8-tygodniowy CSS-only** (bez recharts/chart.js) — stacked correct/total bars w `components/stats/activity-chart.tsx`. AI Costs preview card z linkiem do `/costs`.
- `/settings`: max-w-720, 3-state theme radio (light/dark/system) + auto-after-19:00 checkbox, refaktor `calibration-client.tsx` (zachowane API + recompute fetch), cost progress bar do soft/hard limit, eksport JSON `<a download>` do `/api/export/json`, **nowy `danger-zone.tsx`** z double-confirm — UI gotowy, brak backendu (toast.warning że niewdrożone).
- `/costs`: 3× summary cards (Dziś/Miesiąc/Projekcja), 2× breakdown z proporcjonalnymi barami (per operacja `bg-accent`, per model `bg-accent-2`), tabela 20 ostatnich wpisów `usage_logs` w monospace grid (scroll-x na mobile).

### Bug fix — duplikujące się klucze tagów
- React error: `Encountered two children with the same key, '#1'`. Przyczyna: niektóre materiały miały duplikaty w `materials.tags[]` (AI auto-tagger nie dedupuje), a UI używał `key={t}` przy mapowaniu.
- Defensywny fix w 4 plikach: `components/materials/material-card.tsx`, `app/(app)/materials/[id]/page.tsx`, `app/(app)/gaps/gaps-client.tsx`, `app/(app)/gaps/[id]/detail-client.tsx`, `app/(app)/search/search-client.tsx` — klucze zmienione na `${t}-${i}`.
- Przyczyna źródłowa nie tknięta — zob. Phase 11 outstanding.

### Decyzje samodzielne (warto wiedzieć)
- **Focus mode rozszerzony o `/sessions/audit/[id]`** w `app-chrome.tsx` — wykracza poza pierwotny plan, ale spójne z `lib/nav/paths.ts:isSessionRunPath`. Zatwierdzone przez użytkownika.
- **Brand "Learning Loop"** zachowany zamiast "Loop" z makiet — spójność z dotychczasową identyfikacją. Zatwierdzone.
- **Strength dots w `FlashThumb`** liczone progowo z `fsrs_stability` (null/0=0, <1d=1, <7d=2, <30d=4, ≥30d=5).
- **Mastery segments** w MaterialCard też z `fsrs_stability` (brak osobnego pola `mastery_state` w schemacie — sensownie się mapuje).
- **Edycja cloze** w `ItemEditDialog`: jednolite pola Przód/Tył; backend sam syncuje `cloze_data.front`/`.answer`. Brak osobnego edytora składni `{{...}}`.
- **`SessionStartResponse`** rozszerzona o opcjonalny `material_title` (TODO w `/api/sessions/start`) — fallback "Deep Dive".

### Loose ends do Fazy 11+
- **Streak field** — placeholder 0; potrzebna agregacja albo nowe pole w bazie.
- **Tasuj / Wygeneruj nowe na detalu materiału** — UI gotowe (`disabled`), brak endpointów.
- **Voice input** — mic button placeholder, Web Speech API (M3 voice hooks) nadal niepodpięty.
- **Side panel "Historia karty" w Review** — wymaga endpointu zwracającego ostatnie reviews dla `item_id`.
- **Side panel "Z źródła"** używa `answer_reference` jako fallback — idealnie cytat z `content_compressed`.
- **`material_title` w `/api/sessions/start`** — drobne rozszerzenie endpointu.
- **FSRS interval preview w GradingButtons** — obecnie statyczne fallbacki (`<10min`, `1d`, `4d`, `10d`); realny preview wymaga FSRS calc client- lub server-side.
- **Card flip animation** — obecnie prosty conditional render; pełen 3D flip do rozważenia.
- **Audit items niewyedytowalne** — UI nie odróżnia ich wizualnie w `ItemsTabs`; user widzi błąd dopiero po kliknięciu zapisz. Filter w queryzch albo wizualne disabled.
- **Backend dla "Wyczyść dane" / "Usuń konto"** w danger zone — UI gotowe, brak endpointów.
- **🆕 Tag dedup** (z dzisiejszego buga): defensywny dedup w pipeline imports — `lib/processing/auto-tag.ts` lub `lib/processing/pipeline.ts` powinien `Array.from(new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean)))` przed insertem do `materials.tags`. Plus one-off SQL migration czyszczący istniejące duplikaty: `UPDATE materials SET tags = ARRAY(SELECT DISTINCT unnest(tags))`. UI fix już chroni przed crashem, ale przyczyna w bazie nadal istnieje.

### Build state
- `npm run build` zielony przez wszystkie fazy (32 routes, Turbopack, TypeScript strict clean, ESLint clean).
- Manualna weryfikacja UI pozostaje: przeklikać 10 ekranów w obu motywach (light/dark) na 3 viewportach (375/768/1280).

### Lessons learned
- **Sub-agent może bezgłośnie usunąć funkcjonalność**, nawet z briefingiem "tylko prezentacja". W Fazie 1 inline editing fiszek został skasowany bo "makieta tego nie pokazuje". Wykrył dopiero user pytaniem "czy straciliśmy funkcjonalność tak?". Lesson: w briefingach sub-agentów wymagać explicit listy wszystkich akcji do zachowania, plus raport "co przeniosłem / czego dotknąłem".
- **Defensywne klucze list w React**: dla pól typu `text[]` z bazy NIGDY nie używać `key={item}` bezpośrednio — tablica może mieć duplikaty. `key={`${item}-${i}`}` jest tani i bezpieczny.
- **Tokeny CSS już zgodne z designem przed redesignem** — `app/globals.css` z M3 Phase 10 (Reading Room) były 1:1 z `tokens-v2.css` z handoffu. Phase 0 redesignu = 0 zmian w tokenach. Wartość polerki tokenów z Phase 10 zwróciła się z nawiązką.
- **Tailwind v4 `@theme inline` mapping** sprawdza się przy redesignach: zmiana koloru = jeden var, wszystkie utility z prefixem działają od razu. Komponenty pozostają stabilne między iteracjami designu.

---

## 2026-05-05 — M3 Phases 8–10 (DONE), Phase 11 PENDING

Commit `37923f7`. 56 plików (+2128/-920). Build green (41 routes), tsc clean. Po tym commicie zatrzymujemy się na test wizualny przed Phase 11 (final QA + closing commit + dokumentacja smoke testów).

### Phase 8 — Cross-device guard + Fresh Materials + voice hooks
- `lib/sessions/active-guard.ts` — `findActiveSession` (6h stale window) + `endActiveSessions` dla force-takeover.
- `lib/sessions/start-client.ts` — wspólny `startSession<T>` helper (kind: ok/empty/conflict/error). Klient detektuje device po `(max-width: 767px)`.
- `components/sessions/active-session-prompt.tsx` — Card z "Przejmij tutaj" / "Wróć".
- `app/api/sessions/start/route.ts` — przed insertem sprawdza aktywną sesję; 409 `active_session_elsewhere` z payloadem `{ id, mode, device, started_at }`. `force: true` kończy starą i tworzy nową.
- 3 strony sesji (review/deep-dive/audit) mają nowy `phase === "conflict"` z dedykowanym retry callback.
- `mode='voice'` zaaplikowany na AnswerInput w deep-dive + audit (mic icon hook z Phase 4 teraz aktywny).
- `components/dashboard/fresh-materials.tsx` — server component, materiały z ostatnich 24h bez wpisu w `reviews` (sessions nie FK do material, więc reviews jest źródłem "touched").

### Phase 9 — Error boundaries + dep cleanup
- `app/error.tsx` (root, własny `<html>`/`<body>` per Next 16), `app/(app)/error.tsx` (protected routes), `app/not-found.tsx`.
- `voyageai` usunięte z `package.json` (M2 i tak używał raw fetch). `npm audit`: 2 moderate transitive vulns, 0 high.

### Phase 10 — Reading Room visual reskin (główna polerka)
- **Token foundation**: paleta Reading Room w `app/globals.css` (rdzawy `#B8541C` → `#D97A47` w dark, warm canvas `#FAFAF7` / `#0F0F0E`) + `@theme inline` mapping. Dzięki temu `bg-canvas`, `text-fg`, `border-line`, `text-accent`, `font-serif` działają jako natywne Tailwind utility — zmiana palety = jeden var.
- **Source Serif 4** załadowany przez `next/font/google`, eksposed jako `--font-source-serif` → `font-serif`.
- **Mechaniczny refactor**: 33 pliki zmigrowane z `bg-zinc-*` / `dark:*` / `emerald` / `red` / `amber` na semantic tokens. 0 dopasowań starych klas po migracji.
- **Shared component library** (10 nowych): `page-header`, `tag`, `stat-tile`, `status-pill`, `empty-state`, `section-card`, `loading-skeleton`, `confirm-button`, `screen-message`, `session-shell`.
- **Nav redukcja 9→4**: TopNav (client) z desktop nav + dropdown ("Sesje", "Menu") + active state border-accent. `BottomNav` 4-ikonowy na mobile (poza sesjami). `lib/nav/paths.ts` — `isSessionRunPath`, `isPathInside`. Email z nav usunięty, ląduje w `/settings`.
- **Sessions chrome-less**: TopNav i BottomNav samodzielnie się chowają na session-run paths via `usePathname` gating.
- **Sesja Review**: SessionShell, font-serif text-2xl/4xl, progress thin bar u góry, leech jako kropka, rating buttons 4-w-rzędzie z hero cyfrą + label, odpowiedź w mono `bg-elevated` (drop emerald — colour-conflict z CTA).
- **Sesja Deep Dive + Audyt**: SessionShell + hero serif + custom collapsible (FeedbackDetails) zamiast `<details>`. Calibration buttons z lucide ikonami + skróconymi etykietami (Surowo/Trafnie/Pobłażliwie).
- **Dashboard**: FreshMaterials hero (no Card chrome, duża lista + "Zacznij Deep Dive →" CTA per item), 6→3 actionable StatTiles (klikalne, link), one-line statystyka mono. Plus FAB na mobile (`bottom-20 right-4`).
- **Materials**: list dense + grouping po dacie (Dziś/Wczoraj/Maj 2026). StatusPill tylko dla non-ready. Detail: hero h1 serif + `ItemsTabs` (custom, nie shadcn — Fiszki/Pytania).
- **Audyty**: lista zamiast Cards z trigger badge w mono (`7D`/`30D`/`90D`/`RES`) + relative date.
- **Gaps**: severity przez `border-l-[3px]` (line/warn/bad) + StatusPill, bez Card backgrounds.
- **Costs reorg**: `/settings/costs` jako re-eksport, sekcja w `/settings` z progress bar do soft limit. `CostLimitBanner` globalny w `(app)/layout.tsx` (rendered tylko gdy soft/hard hit).
- **Login editorial**: nazwa appki w serif text-5xl z accent na "Loop", manifesto pod, magic link form z h-12 input/button + "Bez hasła. Magic Link" hint.

### Outstanding for M3 (Phase 11 — final close)
- **Manualny smoke test** end-to-end (14-punktowa lista z planu): tokens migracji, Source Serif rendering, top/bottom nav active state, sesja Review fullscreen, Dashboard hero, Costs banner globalny, mobile single-handed, light/dark parity, offline session w sesji review, Realtime import status, cross-device prompt, Fresh Materials widget, voice icon disabled, Lighthouse mobile ≥90 PWA install.
- Pliki do aktualizacji: `tasks/todo.md`, `tasks/lessons.md`, ewentualnie root `CLAUDE.md` jeśli decyzje zdywergowały od planu.
- **Final commit M3**: po ewentualnych korektach z screen toura z użytkownikiem.
- **Manualne kroki użytkownika** wciąż wiszą:
  - Apply `0005_realtime.sql` w Supabase SQL Editor (jak w poprzednim entry).
  - Upewnić się że dark theme rdzawy `#D97A47` wygląda OK na realnym monitorze; jeśli za dim → bumping w `globals.css`.

### Build state
- `tsc --noEmit` clean
- `npm run build` zielony (41 routes — dochodzi `/settings/costs`)
- Commit `37923f7` na masterze, dev server testowany po commicie

### Lessons learned (Phase 10)
- **Tokens martwe to nie tokens** — w Phase 1 zdefiniowaliśmy paletę, ale grep przez kod zwracał 0 użyć. Phase 10 zaczynała się od podpięcia `@theme inline` w Tailwind v4. Bez tego polerka byłaby ręczna w 30+ plikach.
- **Tailwind v4 `@theme inline` mapping**: `--color-canvas: var(--bg-canvas)` w `@theme inline` → `bg-canvas` jako natywna utility. Klucz: `--color-*` prefix dla kolorów, `--font-*` dla fontów. Bez prefixów Tailwind nie generuje utilities.
- **Source Serif 4 vs latin-ext**: Polski potrzebuje `latin-ext` w `subsets` w `next/font/google` żeby ą/ę/ł/ó renderowały się correctly. Default `["latin"]` da fallbacki i wygląda niespójnie.
- **Custom client tabs > shadcn tabs**: nie dodawaliśmy shadcn `tabs.tsx` (kolejny radix dep); własny ItemsTabs (~30 linii) wystarczy dla 1 use-case.
- **Sessions chrome-less via gating, nie osobny layout**: zamiast `app/(app)/sessions/layout.tsx` (skomplikuje rendering bo `(app)/layout.tsx` i tak owija children), gating w TopNav/BottomNav przez `isSessionRunPath(pathname)`. Mniej plików, ten sam efekt.
- **Calibration buttons: ikona + tekst > pure icon**: subagent UI review proponował icon-only; w praktyce niejasne, użytkownik musi zgadywać. Kompromis: lucide ikona + skrócony tekst (`Surowo`/`Trafnie`/`Pobłażliwie` zamiast `Za surowo`/`Trafnie`/`Za pobłażliwie`).

---

## 2026-05-03 — M3 Phases 1–7 (DONE), Phase 8 IN PROGRESS, 9-11 PENDING

Started M3 (Polish & Mobile). Build still green at every commit. Stopped before Phase 8 to compact context. 7 commits on master.

### Phase 1 — Theme system (commit `6424bc7` + fix `7fef0b8`)
- `app/globals.css`: paired `:root` (light) + `[data-theme="dark"]` (dark) with semantic tokens (`--bg-canvas`, `--fg-primary`, `--accent`, etc.). Tailwind v4 `dark:` variant remapped via `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))` so existing `dark:*` classes react to the toggle.
- `lib/theme/provider.tsx`: own ThemeProvider (no next-themes dep). API: `useTheme() → { theme, resolvedTheme, setTheme, autoSwitchEnabled, setAutoSwitchEnabled }`. Persists to `localStorage["theme"]`. Inline `THEME_INIT_SCRIPT` runs before paint to avoid FOUC.
- Auto-switch (force dark 19:00–06:00) opt-in from `/settings`.
- `components/shared/theme-toggle.tsx`: 3-button radio group (Sun/Moon/Monitor).
- Mounted in `app/layout.tsx`. `<html suppressHydrationWarning>` because the init script legitimately mutates DOM before hydration.

### Phase 2 — PWA manifest + icons (commit `ace7bc6`)
- `public/icon.svg` source-of-truth (LL on emerald background, maskable safe zone).
- `sharp` (already a Next.js dep) generates: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180px), `favicon-32.png`, `favicon-16.png`.
- `public/manifest.json`: `display: "standalone"`, `start_url: "/dashboard"`, both PNG and SVG icon entries with `purpose: "any maskable"` on 512.
- `app/layout.tsx`: `metadata.manifest`, `metadata.icons`, `metadata.appleWebApp`, `viewport` with `viewportFit: "cover"` + per-mode `themeColor`.

### Phase 3 — Service worker + install prompt (commit `de5a1ed`)
- Skipped `@ducanh2912/next-pwa` after `npm audit` reported 5 high-severity transitive vulns. Wrote ~80-line vanilla SW (`public/sw.js`):
  - NetworkFirst with 5s timeout for `/api/*`, with cache fallback returning `503 offline`.
  - CacheFirst for `/_next/static/*`, manifest, icons.
  - NetworkFirst with cache + `/` fallback for navigation HTML.
  - Cache version bump on activate clears stale caches; SKIP_WAITING postMessage handler.
- `components/shared/sw-register.tsx`: client component, registers on window load, **no-op in dev** to avoid HMR collisions.
- `components/shared/install-prompt.tsx`: handles `beforeinstallprompt` (Chrome) + iOS Safari fallback ("Share → Add to Home Screen"). Dismissal sticky 30 days.

### Phase 4 — Mobile-first session UI (commit `dd3ee05`)
- All three session screens (`review`, `deep-dive/[material_id]`, `audit/[audit_id]`) restructured: `min-h-[100dvh]` flex column, top metadata strip, mid content card flex-1, bottom sticky action area with `pb-[calc(env(safe-area-inset-bottom)+1rem)]` for notch handling.
- Every tap target now `min-h-14` (56px). Existing keyboard shortcuts preserved.
- `components/sessions/answer-input.tsx`: wraps Textarea with `mode: 'text' | 'voice'` prop. Voice mode currently a disabled mic icon with tooltip — hook for future Web Speech API integration.

### Phase 5 — Hamburger drawer for mobile nav (commit `816451c`)
- `app/(app)/layout.tsx` restructured: extracted `NAV_ITEMS` constant, desktop nav `hidden md:flex`, sticky top header, `MobileNav` rendered <md.
- `components/shared/mobile-nav.tsx` uses `@radix-ui/react-dialog` (already installed via the umbrella `radix-ui` package, no new dep) as a side sheet. Lists routes vertically + theme toggle + sign-out.
- Skipped `tailwindcss-animate` (not installed); drawer pops without slide animation.

### Phase 6 — Offline IndexedDB queue + sync endpoint (commit `2c3879a`)
- Installed `idb` (~3KB).
- `lib/offline/db.ts`: stores `cached_sessions` and `pending_reviews` (indexed by session_id and sync_status). Schema v1.
- `lib/offline/queue.ts`: `queueReview()` writes to IDB; `flushQueue()` batch-sends to `/api/sessions/sync-offline`, deletes successes, leaves failures with `last_error`.
- `app/api/sessions/sync-offline/route.ts`: per-review processing — cloze does FSRS update + insert, open does Sonnet validate via `trackAICall` (sequential to play nice with rate limits). Returns `{ client_id, ok, error? }` per review.
- `components/shared/online-indicator.tsx`: pill badge showing online/offline + queued count, auto-flushes on `online` event. Mounted globally in `(app)/layout.tsx`.
- **Review (cloze) sessions** queue when offline AND fall back to queue on network errors mid-flight (rating never lost). **Deep-dive + audit** sessions show toast "Walidacja AI wymaga internetu" if offline (open answers need Sonnet, no offline path).

### Phase 7 — Realtime subscriptions (commit `09316a4`)
- Migration `0005_realtime.sql`: idempotent DO blocks adding `processing_jobs`, `materials`, `sessions` to `supabase_realtime` publication.
- `lib/realtime/subscriptions.ts`: `subscribeProcessingJob(jobId, onChange)` and `subscribeMaterials(userId, onChange)` helpers.
- `app/(app)/materials/import/page.tsx`: replaced 1.5s polling with Realtime subscription + 5s polling fallback (idempotent `handleJobUpdate`). Sub-second progress when Realtime works, graceful degradation otherwise.

### Manual steps for user (between phases 6 and 7)
- Apply migration `0005_realtime.sql` in Supabase SQL Editor (3 idempotent DO blocks). Without this, Realtime channels SUBSCRIBE but no postgres_changes events fire and the page falls back to 5s polling.

### Outstanding for M3
- **Phase 8** — Cross-device session guard (active-session check in `/api/sessions/start`) + Fresh Materials widget on `/dashboard` (24h-old materials with no review session yet) + `mode='voice'` adopted on AnswerInput. Voice hook is already in place from Phase 4.
- **Phase 9** — Error boundaries (`app/error.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`), Lighthouse run + fixes, `voyageai` removal from package.json (now using raw fetch).
- **Phase 10** — Visual polish (final reskin per user request: full token system in `tailwind.config.ts`, accent palette decision, shared component library `page-header`, `stat-tile`, `empty-state`, `severity-badge`, `section-card`, `loading-skeleton`, `confirm-button`, applied across all pages).
- **Phase 11** — Final QA against the 14-point verification list, docs, M3 closing commit.

### Build state
- `tsc --noEmit` clean
- `npm run build` green (33 routes after sync-offline endpoint)
- All seven M3 commits pushed to master

---

## 2026-05-02 — M2 Phase 1 + 6: Voyage embeddings + dedup + loop closure (DONE) — M2 COMPLETE

### Phase 1 — Voyage online
- Migration `0004_voyage.sql`: adds `materials.suggested_gap_id` FK, `knowledge_gaps.embedding vector(1024)` + ivfflat index, plus two RPCs `match_materials` and `match_gaps` (cosine similarity scoped to `auth.uid()`).
- Replaced `mockEmbedding` in `lib/processing/pipeline.ts` with real `embed()` via `trackAICall`.
- Voyage client rewritten as raw fetch (`lib/ai/voyage.ts`) — the `voyageai` npm SDK has broken ESM exports under Turbopack production builds. Lesson captured in `tasks/lessons.md`.
- Pipeline step 4 (dedup) now active: `match_materials` returns top-5 candidates ≥ 0.85; ≥ 0.92 → relation_type='merged'; 0.85-0.92 → 'related'. Both go into `material_relations`. Auto-merging the row was rejected as too destructive — we record the relation but keep both materials so the user can decide.
- Pipeline now embeds text passed to Voyage (raw text, capped server-side by parser at 200k chars; Voyage will tokenize). Cost ~$0.0001 per typical material.

### Phase 6 — Loop closure on import
- Each gap now gets embedded at creation time (`embed(title + tags joined)`) by `lib/gaps/runner.ts`. Failures are non-fatal (gap still stored, just won't surface in loop closure).
- Pipeline calls `match_gaps(0.80)` after embedding the new material. Best match (if any) is written to `materials.suggested_gap_id` and exposed in `processing_jobs.result.gap_candidate`.
- `app/(app)/materials/[id]/gap-link-banner.tsx` — emerald-bordered banner shows on the material detail page when `suggested_gap_id` is set. "Tak — zamknij lukę" flips the gap to status='addressed' (sets `addressed_by_material_id` + `addressed_at`); "Nie — odrzuć sugestię" just clears the suggestion.
- `app/api/materials/[id]/link-gap/route.ts` — handles confirm + dismiss, both clear `suggested_gap_id` so the banner stops showing.
- `app/api/dev/backfill-embeddings/route.ts` — re-embeds all of the user's materials (overwriting old stub vectors) and any gaps without embeddings. One-shot helper for the migration.

### Verification
- `npx tsc --noEmit` clean. `npm run build` green (32 routes). Real Voyage end-to-end test pending — user needs to apply migration `0004_voyage.sql` and run backfill.

### M2 status
**M2 COMPLETE.** All 9 phases shipped. Ready for general M2 verification + M3 planning.

---

## 2026-05-02 — M2 Phase 7: Quick + filtered search (DONE; semantic deferred)

- `GET /api/search` — text query (ILIKE on title + content_compressed) + composable filters (category / tag / status). 200ms-class on our scale; will be replaced by Postgres FTS + Voyage semantic in the same migration that adds the embeddings column.
- `app/(app)/search/page.tsx` server component pre-loads available tags from existing materials so the filter dropdown shows real options.
- `app/(app)/search/search-client.tsx` — debounced (250ms) input, three filter dropdowns (category / tag / status), match snippet with surrounding context, tag chips, link to material detail.
- Nav has 'Szukaj'. Build green (30 routes), tsc clean.

The semantic tier (`mode=semantic`) is a one-branch addition once Voyage embeddings are real. Index is already in place (`materials_embedding_idx` ivfflat).

This closes M2 work that's unblocked by Voyage. Outstanding M2 work: Phase 1 (Voyage embeddings + dedup) and Phase 6 (loop closure on import) — both blocked on the API key.

---

## 2026-05-02 — M2 Phase 9: Item editing + JSON export (DONE)

- `PATCH /api/items/[id]` — edit `question` and/or `answer_reference`. First edit copies the current question into `original_question`; subsequent edits only bump `edit_count`. Audit-only items are immutable (their `audit_id` is set, route rejects).
- `app/(app)/materials/[id]/item-list-client.tsx` — extracted client component. Hover-revealed "Edytuj" button per item; switches into a 2-textarea form with Save / Cancel; shows "edytowane Nx" badge for items with history.
- `app/(app)/materials/[id]/page.tsx` — now filters audit-only items out of the per-material listing (they were already filtered in queue queries; this matches).
- `GET /api/export/json` — full per-user dump: materials (without `embedding`), items, reviews, sessions, topic_audits, knowledge_gaps, calibration_offsets, usage_logs, material_relations. Strips `user_id` from every row. Sets `Content-Disposition: attachment; filename="learning-loop-export-YYYY-MM-DD.json"` so the browser downloads.
- `app/(app)/settings/export-client.tsx` + section in `/settings` — single button "Pobierz jako JSON" (uses native `<a href download>`).
- No new migration. Build green (29 routes), tsc clean.

This wraps M2 work that's unblocked by Voyage. Remaining: Phase 1 (real embeddings + dedup), Phase 6 (loop closure on import), Phase 7 (3-tier search — quick + filtered are still implementable, semantic blocked).

---

## 2026-05-02 — M2 Phase 8: Calibration offsets (DONE)

- `lib/calibration/aggregator.ts` — rolls up `reviews.user_calibration` per category into `calibration_offsets`. `current_offset = (lenient - strict) / max(total, MIN_SAMPLE)` capped to [-1,+1]. MIN_SAMPLE = 10 prevents one early data point swinging offset to ±1. `getCalibrationOffset()` returns 0 below 3 calibrations (sample too small).
- `lib/ai/prompts/validate-open.ts` — `buildValidateOpenSystemPrompt(category, offset)` now appends a calibration hint when |offset| ≥ 0.2 (be more lenient / be stricter).
- `app/api/sessions/[id]/answer/route.ts` — pulls offset before each Sonnet validation and passes it through `validateOpenAnswer`. Logged in usage_logs metadata for traceability.
- `app/api/calibration/aggregate/route.ts` — on-demand recompute. `app/api/cron/calibration/route.ts` — daily cron with pg_cron snippet inside.
- `app/(app)/settings/page.tsx` + `calibration-client.tsx` — table per category showing strict/lenient counts, total, offset, plain-Polish status (Skalibrowane / AI za surowe → łagodniej / itd.). Nav has 'Ustawienia'.
- No new migration (`calibration_offsets` table existed since 0001). Build green (27 routes), tsc clean.

The feedback loop closes itself now: user clicks "Za surowo" three times in finance → cron rolls it up → next finance Deep Dive Sonnet sees `offset = -0.3` and softens its rubric. The hint is added to the cached system prompt with the offset baked in — caching still works because each (category, offset-bucket) gets its own cache key.

---

## 2026-05-02 — M2 Phase 5: Claude.ai prompt generation (DONE)

- `lib/ai/prompts/generate-claude-prompt.ts` Sonnet system prompt — produces a ready-to-paste prompt matching CLAUDE.md template (3000-word PL/EN-tech report request, .docx output).
- `lib/ai/generate-claude-prompt.ts` Sonnet wrapper (no JSON, plain text output).
- `app/api/gaps/[id]/generate-prompt/route.ts` — picks dominant material category as "domain", resolves material UUIDs to titles for clearer AI input, persists result to `knowledge_gaps.generated_prompt`.
- `app/(app)/gaps/[id]/page.tsx` + `detail-client.tsx` — gap details with severity badge, tag chips, material list, "Wygeneruj prompt" → readonly textarea + "Skopiuj prompt" + "Otwórz Claude.ai" + "Wygeneruj ponownie" + "Odrzuć lukę".
- `/gaps` list now has "Szczegóły →" link per gap.
- No new migration. Build green (25 routes), tsc clean.

The user-facing loop is now: detect gaps → click into one → generate prompt → copy → paste into Claude.ai → get .docx → import into Learning Loop. The "import closes the gap automatically" piece (Phase 6) remains blocked on Voyage embeddings; for now closure is manual via the "Odrzuć" button or addressed_at can be set by hand.

---

## 2026-05-02 — M2 Phase 4: Knowledge gap detection (DONE)

- Migration `0003_gaps.sql` adds `knowledge_gaps.title` (Sonnet-generated PL title).
- `lib/gaps/detector.ts` — 4 rule-based detectors (low_correct_rate, stale_topic, rising_failures, never_consolidated). Pure SQL aggregates, no AI cost.
- `lib/ai/prompts/detect-gaps.ts` + `lib/ai/detect-gaps.ts` — Sonnet 4.6 ranker. Takes candidate list, picks max 8, assigns severity (low/medium/high), writes Polish title.
- `lib/gaps/runner.ts` — orchestrator. Dedupes against already-open gaps with overlapping tags or materials before insert (so weekly cron doesn't flood the list).
- `app/api/gaps/detect/route.ts` — on-demand button. `app/api/gaps/[id]/dismiss/route.ts` — user can mark false-positive. `app/api/cron/gaps/route.ts` — weekly heartbeat (Bearer-guarded, iterates users via service_role; pg_cron snippet inside the file).
- `app/(app)/gaps/page.tsx` + client component — severity-sorted list with red/amber/zinc badges, tag chips, "Wykryj luki teraz" + "Odrzuć" buttons.
- Dashboard now 6-tile (3 cols), `otwarte luki` highlighted, conditional CTA when > 0. Nav has 'Luki'.
- Build green (24 routes), tsc clean.

Verification: user needs to apply migration `0003_gaps.sql`, then click "Wykryj luki teraz" on /gaps. With minimal review history detectors may return 0 candidates — that's normal. Worth running again after a week of real usage.

---

## 2026-05-02 — M2 Phase 3: Leech rotation queue (DONE)

- `lib/db/leeches.ts` — `getLastLeechExposureAt`, `isLeechRotationDue` (≥7d since last leech review AND user has at least one leech), `pickLeechCandidates` (sorted by fsrs_due_date asc).
- `selectReviewItems` in `app/api/sessions/start/route.ts` now prepends up to 2 leeches at the front of the queue when rotation is due. Dedupes against items already in the queue.
- `is_leech` flows through API → client; subtle amber badge surfaces on the cloze in `/sessions/review` (with title attr explaining why).
- Build green (20 routes), tsc clean.

Verification still requires a leech in the DB (an item with `is_leech=true`). User can flip one manually via SQL Editor for testing: `update items set is_leech = true where id = '...';` — leech badge will appear next session.

---

## 2026-05-02 — M2 Phase 2: Topic audits execution (DONE)

### Context
M2 started. Phase 1 (real Voyage embeddings + dedup) is **blocked** — user couldn't issue a key from the Voyage console; troubleshooting in parallel. Pipeline keeps stub vector. Plan: skip Phase 1 + Phase 6 (loop closure) + semantic-search tier for now; ship the rest.

### Phase 2 (this session)
- Migration `0002_audits.sql`: `topic_audits.session_id` FK + `items.audit_id` FK (audit items don't pollute regular Deep Dive / Review pools), pg_cron install snippet kept commented for user to paste in SQL Editor.
- `lib/ai/prompts/generate-audit.ts` — Sonnet system prompt with per-category persona + per-trigger framing (day_7 = "anything left after a week", day_30 = "apply in new context", day_90 = "long-term retention", resurrection = "tempt user back").
- `lib/ai/generate-audit.ts` — Sonnet 4.6 wrapper, Zod-validated 3–5 fresh open questions, system prompt cached.
- `lib/audits/scheduler.ts` — `getDueAudits()` lists `pending` rows with `scheduled_for <= now()`; `prepareAudit()` is **idempotent** (re-uses items if already generated for the audit_id), pulls existing question texts so Sonnet avoids duplicates, persists items with `audit_id` set; `evaluationToScore()` maps correct/partial/incorrect → 1.0 / 0.5 / 0.
- `app/api/sessions/start/route.ts` — new `mode: 'audit'` branch; review + deep_dive both filter `audit_id is null`.
- `app/api/sessions/[id]/end/route.ts` — for audit sessions, computes mean evaluation score and flips audit to `completed` with `performance_score`.
- `app/(app)/sessions/audit/page.tsx` (list) + `[audit_id]/page.tsx` (run flow). Open-question UI mirrors deep-dive but final screen shows the % score.
- `app/api/cron/audits/route.ts` — Bearer-token heartbeat (does NOT pre-generate questions; generation stays lazy on click to avoid wasted spend if the user never runs the audit).
- `app/api/dev/force-audit-due/[material_id]/route.ts` — test helper to bypass the 7-day wait.
- Dashboard now shows `audyty due` tile with emerald border + conditional CTA when > 0; nav has 'Audyty' link.

### Verification
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- `npm run build` green (19/19 pages, includes new audit routes).
- End-to-end manual test pending — user needs to apply migration `0002_audits.sql` in Supabase and (optionally) install the pg_cron job from the snippet inside the migration file.

### Blockers
- VOYAGE_API_KEY (M2 Phase 1, 6, partial 7).

### Next session pickup
Phase 3 (leech rotation) is small and unblocked — propose starting there. Then Phase 4 (gap detection) and Phase 5 (prompt generation) both unblocked.

---

## 2026-05-01 — M1 COMPLETE (Phases 5, 6, 7 shipped)

### Phase 5 — Review session
- `lib/fsrs/scheduler.ts`: ts-fsrs wrap. `applyRating(itemState, rating, now)` returns next FSRS state to write back + leech detection (lapses ≥ 4 after 10+ reviews). `initialFsrsState()` puts new items in queue immediately (`fsrs_due_date = now`).
- `pipeline.ts` updated: cloze items spread `initialFsrsState()` at insert time so freshly-imported materials surface in next review session.
- `POST /api/sessions/start`: `mode: 'review'` returns due cloze items capped per CLAUDE.md (max 25 new cards/day). `mode: 'deep_dive'` returns open items for given material_id. Pre-loads everything (M3 offline contract).
- `POST /api/sessions/[id]/answer`: cloze branch updates FSRS state via applyRating + writes `reviews` row.
- `POST /api/sessions/[id]/end`: marks ended, recomputes items_completed.
- `/sessions/review`: cloze flashcard UI. Cloze text blanked on front (`______`), revealed on space/click, 4 rating buttons (Again/Hard/Good/Easy, keys 1-4). **Optimistic UI** — UI advances immediately on click, persistence fires in background, eliminating per-card lag user reported.
- `/api/dev/backfill-fsrs`: one-shot helper for items created before Phase 5 (sets `fsrs_due_date = now()` where null). User ran it once on 20 pre-existing cloze items.

### Phase 6 — Deep Dive
- `lib/ai/validate-open.ts`: Sonnet wrapper with `buildValidateOpenSystemPrompt(category)` (per-category persona) + Zod schema `{ evaluation, feedback_positive, feedback_negative }`. Cached system prompt.
- `POST /api/sessions/[id]/answer` open branch: validates user answer through trackAICall (operation: validate_open_answer). Persists `ai_evaluation`, both feedback fields, `validated_at`.
- `POST /api/sessions/[id]/calibrate`: stores `user_calibration` ('agree' / 'too_strict' / 'too_lenient') on the review row.
- `/sessions/deep-dive`: material selector showing only materials with at least one open question, plus per-material count.
- `/sessions/deep-dive/[material_id]`: question → textarea → Sonnet validates → feedback card (color-coded eval header + plusy/minusy with colored borders + collapsible "twoja odpowiedź / wzorzec") → 3-button calibration (selected state with emerald ring + checkmark) → "Następne pytanie".
- Material detail view now shows "Zacznij Deep Dive →" CTA.

### Phase 7 — Costs + dashboard polish
- `/costs`: 3 top tiles (today / month / month-end projection from daily run rate), 2 breakdown cards (per operation + per model with proportional bars), recent-calls table (10 newest with input/cache/output token counts and per-call cost), soft/hard limit banners that surface only when crossed.
- `/dashboard` rewritten: 4 tiles (due cards — highlighted with emerald border when > 0, materials, items, month cost), 4 CTAs (Review primary, Deep Dive, +New material, Materials).
- Nav: 'Koszty' added.

### Verification (full M1 loop tested by user)
| Step | Result |
|---|---|
| Magic Link login → /dashboard | works (Phase 2) |
| Import DOCX-style material via paste | works, ~30s, 4 AI ops (compress, auto-tag, generate-cloze, generate-open) |
| Material detail view | shows compressed content, tags, ~14 cloze + ~7 open |
| Review session: 5 cloze rated (4 Hard + 1 Good) | FSRS produced different stability/difficulty per rating, all persisted |
| Deep Dive: 3 open answers (correct + 2 incorrect) | Sonnet evaluations correct, calibration saved (correct+too_strict, incorrect+agree×2) |
| Cost tracking | usage_logs has 4-op-import + 3-call-deep-dive + smoke tests, total \$0.04 month-to-date |
| Costs page | renders breakdowns, projection, recent calls table |

### Lessons learned
- shadcn buttons need explicit `ring-2` class to show selected state — default `variant="default"` only changes background, not enough visual feedback. Captured in deep-dive page calibration buttons.
- New cloze items must have `fsrs_due_date = now()` to appear in review queue. Schema allows null (open questions don't use FSRS) but cloze inserts must set it explicitly. Initially missed → 0 due cards even after import. Fixed by spreading `initialFsrsState()` in pipeline.ts. Backfill endpoint provided for items created before the fix.
- Optimistic UI eliminates the per-card "lag" feel of waiting for FSRS+review insert (~500ms on localhost). Pattern: advance UI immediately, persist in background `void (async () => ...)()`, surface failures via toast (item stays in queue for next session).
- **Always `npm run build` before declaring a phase done.** Caught two issues at M1 close that dev mode ignored: (1) `useSearchParams` needs `<Suspense>` for static prerendering, (2) React 19's `react-hooks/purity` rule rejects `Date.now()` in `useState` initial value. Both fixed by extracting hook-using subtrees and using placeholder initial values. Lesson captured in tasks/lessons.md.

### Next session pickup
**M1 is complete.** Suggest fresh session for M2 planning. Next agent reads:
1. CLAUDE.md (full project source-of-truth)
2. tasks/todo.md (M2 candidates list at bottom)
3. tasks/lessons.md (everything learned so far)
4. This PROGRESS.md (what shipped and how)

Key M2 pickup task: replace mock Voyage embedding with real call once user provides VOYAGE_API_KEY. Marked TODO(voyage) in lib/processing/pipeline.ts.

---

## 2026-05-01 — Phase 4 Material import + processing pipeline (DONE)

### Completed
- `lib/processing/parse.ts`: DOCX (mammoth) / MD / TXT / pasted-text parser. 5 MB max, 100-200k char range for paste. Returns ParseResult with sourceType + filename + extracted text.
- `lib/processing/compress-and-tag.ts`: `compressMaterial(rawText)` → ~30% length via Haiku. `autoTagMaterial(compressed)` → 3-5 tags, Zod-validated JSON.
- `lib/processing/generate-items.ts`: `generateClozeCards()` (10-25 cards) and `generateOpenQuestions()` (5-12 questions), each with tolerant JSON parser (handles markdown fences) and Zod schemas. Returns items + token usage.
- `lib/processing/pipeline.ts`: `processMaterial(ctx)` 9-step orchestrator. Steps: parse (already done at API) → category (user-provided) → embed (MOCKED — TODO voyage) → dedup (skipped while mocked) → compress → auto-tag → insert material → generate cloze + insert items → generate open + insert items → schedule day_7/30/90 audits → mark material ready. Each AI step wrapped in trackAICall, each DB step has explicit error handling, failures mark job as `failed`.
- `app/api/materials/import/route.ts`: POST multipart endpoint. Validates form (Zod), parses file or pasted text, creates `processing_jobs` row, fires `processMaterial` async, returns `{ job_id }`.
- `app/api/jobs/[id]/route.ts`: GET endpoint returns job state (status, progress, error, result). Used by import page polling.
- `app/(app)/materials/import/page.tsx`: client form with two tabs (file / paste), category select, progress bar with stage labels, polling 1.5s, redirects to detail view on success.
- `app/(app)/materials/page.tsx`: list view sorted by imported_at desc, status badges (processing/ready/failed), tag chips, empty state CTA.
- `app/(app)/materials/[id]/page.tsx`: detail view — compressed content + tags + cloze list + open question list with answer references.
- `app/(app)/layout.tsx`: shared top nav with Dashboard/Materials/sign-out. Server-side auth guard.
- `app/layout.tsx`: Polish `lang="pl"`, default dark mode, Sonner `<Toaster />` mounted.
- Toasts wired in /login (callback errors, link-sent success) and /materials/import (start failure, completion success with counts, pipeline failure).
- `lib/db/types.ts`: hand-maintained TS types for all tables, plus `CATEGORIES` and `CATEGORY_LABELS` consts.

### Verification
- TS strict compiles clean.
- User imported a real material end-to-end. Pipeline produced compressed content, tags, ~10-20 cloze cards, ~5-8 open questions. Detail view rendered correctly. usage_logs got 4 new rows per import (compress_material, auto_tag_material, generate_cloze, generate_open).

### Lessons learned
- `npx supabase gen types typescript --project-id …` requires a separate access token (Supabase Personal Access Token, not the project anon/service keys). Decided to maintain `lib/db/types.ts` by hand for now — schema is small, stable, and adding another secret to the loop wasn't worth it.
- Voyage SDK's pricing is trivial (\$0.06/M tokens, ~no impact at our scale) but the dashboard for getting an API key was unresponsive on first try. Pipeline ships with a deterministic stub vector so M1 testing isn't blocked. Replace it before any dedup/semantic-search feature lands.

### Next session pickup (Phase 5 — Review session: cloze + FSRS)
1. `lib/fsrs/scheduler.ts` — wrap `ts-fsrs` with our config (request_retention 0.90, max_interval 365, fuzz on). Functions: `scheduleNew(item)`, `applyRating(item, rating, now)`, `getDueItems(userId, limit)`.
2. `app/api/sessions/start/route.ts` — mode 'review': returns due items (limit 25 new/day + reviews) pre-loaded.
3. `app/api/sessions/[id]/answer/route.ts` — mode 'review': stores review row, updates FSRS state on item.
4. `app/(app)/sessions/review/page.tsx` — cloze flashcard UI: front → reveal → 4 buttons (Again/Hard/Good/Easy). No AI validation needed for cloze (exact match).

---

## 2026-05-01 — Phase 3 AI layer + cost tracking (DONE)

### Completed
- `lib/ai/pricing.ts`: PRICING constants per-1M-tokens for Haiku 4.5, Sonnet 4.6, Voyage-3. `calculateCost()` accounts for cache reads (10x cheaper) and cache writes (1.25x normal). `COST_LIMITS` exposed: \$5 soft / \$8 hard / \$0.50 per-call.
- `lib/ai/operations.ts`: `OperationType` enum (compress, auto-tag, generate-cloze/open/feynman/scenario, validate-open/feynman/scenario, embed, detect-gaps, generate-claude-prompt, smoke-test, etc.). `isNonCritical()` whitelist used by limit gating.
- `lib/ai/errors.ts`: `CostLimitExceededError`, `AIProviderError`.
- `lib/ai/limits.ts`: `getMonthlyUsage`, `enforceMonthlyLimit` (pre-flight gate), `assertPerCallLimit` (post-flight).
- `lib/ai/track.ts`: **`trackAICall()` — only allowed entry point for AI calls.** Pre-flight: limit check. On success: insert row to `usage_logs` (tokens, cost, metadata, durationMs). On error: still insert log row with error in metadata, then re-throw. Per-call cap throws if a single call exceeded \$0.50.
- `lib/ai/anthropic.ts`: thin wrapper around `messages.create` with `cache_control: { type: "ephemeral" }` support. `ANTHROPIC_MODEL_IDS` maps short IDs to actual API strings.
- `lib/ai/voyage.ts`: `embed()` for voyage-3 single-input embeddings. Errors out clearly if `VOYAGE_API_KEY` missing.
- `lib/ai/prompts/`: 5 system prompts (compress, auto-tag, generate-cloze, generate-open, validate-open). All in Polish with English technical terms preserved. `validate-open.ts` exports `buildValidateOpenSystemPrompt(category)` with per-category persona.
- `app/api/dev/smoke-ai/route.ts`: dev-only auth-gated GET endpoint that calls Haiku once via trackAICall. Disabled in production via NODE_ENV check.

### Verification
- TS strict compiles with zero errors after small fix to Voyage SDK types (`response.usage?.totalTokens`, not `response.totalTokens`).
- Smoke test ran twice successfully. Both calls:
  - Reply: "Pong, 101." (Haiku correctly produced a prime > 100)
  - input_tokens: 51, output_tokens: 10, cached_input_tokens: 0
  - cost_usd: \$0.000101 (matches calculateCost() math: 51 \* \$1/M + 10 \* \$5/M)
  - Two rows visible in `usage_logs` ordered by created_at desc.

### Lessons learned
- Migration was applied to a different Supabase project than the one in `.env.local`. First smoke call returned `ok: true` but the insert silently failed (track.ts logs to console.error rather than throwing on log failure — by design, so a logger problem doesn't break user-facing code). Diagnosis: SQL Editor in correct project showed `relation "public.usage_logs" does not exist`. Fix: re-apply migration in correct project. Lesson captured in tasks/lessons.md (verify project URL matches `.env.local` before assuming migration succeeded).
- Dev server died silently after long auth-redirect-loop debugging session. Symptom: ERR_CONNECTION_REFUSED. Fix: `npm run dev` again. Captured in lessons.md.
- Voyage SDK v0.2.1 uses nested `response.usage?.totalTokens`, not flat `response.totalTokens` like older docs suggest.

### Next session pickup (Phase 4 — Material import + processing pipeline)
1. `app/(app)/materials/import/page.tsx` — 4 tabs (DOCX/MD/TXT/paste) + category select.
2. `app/api/materials/import/route.ts` — file upload, parse via `mammoth`, create processing_jobs row.
3. `lib/processing/pipeline.ts` — sequential 9-step processMaterial(jobId): parse → embed (Voyage, BLOCKER until key) → dedup (cosine sim) → compress (Haiku) → auto-tag → generate-cloze (10-20) → generate-open (5-8) → schedule audits → mark ready.
4. `app/(app)/materials/page.tsx` (list) + `app/(app)/materials/[id]/page.tsx` (detail).
5. Voyage key needed before step 3 of pipeline can run end-to-end.

---

## 2026-04-30 — Phase 2 DB + Auth (DONE)

### Completed
- Migration `supabase/migrations/0001_init.sql` written and applied to Supabase project: 10 tables (materials, items, reviews, sessions, topic_audits, knowledge_gaps, usage_logs, calibration_offsets, processing_jobs, material_relations), RLS policies on every table (`auth.uid() = user_id`), 11 performance indexes (ivfflat for embeddings, GIN FTS, hot-path composites), 3 extensions (vector, pg_cron, pgcrypto), shared `set_updated_at()` trigger
- `app/(auth)/login/page.tsx` — Magic Link form, Polish UI, error handling
- `app/auth/callback/route.ts` — PKCE code exchange path
- `app/auth/finish/page.tsx` — implicit-flow fallback (reads `#access_token` from hash, calls `setSession` client-side). Belt-and-suspenders: handles both Supabase email-link variants
- `app/(app)/dashboard/page.tsx` — protected page, server-action sign-out
- `app/page.tsx` — root redirect (authed → /dashboard, else → /login)
- Magic Link end-to-end verified: user signed in successfully on first try after the implicit-flow fallback was added

### Lessons learned
- Supabase email "Confirm signup" template uses an implicit-flow link (token in URL hash, never reaches server). Even with `@supabase/ssr` (which uses PKCE for `signInWithOtp`), Supabase may send the implicit variant for the first email-confirmation. Solution: server callback redirects no-code requests to a tiny client page (`/auth/finish`) that reads `window.location.hash` and calls `setSession`. Now both flows work transparently. Captured in `tasks/lessons.md`.
- `otp_expired` errors on first attempt were caused by mail client link-preview consuming the token. Subsequent fresh links worked.

### Next session pickup
1. Phase 3: AI layer + cost tracking. Files to create:
   - `lib/ai/pricing.ts`, `lib/ai/operations.ts`, `lib/ai/track.ts`, `lib/ai/limits.ts`
   - `lib/ai/anthropic.ts`, `lib/ai/voyage.ts`
   - `lib/ai/prompts/*.ts` (compress, auto-tag, generate-cloze, generate-open, validate-open)
   - `tools/smoke-ai.ts`
2. Voyage AI key still pending — Anthropic-only smoke test is fine for Phase 3 start.
3. Generate types: `npx supabase gen types typescript --project-id <id> > lib/db/database.types.ts` once we start querying tables.

---

## 2026-04-30 — Phase 1 Bootstrap (DONE)

### Completed
- Renamed project folder `Learning Loop/` → `learning-loop/` (npm naming rules)
- `create-next-app@latest` (Next 16.2.4, React 19.2, TS strict, Tailwind v4, ESLint, Turbopack, App Router, no src dir, alias `@/*`)
- Installed core deps: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `voyageai`, `ts-fsrs`, `mammoth`, `lucide-react`, `sonner`, `zod`, `date-fns`
- Installed shadcn runtime helpers: `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`
- shadcn/ui initialized (`components.json`, neutral base, "new-york" style) + 6 starter components: button, card, input, textarea, skeleton, dropdown-menu
- Created folder structure per CLAUDE.md: `lib/{ai,db,fsrs,processing,utils,supabase}`, `lib/ai/prompts`, `components/{materials,sessions,shared}`, `app/(auth)/{login,callback}`, `app/(app)/{dashboard,materials,sessions/{deep-dive,review},costs,settings}`, `app/api/{materials,sessions,ai,costs}`, `supabase/migrations`, `tasks`, `tools`
- `lib/utils.ts` — `cn()` helper
- `lib/supabase/{client,server,middleware}.ts` — SSR pattern (cookies handled correctly)
- `middleware.ts` (root) — auth gate redirecting unauthenticated to `/login` for `(app)/*` routes
- Merged `.gitignore` (our + Next.js defaults: `.vercel`, `*.pem`)
- `.env.local` populated by user with real keys (Supabase + Anthropic; Voyage pending)
- `tasks/todo.md`, `tasks/lessons.md` created
- Original CLAUDE.md (33KB project source-of-truth) preserved through bootstrap

### In progress
- Verifying dev server starts and dark mode works
- Preparing first git commit

### Blockers
- Voyage AI account creation deferred (their dashboard was unresponsive earlier today). Not a blocker until Phase 4 (material processing pipeline needs embeddings).

### Next session pickup
1. `npm run dev` — verify `/` renders without errors
2. First git commit: "bootstrap learning-loop scaffold"
3. Phase 1 checkpoint with user — get green light to start Phase 2 (DB + Auth)

### Known issues
- `npm audit` reports 2 moderate severity vulnerabilities in transitive deps. To inspect later — not urgent.
- `lucide-react` installed at v1.14.0. shadcn typically uses higher major versions; verify icon imports work during first UI work (Phase 5 onwards).

### Lessons learned (this session)
See `tasks/lessons.md` — bootstrap gotchas with `create-next-app` + shadcn captured there.

### Security incident — RESOLVED
Three rounds of API keys leaked into the conversation transcript via Claude Code's automatic `system-reminder` mechanism (which injects modified file contents regardless of `.gitignore`). All leaked keys revoked at source. Final solution: user toggled IDE-level "ignore file" on `.env.local`, which blocks the leak. Verified working with a "type garbage and save" smoke test before pasting real keys. Memory entry added: `feedback_secrets_handling.md`.
