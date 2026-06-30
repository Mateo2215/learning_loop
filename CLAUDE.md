# CLAUDE.md - Learning Loop

> Personal learning application that closes the gap between podcast consumption and validated knowledge retention. Built for one user with single-tenant architecture. **Read this file completely before starting any work on the project.**

---

## 🎯 Project North Star

**The problem we're solving**: The user consumes 3 NotebookLM podcasts daily during walks. There is no validation of comprehension and no spaced retrieval mechanism. Information evaporates.

**The solution**: Active recall + spaced repetition + AI validation + closed loop with Claude.ai for filling knowledge gaps.

**Success metric**: The user uses this app daily for 1 hour and their retention of consumed material improves measurably (being able to apply knowledge in work contexts months after initial exposure).

**Anti-goals** (things this app explicitly is NOT):
- Not a generic flashcard app (Anki exists)
- Not a content consumption platform (NotebookLM does that)
- Not multi-user / social / collaborative (single-tenant by design)
- Not a replacement for deep reading or human teachers

---

## 👤 User Context

The user is a finance professional transitioning toward AI-enabled finance roles. They have:
- Strong technical foundation (Next.js, Supabase, Python, Claude Code)
- Polish primary language, but uses English technical terms (e.g., "net working capital", not "kapitał obrotowy netto")
- Diverse learning interests: Finance, Programming, AI/ML, Soft skills, General
- Multi-device workflow: desktop for input, mobile for sessions, both for review

**Implication**: UI is Polish, but generated questions mix Polish prose with English technical terms. Code comments and commits in English.

---

## 🏗️ Architecture Decisions Record

### Why these technologies

**Next.js 16 (App Router) + TypeScript**: The user knows the stack. App Router because we need streaming, server actions, and clean API routes. TypeScript because the data model is complex enough that runtime bugs would be expensive. (Bootstrapped on 16.2.4 — the original plan said 15, but `create-next-app` shipped 16.)

**Supabase (Postgres + Auth + Realtime + pgvector)**: One service for four concerns. Realtime is critical for multi-device sync. pgvector is critical for semantic search and deduplication. Free tier covers our scale.

**Anthropic Claude (Haiku 4.5 + Sonnet 4.6)**: Two-model strategy is essential for cost control. Haiku for high-volume simple tasks (fiszki generation, simple validation). Sonnet for nuanced work (open question validation, gap detection, prompt generation). Never use Opus - cost/value not justified at our scale.

**Voyage AI (voyage-3) for embeddings**: Recommended by Anthropic, handles Polish + English well. ~$0.06 per 1M tokens. Trivial cost.

**Tailwind + shadcn/ui**: Speed of development, dark mode built-in, components are owned (not packaged) so we can modify freely.

**PWA via Workbox**: Offline mode is non-negotiable for walking sessions. Workbox handles service worker boilerplate.

### Why we did NOT choose

- **Pinecone/Weaviate** for vectors: pgvector in Supabase is enough at our scale, one less service to manage
- **OpenAI for embeddings**: $0.02 vs $0.06 difference is negligible, Voyage's Polish performance is better
- **Native mobile apps**: PWA covers 95% of needs at 5% of the effort
- **Separate auth service (Auth0, Clerk)**: Supabase Auth is sufficient, integrated with RLS
- **GraphQL**: REST + Supabase client SDK is simpler for solo development
- **Redis cache**: Premature optimization, Postgres handles our load fine

---

## 🗂️ Project Structure

> **As-built (2026-06-16).** This reflects the shipped tree, not the original design sketch. The filesystem is the source of truth — when in doubt, list the directory.

