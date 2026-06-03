# CLAUDE.md - Learning Loop

> Personal learning application that closes the gap between podcast consumption and validated knowledge retention. Built for one user (Mateusz) with single-tenant architecture. **Read this file completely before starting any work on the project.**

---

## 🎯 Project North Star

**The problem we're solving**: Mateusz consumes 3 NotebookLM podcasts daily during walks. He has no validation of comprehension and no spaced retrieval mechanism. Information evaporates.

**The solution**: Active recall + spaced repetition + AI validation + closed loop with Claude.ai for filling knowledge gaps.

**Success metric**: Mateusz uses this app daily for 1 hour and his retention of consumed material improves measurably (he reports being able to apply knowledge in work contexts months after initial exposure).

**Anti-goals** (things this app explicitly is NOT):
- Not a generic flashcard app (Anki exists)
- Not a content consumption platform (NotebookLM does that)
- Not multi-user / social / collaborative (single-tenant by design)
- Not a replacement for deep reading or human teachers

---

## 👤 User Context

Mateusz is a finance professional transitioning toward AI-enabled finance roles. He has:
- Strong technical foundation (Next.js, Supabase, Python, Claude Code)
- Polish primary language, but uses English technical terms (e.g., "net working capital", not "kapitał obrotowy netto")
- Diverse learning interests: Finance, Programming, AI/ML, Soft skills, General
- Multi-device workflow: desktop for input, mobile for sessions, both for review

**Implication**: UI is Polish, but generated questions mix Polish prose with English technical terms. Code comments and commits in English.

---

## 🏗️ Architecture Decisions Record

### Why these technologies

**Next.js 15 (App Router) + TypeScript**: Mateusz knows the stack. App Router because we need streaming, server actions, and clean API routes. TypeScript because the data model is complex enough that runtime bugs would be expensive.

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

```
/learning-loop
├── /app                          # Next.js App Router
│   ├── /(auth)                   # Auth routes (login, callback)
│   ├── /(app)                    # Main app (protected)
│   │   ├── /dashboard            # Home with "fresh materials" widget
│   │   ├── /materials            # Library + import
│   │   ├── /sessions             # Active session UI
│   │   │   ├── /deep-dive        # Open questions session
│   │   │   └── /review           # Flashcard SR session
│   │   ├── /search               # 3-tier search
│   │   ├── /gaps                 # Knowledge gap detection
│   │   ├── /costs                # Cost monitoring dashboard
│   │   └── /settings             # Theme, export, account
│   └── /api                      # API routes
│       ├── /materials/...        # CRUD + import + processing
│       ├── /sessions/...         # Session lifecycle + answers
│       ├── /ai/...               # AI operations (with cost tracking)
│       └── /sync/...             # Realtime helpers
├── /components
│   ├── /ui                       # shadcn primitives
│   ├── /materials                # Material-specific components
│   ├── /sessions                 # Session UI (mobile-first!)
│   └── /shared                   # Cross-cutting (theme, auth, etc.)
├── /lib
│   ├── /ai                       # Anthropic + Voyage clients
│   ├── /db                       # Supabase queries (server-side)
│   ├── /fsrs                     # Spaced repetition algorithm
│   ├── /processing               # Material processing pipeline
│   └── /utils                    # Pure functions
├── /supabase
│   ├── /migrations               # SQL migrations
│   └── /functions                # Edge functions if needed
├── /public
│   ├── manifest.json             # PWA manifest
│   └── /icons                    # PWA icons
├── /workers                      # Service worker config
└── CLAUDE.md                     # This file - read first
```

---

## 📐 Database Schema (Supabase / Postgres)

