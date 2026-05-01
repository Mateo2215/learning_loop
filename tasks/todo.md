# Learning Loop - Task Tracker

## Current State

**Phases 1-4 DONE.** **Phase 5 (Review session — cloze + FSRS) — NEXT.**

Full import pipeline runs end-to-end (parse → compress → tag → generate cloze + open → schedule audits → mark ready). User tested with real material, all 4 AI ops logged in usage_logs, items materialized in DB. Embeddings still mocked (Voyage key pending). Shared `(app)` layout with top nav and Sonner toasts in place.

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

### Phase 5 — Review session (cloze + FSRS)
- [ ] P1: `lib/fsrs/scheduler.ts`
- [ ] P1: `app/api/sessions/start/route.ts`
- [ ] P1: `app/api/sessions/[id]/answer/route.ts`
- [ ] P1: `app/(app)/sessions/review/page.tsx`

### Phase 6 — Deep Dive session (open + AI validation)
- [ ] P1: `lib/ai/prompts/validate-open.ts`
- [ ] P1: Deep Dive UI + answer endpoint with Sonnet validation
- [ ] P1: `app/api/sessions/[id]/calibrate/route.ts`

### Phase 7 — Cost dashboard + main dashboard
- [ ] P1: `app/(app)/costs/page.tsx`
- [ ] P1: `app/(app)/dashboard/page.tsx` (basic tiles)
- [ ] P2: Theme toggle + auto-switch after 19:00
- [ ] P1: M1 final smoke test (full loop)

## Out of scope for M1 (deferred to M2/M3)

PWA/offline, semantic search, gap detection, audits execution (we only schedule rows in M1), dispute, bulk import, URL import, cross-topic synthesis, mobile-optimized UI, Realtime UI updates, Batch API, leech detection, ghost mode, calibration offsets, voice input.