```
/learning-loop
├── /app                          # Next.js App Router
│   ├── /(auth)/login             # Magic-link login
│   ├── /auth                     # callback (route) + finish (page)
│   ├── /(app)                    # Main app (protected by middleware)
│   │   ├── /dashboard            # Home ("fresh materials" widget)
│   │   ├── /materials            # Library + /[id] detail + /import
│   │   ├── /sessions             # /deep-dive/[material_id], /review, /audit (+ /run)
│   │   ├── /search               # Single search surface (full-text + semantic)
│   │   ├── /gaps                 # Gap list + /[id] detail
│   │   ├── /costs                # Cost dashboard
│   │   ├── /stats                # Score summary
│   │   └── /settings             # Theme, calibration, export, danger-zone, /costs
│   └── /api                      # Route handlers (source of truth for the API)
│       ├── /materials/...        # import, [id], [id]/link-gap
│       ├── /sessions/...         # start, [id]/answer, [id]/calibrate, [id]/end, counts, sync-offline
│       ├── /gaps/...             # detect, [id]/generate-prompt, [id]/dismiss
│       ├── /items/[id]           # update + /history
│       ├── /ai/generate-items    # on-demand item (re)generation
│       ├── /cron/...             # audits, gaps, calibration (Vercel Cron)
│       ├── /export/json          # manual JSON export
│       ├── /user/...             # clear-data, delete-account
│       ├── /stats/score-summary  # dashboard stats
│       └── /dev/...              # local-only backfills + smoke-ai
├── /components                   # UI grouped by feature
│   ├── /ui                       # shadcn primitives
│   ├── /materials /sessions /dashboard /stats /shared
├── /lib                          # All server/domain logic
│   ├── /ai                       # Anthropic + Voyage clients, prompts/, track, pricing, operations, limits
│   ├── /processing               # Import pipeline (parse → compress → tag → embed → generate items)
│   ├── /sessions                 # Deep Dive selection, section-status (mastery gate), active-guard
│   ├── /audits                   # Adaptive audit scheduler + interval ladder (intervals.ts)
│   ├── /gaps                     # Knowledge-gap detector + runner
│   ├── /fsrs                     # Spaced repetition (ts-fsrs wrapper)
│   ├── /calibration              # Per-category AI bias aggregation
│   ├── /offline                  # IndexedDB store + offline answer queue
│   ├── /realtime                 # Supabase Realtime subscriptions
│   ├── /stats /nav /db           # Score summary, route helpers, DB queries + types
│   └── /supabase                 # client / server / middleware factories
├── /supabase/migrations          # SQL migrations (0001 → 0011) — schema source of truth
├── /public                       # PWA manifest, icons, hand-written service worker
├── /docs                         # plans/ + progress-archive.md
├── /tasks                        # todo.md (tactics) + lessons.md
└── CLAUDE.md                     # This file — read first
```

---

## 📐 Database Schema (Supabase / Postgres)

> **Source of truth: `supabase/migrations/0001 → 0011` and the hand-kept types in `lib/db/types.ts`** (updated in the same PR as any migration). The SQL below is the original `0001` conceptual model — read it for shape, but trust the migrations + types for exact columns. As-built deltas since `0001` are listed right after.

**All tables have**: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` with auto-update trigger.

**RLS enabled on all tables** with policy `auth.uid() = user_id`. Single-tenant but RLS is non-negotiable security baseline.

### As-built deltas since the 0001 sketch

- **`materials`**: + `deleted_at` (soft delete), `suggested_gap_id` (loop-closure candidate), `was_truncated` (0009 — compression hit the token cap).
- **`reviews`**: + `score smallint` 1–10 (0007 — the granular open-answer score; the FSRS `fsrs_rating` 1–4 is cloze-only), + `is_audit boolean` (0011 — isolates self-graded audit reviews from latest-score logic). `ai_evaluation` (3-state) still exists alongside `score`.
- **`items`**: + `audit_id` (nullable link to `topic_audits`; current audits reuse Deep Dive questions and leave it `null`).
- **`sessions`**: + `planned_item_ids uuid[]` (pre-loaded item list, supports offline + resume).
- **`topic_audits`**: + `audit_round int` (0010 — drives the interval ladder); `trigger` gained `'adaptive'`; one `pending` per material enforced by unique index. `performance_score` exists but the self-graded redesign scores per review, not via AI.
- **`calibration_offsets`**: + `score_offset numeric` (0007 — biases the 1–10 score, mirroring `current_offset` for the 3-state evaluation).
- **`knowledge_gaps`**: + `title`.

### Core tables (0001 conceptual model)

```sql
-- Materials (post-compression, no original content stored)
materials (
  id, user_id, title, 
  category text check (category in ('finanse','programowanie','ai_ml','soft_skills','ogolne')),
  content_compressed text,        -- ~30% of original, AI-summarized
  source_filename text,
  source_url text,
  source_type text,               -- 'docx', 'md', 'txt', 'paste', 'url'
  tags text[],
  embedding vector(1024),         -- Voyage-3 dimensions
  parent_material_id uuid,        -- if merged from another
  insight_note text,              -- "what surprised me"
  application_note text,          -- "when did I last use this"
  status text default 'processing', -- 'processing', 'ready', 'failed'
  imported_at timestamptz default now()
)

-- Auto-tagging via Voyage embedding similarity
material_relations (
  id, material_a_id, material_b_id,
  relation_type text, -- 'merged', 'related', 'addresses_gap'
  similarity_score numeric(4,3)
)

-- Generated learning items
items (
  id, user_id, material_id, type text, -- 'cloze', 'open', 'feynman', 'scenario'
  question text,
  answer_reference text,           -- "correct answer" reference for AI validation
  cloze_data jsonb,                -- for cloze: front/back/hints
  difficulty text,                 -- 'easy', 'medium', 'hard'
  category text,                   -- inherited from material
  tags text[],
  is_suspended boolean default false,
  is_leech boolean default false,
  -- FSRS state
  fsrs_stability numeric,
  fsrs_difficulty numeric,
  fsrs_due_date timestamptz,
  fsrs_last_review timestamptz,
  fsrs_review_count integer default 0,
  fsrs_lapse_count integer default 0,
  -- Edit history
  original_question text,          -- preserved on edit
  edit_count integer default 0
)