**All tables have**: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` with auto-update trigger.

**RLS enabled on all tables** with policy `auth.uid() = user_id`. Single-tenant but RLS is non-negotiable security baseline.

### Core tables

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

All endpoints require authenticated user via Supabase. Pattern: `app/api/[domain]/[action]/route.ts`.

### Materials

- `POST /api/materials/import` - Upload file or paste text. Returns `{ job_id }`. Processing async.
- `POST /api/materials/import-url` - Web scrape + process. Returns `{ job_id }`.
- `POST /api/materials/import-bulk` - Multiple files at once. Returns `{ job_ids: [] }`.
- `GET /api/materials` - List with filters. Query params: `category`, `tags`, `status`, `limit`, `cursor`.
- `GET /api/materials/:id` - Full material details.
- `PATCH /api/materials/:id` - Update title, tags, notes.
- `DELETE /api/materials/:id` - Soft delete (sets `deleted_at`).
- `POST /api/materials/:id/check-similar` - Returns top 3 similar materials by embedding.
- `POST /api/materials/merge` - Merge two materials. Body: `{ keep_id, merge_id }`.

### Sessions

- `POST /api/sessions/start` - Body: `{ mode: 'deep_dive' | 'review' | 'audit', material_id?, item_count? }`. Returns full session with pre-loaded items (for offline mode).
- `POST /api/sessions/:id/answer` - Submit answer for one item. Body: `{ item_id, answer, fsrs_rating?, response_time_ms }`. AI validation happens here for open questions.
- `POST /api/sessions/:id/dispute` - Open dispute with AI. Body: `{ review_id, user_argument }`. Returns AI counter-response.
- `POST /api/sessions/:id/calibrate` - User feedback on AI validation. Body: `{ review_id, calibration: 'agree' | 'too_strict' | 'too_lenient' }`.
- `POST /api/sessions/:id/end` - Close session. Returns summary.
- `POST /api/sessions/sync-offline` - Batch upload offline-queued reviews. Body: `{ reviews: [...] }`. Returns batch validation results.

### AI operations (internal, called by other endpoints)

- `POST /api/ai/generate-items` - Generate questions/flashcards from material. Used by import pipeline.
- `POST /api/ai/validate-answer` - Validate open answer.
- `POST /api/ai/detect-gaps` - Run weekly gap analysis.
- `POST /api/ai/generate-prompt` - Generate Claude.ai prompt for a gap.
- `POST /api/ai/generate-audit` - Fresh audit questions for a material.

### Search

- `GET /api/search/quick?q=...` - Full-text search across materials, items, tags. Sub-100ms target.
- `POST /api/search/semantic` - Body: `{ query }`. Embedding-based similarity search.
- `POST /api/search/filtered` - Body: `{ filters: {...} }`. Multi-criteria search.

### Costs

- `GET /api/costs/summary` - Today / month / projection.
- `GET /api/costs/breakdown?period=month` - Per operation, per model.
- `GET /api/costs/per-material` - Cost per material, sorted descending.

### Sync (Realtime helpers)

Use Supabase Realtime client-side directly. No custom endpoints. Subscribe to:
- `materials` table for status changes (processing → ready)
- `processing_jobs` for progress updates
- `items` for cross-device session state

---

## 🤖 AI Strategy: Model Selection

**Rule**: Default to Haiku. Use Sonnet only when justified.

| Operation | Model | Why |
|---|---|---|
| Generate cloze flashcards | Haiku | Pattern-following, structured output |
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
| Generate audit questions | Sonnet | Diverse, non-repetitive questions |
| Cross-topic synthesis | Sonnet | Multi-context reasoning |

### Prompt caching

**Cache the system prompt for every recurring operation type**. System prompts for "validate open answer in finance category" are reused across thousands of calls. Use `cache_control: { type: "ephemeral" }` on the system prompt block.

Expected savings: 70-90% on input token costs after first call within 5-minute window.

### Batch API for bulk imports

When `import-bulk` has >5 materials, route generation jobs through Batch API (50% cheaper, 24h SLA acceptable). Single imports go through synchronous API (need fast feedback).

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

**Reguła zaliczenia (status `done`)**: ostatni score AI każdego pytania otwartego ≥ **podłogi 6** ORAZ **średnia ≥ 7**. To dwa rozdzielone progi:
- `SECTION_FLOOR_THRESHOLD = 6` — twarda podłoga. Pytanie <6 → status `needs_followup` (blokuje zaliczenie niezależnie od średniej).
- `SECTION_AVG_THRESHOLD = 7` — wszystkie pytania ≥6, ale średnia <7 → status `below_threshold` (domiel szóstki do siódemek).

**Dlaczego dwa progi vs jeden (historycznie było „każde pytanie ≥7"):** szóstka nie powinna w nieskończoność blokować materiału, ale średnia musi być solidna. Audyt długoterminowy planuje się dopiero po `done`.

**Próg pojedynczego pytania zostaje na 7 (NIE obniżać do 6):**
- `MASTERY_SCORE_THRESHOLD = 7` — „opanowane" (display) + leech.
- Kolejka Deep Dive (`selectDeepDiveItems` w `app/api/sessions/start/route.ts`) serwuje pytania <7. To celowe: gwarantuje, że `below_threshold` (są pytania <7, choć ≥6) zawsze ma co serwować do powtórki — inaczej powstałby martwy zaułek (same szóstki → pusta sesja → nie da się podnieść średniej).

`AUDIT_GOOD_SCORE = 7` (drabina interwałów audytu) jest niezależny od bramy zaliczania.

## 🧠 FSRS Algorithm

Use library `ts-fsrs` (npm package, well-maintained). Don't implement from scratch.

**Configuration for Mateusz**:
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

When user imports material, this is the async flow (background job):

```
1. Parse source              → extract text from DOCX/MD/TXT/URL
2. Detect category           → AI suggests, user confirms (or pre-set in bulk)
3. Generate embedding        → Voyage-3 on full text
4. Check duplicates          → similarity search
   - If >0.92: auto-merge (with notification)
   - If 0.85-0.92: flag for user decision
   - If <0.85: continue
5. Compress content          → Haiku summarizes to ~30% length
6. Auto-tag                  → Haiku generates 3-5 tags
7. Generate items            → Haiku creates:
   - 10-20 cloze flashcards
   - 5-8 open questions
   - 1-2 Feynman prompts
   - 1-2 scenario prompts (if category is finanse/programowanie)
8. Schedule audits           → create topic_audits rows for day_7, day_30, day_90
9. Mark material as 'ready'  → triggers Realtime update to client
```

**Each step logs cost. Each step can fail independently** - implement retries (3x with exponential backoff) before marking job as failed.

**Job status visible in UI** via Realtime subscription on `processing_jobs` table.

---

## 📱 Mobile-First Session UI

The session UI is the **most important** UX surface. Mateusz uses it during/after walks. Optimize ruthlessly.

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
- Server actions for mutations where possible (Next.js 15)
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

10. **Don't over-engineer**: Mateusz wants a working tool, not a perfect one. Prefer simple solutions that ship over elegant ones that don't.

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

Mateusz prefers:
- Direct, partner-like tone (not deferential)
- Important things highlighted but accurately, not dramatized
- Polish for product/feature discussions, English for code
- Concrete recommendations with reasoning, not endless options
- Acknowledgment when uncertain, with concrete next steps to resolve

When in doubt about a decision, propose a concrete approach with rationale and ask for confirmation. Don't ask open-ended "what do you think?" questions - that wastes Mateusz's time.

---

**End of CLAUDE.md. This file is the source of truth for Learning Loop.**
