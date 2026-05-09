# Learning Loop - Task Tracker

## Current State

**M1 — DONE. M2 — DONE. M3 Phases 1–10 DONE, Phase 11 PENDING.** Commit `37923f7` na masterze. Build green (41 routes), tsc clean. Zatrzymujemy się tu na test wizualny przed final close.

## M3 — Polish & Mobile (Phase 11 left)

### Phase 1 — Theme system (DONE)
### Phase 2 — PWA manifest + icons (DONE)
### Phase 3 — Service worker + install prompt (DONE)
### Phase 4 — Mobile-first session UI + AnswerInput (DONE)
### Phase 5 — Hamburger drawer mobile nav (DONE)
### Phase 6 — Offline IndexedDB queue + sync endpoint (DONE)
### Phase 7 — Realtime subscriptions for processing_jobs (DONE)
### Phase 8 — Cross-device guard + voice + fresh materials (DONE)
### Phase 9 — Error boundaries + voyageai removal (DONE)
### Phase 10 — Reading Room visual reskin (DONE)

### Phase 11 — Final QA + closing commit (PENDING)

**Automatyczne checks (zrobione przez Claude, 2026-05-09):**
- [x] **Tokens żywe**: 192 użycia `bg-canvas|text-fg|border-line|text-accent` w 56 plikach ✅; jedyne `text-white` to nakładki z opacity (`text-white/50` itd.) — celowe ✅
- [x] **Source Serif 4 + latin-ext**: `app/layout.tsx` importuje z `subsets: ["latin", "latin-ext"]`, weights 400/500/600 ✅
- [x] **Geist Mono**: importowany w `app/layout.tsx`, zmienna `--font-geist-mono` ustawiona ✅
- [x] **Session chromeless**: `review/layout.tsx` full-bleed (`min-h-screen bg-canvas`), `AppChrome` ukrywa się przez `isSessionRunPath()` ✅
- [x] **CostLimitBanner global**: `app/(app)/layout.tsx` przekazuje do `AppChrome` jako `banner` prop ✅
- [x] **Voice icon disabled**: `answer-input.tsx` renderuje `<button disabled>` z `aria-label="Voice input — w przygotowaniu"` gdy `mode="voice"`; obie sesje (deep-dive, audit) przekazują `mode="voice"` ✅
- [x] **Migration 0005**: plik `supabase/migrations/0005_realtime.sql` istnieje ✅
- [x] **Dark accent**: `#E8915E` w dark mode (nota: smoke test wspomina `#D97A47` — kolor był poprawiony w Phase 10; wizualnie podobny rdzawy odcień, wymaga weryfikacji wzrokowej)
- [x] **Nav**: TopNav ma 5 pozycji (Przegląd, Materiały, Sesje▾, Statystyki, Menu▾) — liczba zmieniła się w Phase 10; BottomNav ma 5 pozycji z `grid-cols-5`; aktywny stan: `bg-accent` underline ✅; Costs w podmenu "Menu" pod `/costs` (nie `/settings/costs`)

**Weryfikacja manualna (2026-05-09) — DONE:**
- [x] Paleta, fonty, nawigacja, sesje — OK
- [x] Dashboard hero, light/dark parity — OK
- [x] Mobile, cross-device, voice disabled — OK
- [x] Smoke test pełnej pętli: import DOCX → Realtime → Deep Dive → AI feedback → calibration → end → audyt scheduled — OK
- [x] Bugi znalezione i naprawione: file input UI + JSON parse error w generate-items.ts (unescaped control chars)
- [ ] Lighthouse — odłożone do Vercel deploy (localhost nie daje miarodajnych wyników)

**Po smoke teście:**
- [ ] Update `tasks/lessons.md` (jeśli pojawiły się dodatkowe gotchas)
- [ ] Update root `CLAUDE.md` jeśli decyzje zdywergowały (palette accent, font choices, brak `tailwind.config.ts` — Tailwind v4 nie używa go w tym projekcie, brak `tailwindcss-animate`, własny ThemeProvider)
- [ ] Final M3 commit "M3 Phase 11 — final QA + close"