-- Review history (one row per answer, never deleted)
reviews (
  id, user_id, item_id, material_id,
  user_answer text,                -- for open/feynman/scenario
  ai_evaluation text,              -- 'correct', 'partially_correct', 'incorrect'
  ai_feedback_positive text,       -- "what was good"
  ai_feedback_negative text,       -- "what was missing"
  user_calibration text,           -- 'agree', 'too_strict', 'too_lenient'
  fsrs_rating integer,             -- 1=again, 2=hard, 3=good, 4=easy (for cloze)
  response_time_ms integer,
  is_offline_queued boolean default false,
  validated_at timestamptz         -- when AI validated (null if pending)
)

-- Sessions (group of reviews)
sessions (
  id, user_id, mode text, -- 'deep_dive', 'review', 'audit', 'gap_check'
  started_at timestamptz default now(),
  ended_at timestamptz,
  items_planned integer,
  items_completed integer,
  device text                      -- 'desktop', 'mobile'
)

-- Topic audits (scheduled deep checks)
topic_audits (
  id, user_id, material_id,
  scheduled_for timestamptz,
  trigger text, -- 'day_7', 'day_30', 'day_90', 'resurrection'
  status text default 'pending',   -- 'pending', 'completed', 'skipped'
  completed_at timestamptz,
  performance_score numeric(3,2)   -- 0.00 to 1.00
)

-- Knowledge gaps (computed weekly)
knowledge_gaps (
  id, user_id, 
  gap_type text,                   -- 'low_correct_rate', 'stale_topic', 'rising_failures'
  affected_tags text[],
  affected_materials uuid[],
  severity text,                   -- 'low', 'medium', 'high'
  detected_at timestamptz default now(),
  generated_prompt text,           -- ready-to-paste prompt for Claude.ai
  status text default 'open',      -- 'open', 'addressed', 'dismissed'
  addressed_by_material_id uuid,   -- material that fixed this gap
  addressed_at timestamptz
)

-- Cost tracking (one row per AI API call)
usage_logs (
  id, user_id, created_at,
  operation_type text,             -- see operation types in /lib/ai/operations.ts
  model text,                      -- 'claude-haiku-4-5', 'claude-sonnet-4-6', 'voyage-3'
  input_tokens integer,
  output_tokens integer,
  cached_input_tokens integer default 0,
  cost_usd numeric(10,6),
  material_id uuid,
  session_id uuid,
  metadata jsonb                   -- arbitrary context
)

-- Calibration data (per-category AI bias)
calibration_offsets (
  user_id, category text,
  too_strict_count integer default 0,
  too_lenient_count integer default 0,
  total_validations integer default 0,
  current_offset numeric(3,2) default 0.0,
  primary key (user_id, category)
)

