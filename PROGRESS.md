# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

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