**Manualne kroki użytkownika (wciąż wiszą):**
- [ ] Apply migration `0005_realtime.sql` w Supabase SQL Editor (3 idempotentne DO blocks dla `processing_jobs`/`materials`/`sessions`). Bez tego Realtime nie wystrzeli — fallback polling 5s zadziała, ale logika jest podpięta.
- [ ] Zweryfikować rdzawy akcent w dark mode na realnym ekranie (`#D97A47`); jeśli za jasny/ciemny → bumping w `app/globals.css`.

---

## Post-M3 Roadmap — co zostało do 100%

### P1 — Produkcja (blokuje wszystko inne)

- [ ] **Vercel deploy** — połącz repo z Vercel, ustaw env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, CRON_SECRET), zweryfikuj że build przechodzi na CI. Supabase → Auth → URL Configuration: dodaj `https://<app>.vercel.app` do Redirect URLs.
- [ ] **Lighthouse audit na produkcji** — po deployu: DevTools → Lighthouse → Mobile. Cel: ≥90 Performance / Accessibility / Best Practices / PWA. PWA: Application → Manifest → "Add to homescreen" powinno działać.
- [ ] **Sentry / error monitoring** — `npm install @sentry/nextjs`, `npx @sentry/wizard@latest -i nextjs`. Bez tego błędy produkcyjne są niewidoczne.

### P2 — Brakujące funkcje z placeholder UI (przyciski już są, brak backendu)

- [ ] **Tasuj** (`app/(app)/materials/[id]/page.tsx`) — przycisk placeholder. Backend: `POST /api/sessions/start` z `mode: 'review'` + `material_id` + `shuffle: true`. Wystarczy posortować wybrane items losowo przed zwróceniem z `selectReviewItems`.
- [ ] **Wygeneruj nowe** (`app/(app)/materials/[id]/page.tsx`) — przycisk placeholder. Backend: `POST /api/ai/generate-items` dla istniejącego `material_id`; odczytuje `content_compressed`, wywołuje `generateClozeCards` + `generateOpenQuestions`, wstawia nowe rows do `items`. Uważaj na duplikaty (opcjonalnie: Voyage similarity check przed insertem).
- [ ] **Edycja metadata materiału** — na detail view brak możliwości zmiany `title`, `category`, `tags`. PATCH `/api/materials/:id` już istnieje. Wystarczy dodać inline edit lub dialog (wzoruj się na `ItemEditDialog`).

### P3 — Rozszerzenia (nice to have, bez twardego deadline)

- [ ] **Dispute z AI** — API `POST /api/sessions/:id/dispute` już istnieje. Brakuje UI: po otrzymaniu AI feedback pokaż przycisk "Zakwestionuj" → mini-chat (max 5 tur) w sidepanelu lub modalu.
- [ ] **Bulk import** — `POST /api/materials/import-bulk` endpoint zaplanowany w CLAUDE.md, niezaimplementowany. UI: drag-drop wielu plików + per-file kategoria + queue progress.
- [ ] **URL import** — `POST /api/materials/import-url` endpoint zaplanowany, niezaimplementowany. Wymaga web scrapera (np. `cheerio` + `node-fetch`).
- [ ] **Web Speech API** — hook gotowy (`mode="voice"` prop na `AnswerInput`, przycisk disabled). Implementacja: `window.SpeechRecognition` z `interimResults: true`, transcript wstrzykiwany do `value`. Fallback: ukryj przycisk jeśli API niedostępne.
- [ ] **Cross-topic synthesis** — Sonnet generuje pytania łączące 2–3 materiały naraz. UI: multi-select materiałów na `/sessions/deep-dive`, nowy prompt w `lib/ai/prompts/`.
- [ ] **Feynman + scenario (pełna implementacja)** — typy istnieją w schemacie, ale generacja i UI traktuje je jak `open`. Feynman: pytanie "wyjaśnij to dziecku", ocena prostoty języka. Scenario: case study + decyzja.
- [ ] **Ghost mode** — 90-dniowe spot-checky na "mastered" materiałach (`fsrs_stability > 60`). Cron raz w tygodniu wylosowuje 3–5 itemów z pool, tworzy mini-sesję.

### Notatki do następnej sesji

- Zacząć od **P1 (Vercel deploy)** — bez tego Lighthouse, PWA install i Sentry nie działają.
- **Tasuj** i **Wygeneruj nowe** to P2 z najmniejszym nakładem (godzina każde) — dobre na start po deployu.
- Dispute UI można zrobić bez nowego API — wszystko już jest po stronie serwera.