-- Background processing jobs
processing_jobs (
  id, user_id, job_type text,      -- 'import', 'generate_items', 'compute_gaps'
  status text default 'pending',
  progress integer default 0,      -- 0-100
  payload jsonb,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz
)
```

### Indexes (critical for performance)

```sql
create index materials_embedding_idx on materials using ivfflat (embedding vector_cosine_ops);
create index materials_user_status_idx on materials (user_id, status, imported_at desc);
create index items_user_due_idx on items (user_id, fsrs_due_date) where is_suspended = false;
create index reviews_item_created_idx on reviews (item_id, created_at desc);
create index usage_logs_user_date_idx on usage_logs (user_id, created_at desc);
create index materials_fts_idx on materials using gin(to_tsvector('simple', title || ' ' || content_compressed));
```

---

## 🔌 API Endpoints

> **The filesystem under `app/api/**/route.ts` is the source of truth.** This is a domain map of what's shipped, not a copy of request/response shapes (those drift — read the handler). To list routes: `git ls-files 'app/api/**/route.ts'`. All routes require an authenticated Supabase user (enforced in middleware + RLS).

As-built domains (2026-06-16):

- **`materials/`** — `import` (POST, returns a job; processing is async), `[id]` (GET/PATCH/DELETE soft-delete), `[id]/link-gap`.
- **`sessions/`** — `start`, `[id]/answer` (open answers validated by Sonnet here), `[id]/calibrate`, `[id]/end` (audit scoring + mastery-gate scheduling happen here), `counts`, `sync-offline`. *No dispute route — disputes are not built.*
- **`gaps/`** — `detect`, `[id]/generate-prompt`, `[id]/dismiss`.
- **`items/[id]`** — PATCH (edit, preserves `original_question`) + `history`.
- **`ai/generate-items`** — on-demand (re)generation of items for a material.
- **`calibration/aggregate`** — roll up per-category AI bias offsets.
- **`cron/`** — `audits`, `gaps`, `calibration` (Vercel Cron entrypoints).
- **`export/json`**, **`stats/score-summary`**, **`user/{clear-data,delete-account}`**.
- **`search`** — a single `GET /api/search` (full-text + semantic), not the old quick/semantic/filtered trio.
- **`dev/`** — local-only helpers (`backfill-embeddings`, `backfill-fsrs`, `force-audit-due/[material_id]`, `smoke-ai`).

**Costs** are rendered server-side (`/costs`, `/settings/costs` pages reading `lib/ai/*` + `usage_logs`) — there are no `/api/costs/*` endpoints. **Realtime** uses the Supabase client directly (no custom endpoints): subscribe to `materials` (status), `processing_jobs` (progress), `sessions`/`items` (cross-device).

---

## 🤖 AI Strategy: Model Selection

**Rule**: Default to Haiku. Use Sonnet only when justified.

| Operation | Model | Why |
|---|---|---|
| Generate cloze flashcards | **Sonnet 4.6** | Quality decision (commit 3c5e9c8) — Haiku produced low-value cards; cost still acceptable at our scale |
| Generate open questions | Haiku | Simple structured output, list of questions |
| Auto-tag material | Haiku | Classification task |
| Compress material | Haiku | Summarization |
| Validate cloze answer | (none, exact match) | No AI needed |
| Validate open answer | Sonnet | Nuance, calibration |
| Validate Feynman explanation | Sonnet | Deep semantic understanding |
| Validate scenario answer | Sonnet | Multi-step reasoning |
| Dispute resolution | Sonnet | Argumentation |
| Detect knowledge gaps | Sonnet | Pattern recognition across data |
| Generate Claude.ai prompt | Sonnet | Structured creative writing |
| Cross-topic synthesis | Sonnet | Multi-context reasoning |

> **Audits use NO AI.** Topic audits reuse existing open questions and the user self-grades (1–4 → score). The old "generate audit questions via Sonnet" path was removed in the 2026-06-15 redesign. See "Topic Audits — self-graded recall" below.
>
> **Not yet wired (design intent only):** Feynman & scenario generation/validation, dispute resolution, cross-topic synthesis. Their operation-type enums exist in `lib/ai/operations.ts`, but no generator/route is built. Treat rows above for those as intent, not shipped behaviour.

### Prompt caching

**Cache the system prompt for every recurring operation type**. System prompts for "validate open answer in finance category" are reused across thousands of calls. Use `cache_control: { type: "ephemeral" }` on the system prompt block.

Expected savings: 70-90% on input token costs after first call within 5-minute window.

### Batch API for bulk imports (NOT built — design intent)

Bulk import and Batch-API routing were never shipped — imports are one material at a time through the synchronous API. Kept as the intended approach if bulk import is built later: when a batch has >5 materials, route generation jobs through the Batch API (50% cheaper, 24h SLA acceptable); single imports stay synchronous for fast feedback.

---

## 💸 Cost Monitoring (Critical)

**Every AI call MUST be logged**. No exceptions. Pattern:

```typescript
// /lib/ai/track.ts
export async function trackAICall<T>(params: {
  operation: string;
  model: string;
  materialId?: string;
  sessionId?: string;
  call: () => Promise<{ result: T; usage: TokenUsage }>;
}) {
  const start = Date.now();
  try {
    const { result, usage } = await params.call();
    await logUsage({
      operation_type: params.operation,
      model: params.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached_input_tokens: usage.cache_read_input_tokens || 0,
      cost_usd: calculateCost(params.model, usage),
      material_id: params.materialId,
      session_id: params.sessionId,
      metadata: { duration_ms: Date.now() - start }
    });
    return result;
  } catch (error) {
    // Log failed calls too
    await logUsage({ /* with error metadata */ });
    throw error;
  }
}
```

### Pricing constants (verify monthly)

```typescript
// /lib/ai/pricing.ts - update from https://docs.claude.com/en/docs/about-claude/pricing
export const PRICING = {
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00,  cache_read: 0.10 },  // per 1M tokens
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00, cache_read: 0.30 },
  'voyage-3':          { input: 0.06,  output: 0,     cache_read: 0 },
};
```

### Cost limits

- **Soft limit**: $5/month - UI shows warning banner, but operations continue
- **Hard limit**: $8/month - non-critical operations blocked (gap detection, audits, cross-topic synthesis). Critical operations (current session validation) still work.
- **Per-operation cap**: $0.50 - if a single API call would cost more, abort with error. Safety net against bugs (infinite loops, runaway prompts).

Implement check before each call:

```typescript
const monthlyTotal = await getMonthlyUsage();
if (monthlyTotal >= HARD_LIMIT && isNonCritical(operation)) {
  throw new CostLimitExceededError();
}
```

---

## 🎓 Deep Dive — brama zaliczania materiału

Logika w `lib/sessions/section-status.ts` (`computeSectionStatus`, czysta funkcja — jedyne źródło prawdy; konsumenci: selektor Deep Dive, preview, `scheduleFirstAuditIfMastered`).

**Reguła zaliczenia (status `done`)**: WSZYSTKIE pytania otwarte odpowiedziane ORAZ żadne poniżej **podłogi 6**. Średnia jest tylko informacją — NIE bramkuje.
- `SECTION_FLOOR_THRESHOLD = 6` — twarda podłoga. Pytanie <6 → `needs_followup`. Szóstka (≥6) jest akceptowalna.
- Statusy sekcji: `fresh` (nic ocenione) → `in_progress` (część) → `needs_followup` (wszystko ocenione, jakieś <6) → `done` (wszystko ocenione, żadne <6).

**Kolejka Deep Dive musi być spójna z podłogą:** `selectDeepDiveItems` (`app/api/sessions/start/route.ts`) i licznik `countUnmasteredOpen` (`lib/db/counts.ts`) serwują/liczą TYLKO pytania <6 i świeże (nieodpowiedziane). Szóstki nie wracają do powtórki. Dlatego brama nie może wymagać średniej ≥7 — inaczej materiał z samymi ≥6 i śr <7 utknąłby (nic do zaserwowania). Te trzy miejsca (brama, kolejka, licznik) zmieniaj razem.

**Próg pojedynczego pytania (display) zostaje na 7:** `MASTERY_SCORE_THRESHOLD = 7` — „opanowane" vs „słabe" w pasku postępu + leech detection. Niezależny od bramy i kolejki.

`AUDIT_GOOD_SCORE = 7` (drabina interwałów audytu) jest niezależny od bramy zaliczania.

## 🔁 Topic Audits — self-graded recall (redesigned 2026-06-15)

Re-checks already-mastered material on an adaptive schedule, at **zero AI cost**. Orchestration in `lib/audits/scheduler.ts`; pure interval math in `lib/audits/intervals.ts`; scoring + status transitions on session close in `app/api/sessions/[id]/end`.

- **No AI, no new questions.** An audit reuses the material's existing open questions. `prepareAudit` picks `AUDIT_QUESTIONS_PER_MATERIAL = 2` per material, rotating oldest-reviewed first (tie → lowest last score); questions without `answer_reference` are skipped. No items are inserted.
- **Self-grade.** The user rates recall on 4 levels (Pustka / Mgliście / Wyraźnie / Krystalicznie = 1–4), mapped to a 1–10 score. No AI evaluation, no `performance_score` from a model.
- **Isolation via `reviews.is_audit = true`** (migration 0011). Audit reviews must NOT pollute the "latest score of an open question" consumed by the mastery gate, the Deep Dive queue, and gap detectors — every such reader filters `is_audit = false`.
- **Lifecycle — at most one `pending` audit per material** (DB unique index `topic_audits_one_pending_per_material`):
  - *First audit:* +7 days once a material reaches mastery (`scheduleFirstAuditIfMastered`, on Deep Dive session end). `enrollMasteredMaterials` backfills the queue when you open the Audits page (spread +1..+7 days), so it doesn't depend on perfect session timing.
  - *Next audit:* `scheduleNextAudit` after each completed audit, interval from the ladder.
- **Adaptive interval ladder** (`AUDIT_INTERVAL_LADDER = [7, 21, 60, 150, 365]` days). Per audited-question score: ≥7 (`AUDIT_GOOD_SCORE`) → climb a rung (longer); ≤3 (`AUDIT_POOR_SCORE`) → drop a rung (sooner); 4–6 → stay. Floor = 7 days.
- **Session shape.** Consolidates up to `AUDIT_SESSION_SIZE = 3` materials. `getDueAudits` lists `pending` audits with `scheduled_for <= now()`, oldest first.
- **Triggers.** New audits use `trigger = 'adaptive'`; legacy `day_7/day_30/day_90/resurrection` values survive only on historical rows.

## 🧠 FSRS Algorithm

Use library `ts-fsrs` (npm package, well-maintained). Don't implement from scratch.

**Configuration for the user**:
```typescript
const fsrsParams = {
  request_retention: 0.90,    // target 90% retention
  maximum_interval: 365,       // cap at 1 year
  enable_fuzz: true,           // randomize intervals slightly
  weights: undefined,          // use defaults, FSRS will adapt
};
```

**Daily new card limit**: 25 (configurable in settings). Items past limit go to buffer (don't appear in due queue).

**Leech detection**: Item with 4+ failures in last 10 reviews → set `is_leech = true`. Don't suspend - put in rotation queue, force 1-2 leeches per session every 7 days.

**Soft reset after gap**: If user hasn't reviewed in >2 days, on return show only top 20 most critical items (sorted by `fsrs_difficulty * days_overdue`), skip the rest with a "you missed X reviews" notification.

---

## 📦 Material Processing Pipeline

Implemented in `lib/processing/pipeline.ts` (`processMaterial`). Async background flow per `processing_jobs` row, writing `progress` as it advances:

```
1. Parse source        → done at the API boundary; raw text arrives in payload.raw_text
2. Category            → trusted from the import form (no AI category detection wired)
3. Embedding           → Voyage-3 (1024 dims) over the raw text                    [progress 15]
4. Duplicate check     → RPC match_materials (cosine), cutoff 0.85
                         - ≥0.92 → record a 'merged' relation, but KEEP BOTH (no destructive auto-merge)
                         - 0.85–0.92 → record a 'related' soft link
                         - <0.85 → ignore
                         (+ loop closure: RPC match_gaps → store materials.suggested_gap_id if a hit)  [progress 20]
