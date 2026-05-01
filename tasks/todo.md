# Learning Loop - Task Tracker

## Current State

**M1 (Core Loop) — DONE.** All 7 phases shipped. Ready for M1 verification pass + M2 planning.

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

## M2 candidates (next)

When user is ready for M2 planning, top items per CLAUDE.md:
- Replace mock Voyage embedding with real call (unblocks dedup + semantic search)
- Topic audits execution (we already schedule day_7/30/90 rows, just need executor)
- Leech rotation queue (we set is_leech, need to actually surface them)
- Knowledge gap detection (weekly cron + on-demand)
- Prompt generation for Claude.ai with copy button
- Loop closure on import (similarity-match against open gaps)
- 3-tier search (quick / semantic / filtered)
- Calibration offsets aggregation (we collect data, need rollup + bias correction)
- Dispute with AI (5-turn limit)
- Item editing with version history
- Bulk import + URL import
- Feynman + scenario formats
- JSON export

## Out of scope for M1 (deferred to M2/M3)

PWA/offline, semantic search, gap detection, audits execution (we only schedule rows in M1), dispute, bulk import, URL import, cross-topic synthesis, mobile-optimized UI, Realtime UI updates, Batch API, leech detection, ghost mode, calibration offsets, voice input.