Full loop tested end-to-end:
- Magic Link login → Supabase session
- Import (DOCX/MD/TXT/paste) → pipeline (compress, tag, generate cloze + open) → 10–20 fiszek + 5–8 pytań w bazie
- Review session: cloze with FSRS rating (Again/Hard/Good/Easy, 1-4 keys), optimistic UI
- Deep Dive: Sonnet validates open answers per category, 3-button calibration, all persisted
- Costs dashboard: today/month/projection + breakdown per op + per model + soft/hard limit banners
- Nav (Dashboard / Materiały / Review / Deep Dive / Koszty / Wyloguj) on every protected page
- Toasts on all key actions

Total spend in M1 testing so far: ~\$0.04. Soft limit \$5 nowhere near.

**Outstanding for full M1**: Voyage embeddings still mocked — pipeline accepts a deterministic stub vector (TODO(voyage) in lib/processing/pipeline.ts). When the user provides VOYAGE_API_KEY, swap in the real embed() call. Otherwise nothing in M1 *blocks* on this — dedup (currently skipped) and semantic search (M2 only) are the consumers.

### Files modified / created so far
- `package.json` — Next 16.2.4, React 19.2, all CLAUDE.md core deps installed
- `components/ui/*` — 6 starter shadcn components
- `lib/utils.ts` — `cn()` helper
- `lib/supabase/{client,server,middleware}.ts` — SSR pattern
- `middleware.ts` — auth gate for `(app)/*` routes
- `.gitignore`, `.env.local.example`, `.env.local`
- `CLAUDE.md` — full project source-of-truth (33KB), preserved through bootstrap
- `AGENTS.md` — Next.js bootstrap warning (kept)

### Blockers
- None right now.

### Next up (this session)
- [ ] Verify dev server starts (`npm run dev` → localhost:3000)
- [ ] Verify dark mode by default in shadcn theme
- [ ] First commit: bootstrap scaffold
- [ ] Phase 1 checkpoint: show working "/" + dark mode + TS clean

## Tasks

### Phase 1 — Bootstrap
- [x] `create-next-app` with TS / Tailwind / App Router / ESLint / Turbopack
- [x] Install core deps (Supabase, Anthropic, Voyage, ts-fsrs, mammoth, lucide, sonner, zod, date-fns)
- [x] shadcn/ui init + 6 components
- [x] Folder structure per CLAUDE.md
- [x] Supabase SSR clients
- [x] Root `middleware.ts`
- [ ] Verify `npm run dev` works
- [ ] First git commit

### Phase 2 — DB + Auth (DONE)
- [x] `supabase/migrations/0001_init.sql` with all tables + RLS + indexes
- [x] Apply migration to Supabase project (10 tables, all RLS-enabled)
- [x] `app/(auth)/login/page.tsx` (Magic Link form, PL UI)
- [x] `app/auth/callback/route.ts` (PKCE) + `app/auth/finish/page.tsx` (implicit fallback)
- [x] `app/(app)/dashboard/page.tsx` (protected, server-action sign-out)
- [x] Magic Link end-to-end verified — login → /dashboard renders user email
- [ ] P2: `npx supabase gen types typescript` → `lib/db/database.types.ts` (deferred to Phase 3 when we start querying tables from code)

### Phase 3 — AI layer + cost tracking (DONE)
- [x] `lib/ai/pricing.ts`, `lib/ai/operations.ts`, `lib/ai/errors.ts`
- [x] `lib/ai/track.ts` (`trackAICall` wrapper, mandatory entry point)
- [x] `lib/ai/limits.ts` (\$5 soft / \$8 hard / \$0.50 per call, isNonCritical gating)
- [x] `lib/ai/anthropic.ts` (cache_control ephemeral on system prompts)
- [x] `lib/ai/voyage.ts` (voyage-3, 1024 dims)
- [x] `lib/ai/prompts/{compress,auto-tag,generate-cloze,generate-open,validate-open}.ts` — PL with EN tech terms
- [x] `app/api/dev/smoke-ai/route.ts` — verified usage_logs row written end-to-end