5. Compress            → Haiku, ~30% length; sets was_truncated if output hit the token cap  [progress 30]
6. Auto-tag            → Haiku, 3–5 tags                                            [progress 45]
   → material row inserted here (status 'processing') so items can FK to it          [progress 55]
7a. Cloze cards        → Sonnet 4.6 (quality decision), low-value cards filtered out  [progress 75]
7b. Open questions     → Haiku                                                       [progress 90]
8. Audits              → NOT scheduled at import. Adaptive audits start only AFTER a
                         material is mastered — see lib/audits + sessions/[id]/end.
9. Mark 'ready'        → triggers a Realtime UPDATE to the client                    [progress 100]
```

**Only two item types are generated: cloze (Sonnet) and open (Haiku).** Feynman/scenario exist as `ItemType`/operation-type enums but no generator is wired for them.

**No per-step retry.** Any step that throws marks the material `failed` and the job `failed` (with the error), then re-throws. There is no automatic backoff/retry — re-import to retry.

**Job status visible in UI** via Realtime subscription on the `processing_jobs` table.

---

## 📱 Mobile-First Session UI

The session UI is the **most important** UX surface. The user uses it during/after walks. Optimize ruthlessly.

### Layout principles

- Question takes top 30% of viewport
- Answer input takes middle 50%, autoresize, comfortable padding (16px+)
- Submit button takes bottom 20%, minimum 56px height (thumb-comfortable)
- Single-handed operation: all primary actions in bottom 60% of screen
- No distracting progress bars during answering
- Progress shown only between questions and on session summary

### Offline mode behavior

```
Session start (online):
  - Pre-fetch ALL items, contexts, expected_answers into IndexedDB
  - Display "X items ready offline" indicator

