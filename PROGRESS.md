# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

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