### Phase 4 — Material import + processing pipeline (DONE)
- [x] `lib/processing/parse.ts` (DOCX/MD/TXT/paste, validation)
- [x] `lib/processing/compress-and-tag.ts` (Haiku)
- [x] `lib/processing/generate-items.ts` (Haiku, Zod-validated cloze + open)
- [x] `lib/processing/pipeline.ts` (9-step orchestrator, trackAICall on every step)
- [x] `app/api/materials/import/route.ts` (multipart, fire-and-forget pipeline)
- [x] `app/api/jobs/[id]/route.ts` (status polling)
- [x] `app/(app)/materials/import/page.tsx` (form + progress bar)
- [x] `app/(app)/materials/page.tsx` (list view)
- [x] `app/(app)/materials/[id]/page.tsx` (detail view)
- [x] `lib/db/types.ts` (hand-maintained TS types matching schema)
- [x] `app/(app)/layout.tsx` shared nav + `app/layout.tsx` Sonner Toaster + login/import toasts
- [ ] P3: replace mock embedding with real Voyage call once API key is provided (TODO(voyage) in pipeline.ts)

### Phase 5 — Review session (cloze + FSRS) (DONE)
- [x] `lib/fsrs/scheduler.ts` (ts-fsrs wrap with project config + leech rule)
- [x] `app/api/sessions/start/route.ts` (review + deep_dive modes, new-card daily cap)
- [x] `app/api/sessions/[id]/answer/route.ts` (cloze branch with FSRS update)
- [x] `app/api/sessions/[id]/end/route.ts`
- [x] `app/(app)/sessions/review/page.tsx` (optimistic UI, keyboard shortcuts)
- [x] `app/api/dev/backfill-fsrs/route.ts` (one-time helper)

### Phase 6 — Deep Dive session (open + AI validation) (DONE)
- [x] `lib/ai/validate-open.ts` (Sonnet wrapper + Zod schema)
- [x] `app/api/sessions/[id]/answer/route.ts` extended with open branch (Sonnet validation through trackAICall)
- [x] `app/api/sessions/[id]/calibrate/route.ts`
- [x] `app/(app)/sessions/deep-dive/page.tsx` (material selector)
- [x] `app/(app)/sessions/deep-dive/[material_id]/page.tsx` (Q → answer → AI feedback → calibration → next)
- [x] Calibration buttons show selected state (ring + check)

### Phase 7 — Cost dashboard + main dashboard (DONE)
- [x] `app/(app)/costs/page.tsx` (today / month / projection + breakdowns + recent calls + soft/hard banners)
- [x] `app/(app)/dashboard/page.tsx` rewritten with tiles (due cards highlighted, materials, items, month cost)
- [x] Nav 'Koszty' link
- [ ] P3 (deferred to M3): Theme toggle + auto-switch after 19:00 — currently dark-mode only via root `<html class="dark">`
- [x] Final M1 smoke verified end-to-end through real session

## M2 — Smart Layer (in progress)

### Phase 1 — Voyage embeddings + dedup (DONE)
- [x] Migration 0004 (RPCs + gaps embedding + materials.suggested_gap_id)
- [x] Real `embed()` in pipeline replacing mockEmbedding
- [x] Dedup writes `material_relations` rows (merged ≥0.92, related 0.85-0.92)
- [x] Voyage REST fetch (SDK rejected; ESM broken under Turbopack)
- [x] `/api/dev/backfill-embeddings` for existing materials + gaps