During session (online or offline):
  - User answers stored in IndexedDB immediately
  - For cloze: instant rating (1-4) stored locally, FSRS update queued
  - For open: answer queued for validation (server roundtrip if online, deferred if offline)

Session end:
  - If offline: show "X answers queued, will validate when online"
  - If online: batch validate any queued answers, show all feedback at once
  - Sync FSRS state via /api/sessions/sync-offline
```

### "Fresh materials" widget (home screen)

Top of home screen, **always visible on mobile**:
```
┌────────────────────────────────────────┐
│ 🎧 Świeży materiał (po podcaście?)     │
│                                         │
│ • Wprowadzenie do MCP                   │
│   45 min temu • 12 pytań                │
│   [Zacznij Deep Dive →]                 │
│                                         │
│ • FSRS w praktyce                       │
│   3h temu • 8 pytań                     │
│   [Zacznij Deep Dive →]                 │
└────────────────────────────────────────┘
```

Logic: any material with `imported_at > now() - 24h` AND no review session yet appears here. One-tap launch.

---

## 🌍 Multi-Device Sync (Supabase Realtime)

**Subscribe to these channels on app load**:

```typescript
// Material status updates (processing → ready)
supabase.channel('materials')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materials',
       filter: `user_id=eq.${userId}` }, handleMaterialUpdate)
  .subscribe();

// Processing job progress
supabase.channel('jobs')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'processing_jobs',
       filter: `user_id=eq.${userId}` }, handleJobUpdate)
  .subscribe();

// Cross-device session state (for resume)
supabase.channel('sessions')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions',
       filter: `user_id=eq.${userId}` }, handleSessionUpdate)
  .subscribe();
```

**Conflict resolution**: last-write-wins for material edits. For session state, server is source of truth (don't allow concurrent sessions across devices - if user starts session on mobile while desktop session is active, prompt to close desktop first).

---

## 🔍 Knowledge Gap Detection

Run weekly (cron via Vercel Cron or Supabase pg_cron). On-demand button also available.

### Gap types and thresholds

```typescript
type GapType = 
  | 'low_correct_rate'    // tag with correct_rate < 60% over last 20 reviews
  | 'stale_topic'         // material not reviewed in 30+ days, was active before
  | 'rising_failures'     // increasing failure rate over last 10 reviews
  | 'never_consolidated'  // 4+ reviews on same item, never reached "good" 3 times in a row
```

### Prompt generation for Claude.ai

When gap detected, generate ready-to-paste prompt. Template structure:

```
Stwórz szczegółowy raport edukacyjny w języku polskim na temat: {TOPIC}.

Kontekst luki w mojej wiedzy:
{SPECIFIC_GAPS_DESCRIBED}

Skup się szczególnie na:
1. {SUBTOPIC_1}
2. {SUBTOPIC_2}
3. {SUBTOPIC_3}

