# Learning Loop - Task Tracker

## Current State

**Phase 1 (Bootstrap) — IN PROGRESS**

Bootstrapped Next.js 16 (App Router, TypeScript strict, Tailwind v4, ESLint, Turbopack) with shadcn/ui and core dependencies. Folder structure laid out per CLAUDE.md. Supabase SSR clients stubbed. `.env.local` populated locally (git-ignored).

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

### Phase 2 — DB + Auth (NEXT)
- [ ] P1: `supabase/migrations/0001_init.sql` with all tables + RLS + indexes
- [ ] P1: Apply migration to Supabase project
- [ ] P1: `npx supabase gen types typescript` → `lib/db/database.types.ts`
- [ ] P1: `app/(auth)/login/page.tsx` (Magic Link form)
- [ ] P1: `app/(auth)/callback/route.ts`
- [ ] P1: Test RLS (anon query returns 0 rows)

### Phase 3 — AI layer + cost tracking
- [ ] P1: `lib/ai/pricing.ts`, `lib/ai/operations.ts`
- [ ] P1: `lib/ai/track.ts` (`trackAICall` wrapper)
- [ ] P1: `lib/ai/limits.ts` (soft/hard/per-call limits)
- [ ] P1: `lib/ai/anthropic.ts`, `lib/ai/voyage.ts` (clients)
- [ ] P1: `lib/ai/prompts/*.ts` (system prompts as constants)
- [ ] P2: `tools/smoke-ai.ts` (smoke test with usage_logs assertion)

### Phase 4 — Material import + processing pipeline
- [ ] P1: `app/(app)/materials/import/page.tsx`
- [ ] P1: `app/api/materials/import/route.ts`
- [ ] P1: `lib/processing/pipeline.ts` (9-step processMaterial)
- [ ] P1: `app/(app)/materials/page.tsx` (list view)
- [ ] P1: `app/(app)/materials/[id]/page.tsx` (detail view)

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