### Phase 2 — Topic audits execution (DONE)
- [x] Migration `0002_audits.sql`: `topic_audits.session_id`, `items.audit_id`, pg_cron install snippet for `audits-daily`
- [x] `lib/ai/prompts/generate-audit.ts` (Sonnet, per-trigger framing day_7 / day_30 / day_90 / resurrection)
- [x] `lib/ai/generate-audit.ts` Sonnet wrapper + Zod schema
- [x] `lib/audits/scheduler.ts` (`getDueAudits`, `prepareAudit` idempotent, `evaluationToScore` helper)
- [x] `app/api/sessions/start/route.ts` extended with `mode: 'audit'`; deep_dive + review now filter `audit_id is null` so audit items don't pollute regular pools
- [x] `app/api/sessions/[id]/end/route.ts` computes `performance_score` (mean of correct=1 / partial=0.5 / incorrect=0) and flips audit row to `completed`
- [x] `app/(app)/sessions/audit/page.tsx` (list of due audits) + `app/(app)/sessions/audit/[audit_id]/page.tsx` (run flow Q → AI feedback → next → final score)
- [x] `app/api/cron/audits/route.ts` (Bearer-guarded heartbeat; returns due counts per user — does NOT pre-generate questions, generation stays lazy on-click to avoid wasted spend)
- [x] `app/api/dev/force-audit-due/[material_id]/route.ts` (testing helper — sets day_7 audit to scheduled_for = now-1h)
- [x] Dashboard 5-tile grid with `audyty due` highlighted + conditional CTA
- [x] Nav 'Audyty' link

### Phase 3 — Leech rotation queue (DONE)
- [x] `lib/db/leeches.ts`: `isLeechRotationDue` (≥7d gap), `pickLeechCandidates`
- [x] `selectReviewItems` prepends up to 2 leeches when rotation is due
- [x] Amber "leech" badge with tooltip in `/sessions/review`

### Phase 4 — Knowledge gap detection (DONE)
- [x] Migration `0003_gaps.sql` — `knowledge_gaps.title`
- [x] `lib/gaps/detector.ts` — 4 rule-based detectors
- [x] `lib/ai/prompts/detect-gaps.ts` + `lib/ai/detect-gaps.ts` Sonnet ranker
- [x] `lib/gaps/runner.ts` orchestrator with dedup
- [x] `app/api/gaps/detect`, `app/api/gaps/[id]/dismiss`, `app/api/cron/gaps`
- [x] `/gaps` page + nav link + dashboard tile + CTA

### Phase 5 — Prompt generation for Claude.ai (DONE)
- [x] `lib/ai/prompts/generate-claude-prompt.ts` + `lib/ai/generate-claude-prompt.ts`
- [x] `app/api/gaps/[id]/generate-prompt/route.ts` (resolves domain + material titles)
- [x] `app/(app)/gaps/[id]/page.tsx` with Copy + Open Claude.ai + Regenerate + Dismiss

### Phase 6 — Loop closure on import (DONE)
- [x] Each new gap embedded at creation time (`runner.ts`)
- [x] Pipeline calls `match_gaps(0.80)` after material embed; best match → `materials.suggested_gap_id`
- [x] Banner on `/materials/[id]` with confirm (gap → 'addressed') / dismiss
- [x] `POST /api/materials/[id]/link-gap`
### Phase 7 — Search (DONE; semantic blocked on Voyage)
- [x] `GET /api/search` (ILIKE + category/tag/status filters; FTS + semantic land with the Voyage migration)
- [x] `/search` page with debounced input, 3 dropdowns, snippet excerpt
- [x] Nav 'Szukaj'
### Phase 8 — Calibration offsets (DONE)
- [x] `lib/calibration/aggregator.ts` (formula in [-1,+1], MIN_SAMPLE floor, idempotent upsert)
- [x] `validate-open` system prompt accepts offset and adds lenient/strict hint when |offset| ≥ 0.2
- [x] Answer route reads offset before each Sonnet call
- [x] `/api/calibration/aggregate` (on-demand) + `/api/cron/calibration` (daily)
- [x] `/settings` page with offsets table + recompute button + nav link
### Phase 9 — Item editing + JSON export (DONE)
- [x] `PATCH /api/items/[id]` (preserves `original_question` on first edit, blocks audit items)
- [x] Hover-reveal "Edytuj" button on `/materials/[id]` items + edit-count badge
- [x] `GET /api/export/json` (full user dump, no embeddings, strips user_id)
- [x] Export section in `/settings` with native download link

## M3 / out of scope of current milestone
- Dispute with AI (5-turn limit)
- Bulk import + URL import
- Feynman + scenario formats fully implemented
- Ghost mode, topic resurrection

## Out of scope for M1 (deferred to M2/M3)

PWA/offline, semantic search, gap detection, audits execution (we only schedule rows in M1), dispute, bulk import, URL import, cross-topic synthesis, mobile-optimized UI, Realtime UI updates, Batch API, leech detection, ghost mode, calibration offsets, voice input.