Format raportu:
- Długość: ok. 3000 słów
- Język: polski z angielskimi terminami technicznymi (np. "net working capital" zamiast "kapitał obrotowy netto")
- Konkretne przykłady i analogie
- Zakładaj średnio-zaawansowany poziom (znam podstawy {DOMAIN})
- Output: Word document (.docx)
```

UI: button "Skopiuj prompt" + button "Otwórz Claude.ai" (opens new tab to claude.ai).

### Loop closure

When user imports material after using prompt:
- Check embedding similarity to open knowledge_gaps
- If >0.80 with any open gap → suggest linking: "Czy ten materiał adresuje lukę X?"
- On confirmation: set `gap.status = 'addressed'`, `gap.addressed_by_material_id`, `gap.addressed_at`
- Future audits in addressed area: track if performance improves

---

## 🎨 UI Conventions

### Theme

- Default: dark mode
- Auto-switch to dark mode after 19:00 local time (configurable)
- Light mode and system preference also available
- Use shadcn theme tokens, never hardcode colors

### Polish language conventions

- All UI labels in Polish
- Use formal "Twoja wiedza" not informal "Twoja wiedzy"
- Technical terms: keep English when commonly used in industry (commit, pull request, embedding, prompt, etc.)
- Date formatting: Polish locale (`pl-PL`), e.g., "29 kwiecień 2026" not "April 29, 2026"
- Numbers: Polish locale (space as thousand separator, comma as decimal)

### Component patterns

- Use shadcn components as base, customize via Tailwind
- Lucide icons (already in shadcn)
- Toast notifications for async events (sonner library, included in shadcn)
- Loading states: skeleton components, never spinners on full page
- Empty states: always have a CTA (e.g., "Brak materiałów. Zaimportuj pierwszy →")

---

## 🔐 Security & Privacy

- RLS enabled on every table, policy `auth.uid() = user_id`
- Anthropic API key stored in Vercel environment variables, never client-side
- Voyage API key same
- No analytics, no tracking, no third-party scripts
- User content: original material content NOT stored (only compressed version)
- Database backups: rely on Supabase daily backups + manual JSON export

---

## 🚀 Implementation Milestones

> **As-built status (2026-06-16): all three milestones are complete and the app is deployed (Vercel + Supabase) and in daily use, including mobile.** The checklists below are the *original plan* kept for historical reference — the unchecked `[ ]` boxes reflect the planning document, not outstanding work. For what is genuinely still open (optional / nice-to-have), see `tasks/todo.md`.

**Critical**: Build full architecture in CLAUDE.md (this file). Implement in 3 milestones, each producing working end-to-end code for its scope. Between milestones, app must be functional for the use cases covered.

### Milestone 1: Core Loop (target: weekend 1)

**Goal**: User can import material and do basic Deep Dive + Review sessions.

- [ ] Project bootstrap: Next.js + Supabase + Tailwind + shadcn
- [ ] Auth: Magic Link with Supabase
- [ ] Database: all tables + RLS policies + indexes
- [ ] Material import: DOCX, MD, TXT, paste (no URL yet, no bulk)
- [ ] Processing pipeline: parse → embed → compress → tag → generate items
- [ ] Cost tracking: usage_logs + tracking wrapper around all AI calls
- [ ] Cost dashboard (basic)
- [ ] Session: Deep Dive (open questions only) with AI validation
- [ ] Session: Review (cloze flashcards) with FSRS
- [ ] Calibration: 3-button feedback after AI validation
- [ ] Dark mode (default + light + system)
- [ ] Materials list view + filtering by category

**Out of scope for M1**: PWA/offline, semantic search, gap detection, audits, dispute, bulk import, URL import, cross-topic synthesis, mobile-optimized UI.

### Milestone 2: Smart Layer (target: weekend 2)

**Goal**: Full intelligence features. App becomes proactive partner.

- [ ] Topic audits: scheduling + execution (day 7/30/90)
- [ ] Leech detection + rotation queue
- [ ] Topic resurrection (stale topic mini-audits)
- [ ] Ghost mode (90-day spot checks on mastered material)
- [ ] Knowledge gap detection (weekly cron + on-demand)
- [ ] Prompt generation for Claude.ai with copy button
- [ ] Loop closure: detect when imported material addresses gap
- [ ] Search: 3 tiers (quick, semantic, filtered)
- [ ] Calibration offsets: per-category bias correction
- [ ] Dispute with AI (mini-chat, 5-turn limit)
- [ ] Item editing with version history
- [ ] Bulk import (drag-drop multiple files, per-file category)
- [ ] URL import
- [ ] Feynman + scenario formats fully implemented
- [ ] JSON export (manual download)

**Out of scope for M2**: PWA/offline, mobile UI optimization, async processing job UX, cross-topic synthesis.

### Milestone 3: Polish & Mobile (target: weekend 3)

**Goal**: App is production-quality for daily use, especially mobile.

- [ ] PWA: manifest + service worker + install prompt
- [ ] Offline mode: pre-fetch session data, queue answers, deferred validation
- [ ] Service worker caching strategy (Workbox)
- [ ] Mobile-optimized session UI (thumb-comfortable, 56px+ targets)
- [ ] "Fresh materials" widget on home
- [ ] Async processing job UX: realtime progress, toasts, status indicators
- [ ] Realtime sync feedback (online/offline indicator, sync status)
- [ ] Cross-device session state (resume on different device)
- [ ] Cross-topic synthesis (Sonnet generates multi-material questions)
- [ ] Voice input hooks (mode prop on AnswerInput, no implementation yet)
- [ ] Performance optimization (lighthouse 90+ on mobile)
- [ ] Error boundaries + graceful degradation

---

## 📋 Conventions

### Code style

- TypeScript strict mode, no `any`
- Async/await preferred over Promise chains
- Server actions for mutations where possible (Next.js 16)
- API routes for complex logic with multiple operations
- No default exports for components (named exports for better refactoring)
- Component file names: kebab-case (`material-card.tsx`)
- Component names: PascalCase (`MaterialCard`)

### Database access

- All DB queries in `/lib/db/*.ts` (server-only)
- Never call Supabase client from server components for user data without auth check
- Use Supabase JS client v2+ pattern (typed via `database.types.ts` from `supabase gen types`)
- Migrations in `/supabase/migrations`, named with timestamp + description

### Error handling

- Custom error classes for domain errors (`CostLimitExceededError`, `ProcessingError`, etc.)
- API routes always return `{ success: boolean, data?, error? }` shape
- Client shows user-friendly error toasts, never raw error messages
- All errors logged to console in dev, Sentry in prod (when added)

### AI prompts

- All system prompts in `/lib/ai/prompts/*.ts` as constants
- Use cache_control on system prompts for repeated operations
- Always include "Respond in Polish with English technical terms" in system prompt
- Use structured output (JSON mode) for any operation that returns more than free text

### Testing

- No test framework setup in M1 (move fast)
- M2: add Vitest for `/lib` pure functions (FSRS, cost calculation)
- M3: add Playwright for critical user flows (import, session, gap loop)

---

## ⚠️ Common Pitfalls (read carefully)

1. **Don't forget RLS**: Every new table MUST have RLS policy. Default-deny in Supabase, but easy to forget.

2. **Don't call AI without tracking**: Every Anthropic/Voyage call goes through `trackAICall()` wrapper. No exceptions, even for tests.

3. **Don't store original material content**: Only `content_compressed`. The user has files locally for backup.

4. **Don't use Opus model**: Cost not justified at our scale. Sonnet is enough for the hardest tasks.

5. **Don't break the offline-first contract**: Sessions must work fully offline once started. Test this regularly.

6. **Don't skip prompt caching**: It's a 70-90% cost saver. If you're calling AI repeatedly with similar system prompts, cache them.

7. **Don't add features outside scope**: This is a personal tool, not a product. If a feature isn't in CLAUDE.md, ask before building.

8. **Don't forget Polish locale**: Dates, numbers, plurals all need Polish formatting.

9. **Don't leak the Anthropic API key**: Server-side only. Use Next.js server actions or API routes, never client-side calls to Anthropic.

10. **Don't over-engineer**: The user wants a working tool, not a perfect one. Prefer simple solutions that ship over elegant ones that don't.

---

## 🎬 First Steps for Claude Code

When starting work on this project:

1. **Read this entire CLAUDE.md file first**.
2. Confirm understanding by listing the 3 milestones and their key features.
3. Set up project: `npx create-next-app@latest learning-loop --typescript --tailwind --app --src-dir false`
4. Install core dependencies: `@supabase/supabase-js @anthropic-ai/sdk voyageai ts-fsrs mammoth lucide-react`
5. Set up shadcn: `npx shadcn-ui@latest init`
6. Create Supabase project, get credentials, set env vars
7. Write first migration with all tables from "Database Schema" section
8. Verify schema deployed, then start Milestone 1 features in order listed.

After each significant change, run:
- TypeScript compilation check
- Update PROGRESS.md with what was completed (use Session Handoff Protocol)

---

## 🤝 Session Handoff Protocol

After each work session, update `PROGRESS.md` (separate file in repo root) with:
- What was completed since last session
- What's currently in progress (with file paths)
- Known issues or blockers
- Next planned work

This file is for context preservation across Claude Code sessions. Keep it under 200 lines (archive older entries).

---

## 💬 Communication with the User

The user prefers:
- Direct, partner-like tone (not deferential)
- Important things highlighted but accurately, not dramatized
- Polish for product/feature discussions, English for code
- Concrete recommendations with reasoning, not endless options
- Acknowledgment when uncertain, with concrete next steps to resolve

When in doubt about a decision, propose a concrete approach with rationale and ask for confirmation. Don't ask open-ended "what do you think?" questions - that wastes the user's time.

---

**End of CLAUDE.md. This file is the source of truth for Learning Loop.**

---

## AI OS Context
- Strategic state for this project: `../ai-os/projects/learning-loop/state.md` (status, focus, next actions, handoff).
- Durable product/technical decisions → `../ai-os/projects/learning-loop/decisions.md` (append-only), not here.
- This repo holds tactics (`tasks/todo.md`); AI OS holds strategy. Read many, edit one.
