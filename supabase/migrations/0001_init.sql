-- Learning Loop — initial schema
-- All tables: id uuid PK, user_id (FK to auth.users), created_at, updated_at with trigger.
-- RLS enabled on every table. Single-tenant but RLS is non-negotiable security baseline.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "vector";        -- embeddings (Voyage-3, 1024 dims)
create extension if not exists "pg_cron";       -- weekly gap detection (M2)
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger function (shared by all tables)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- materials
-- ─────────────────────────────────────────────────────────────────────────────

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('finanse','programowanie','ai_ml','soft_skills','ogolne')),
  content_compressed text,
  source_filename text,
  source_url text,
  source_type text check (source_type in ('docx','md','txt','paste','url')),
  tags text[] default '{}',
  embedding vector(1024),
  parent_material_id uuid references public.materials(id) on delete set null,
  insight_note text,
  application_note text,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  imported_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

alter table public.materials enable row level security;

create policy "materials_select_own" on public.materials
  for select using (auth.uid() = user_id);
create policy "materials_insert_own" on public.materials
  for insert with check (auth.uid() = user_id);
create policy "materials_update_own" on public.materials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materials_delete_own" on public.materials
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- material_relations (auto-tagging via embedding similarity)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.material_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_a_id uuid not null references public.materials(id) on delete cascade,
  material_b_id uuid not null references public.materials(id) on delete cascade,
  relation_type text not null check (relation_type in ('merged','related','addresses_gap')),
  similarity_score numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_relations_distinct check (material_a_id <> material_b_id)
);

create trigger material_relations_set_updated_at
  before update on public.material_relations
  for each row execute function public.set_updated_at();

alter table public.material_relations enable row level security;

create policy "material_relations_select_own" on public.material_relations
  for select using (auth.uid() = user_id);
create policy "material_relations_insert_own" on public.material_relations
  for insert with check (auth.uid() = user_id);
create policy "material_relations_update_own" on public.material_relations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "material_relations_delete_own" on public.material_relations
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- items (cloze/open/feynman/scenario)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  type text not null check (type in ('cloze','open','feynman','scenario')),
  question text not null,
  answer_reference text,
  cloze_data jsonb,
  difficulty text check (difficulty in ('easy','medium','hard')),
  category text not null check (category in ('finanse','programowanie','ai_ml','soft_skills','ogolne')),
  tags text[] default '{}',
  is_suspended boolean not null default false,
  is_leech boolean not null default false,
  -- FSRS state
  fsrs_stability numeric,
  fsrs_difficulty numeric,
  fsrs_due_date timestamptz,
  fsrs_last_review timestamptz,
  fsrs_review_count integer not null default 0,
  fsrs_lapse_count integer not null default 0,
  -- edit history
  original_question text,
  edit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.items enable row level security;

create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items
  for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- sessions (group of reviews)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('deep_dive','review','audit','gap_check')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  items_planned integer,
  items_completed integer not null default 0,
  device text check (device in ('desktop','mobile')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_own" on public.sessions
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- reviews (one row per answer, never deleted)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  user_answer text,
  ai_evaluation text check (ai_evaluation in ('correct','partially_correct','incorrect')),
  ai_feedback_positive text,
  ai_feedback_negative text,
  user_calibration text check (user_calibration in ('agree','too_strict','too_lenient')),
  fsrs_rating integer check (fsrs_rating between 1 and 4),
  response_time_ms integer,
  is_offline_queued boolean not null default false,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

create policy "reviews_select_own" on public.reviews
  for select using (auth.uid() = user_id);
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- no delete policy — reviews are immutable history

-- ─────────────────────────────────────────────────────────────────────────────
-- topic_audits (scheduled deep checks: day_7 / day_30 / day_90 / resurrection)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.topic_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  scheduled_for timestamptz not null,
  trigger text not null check (trigger in ('day_7','day_30','day_90','resurrection')),
  status text not null default 'pending' check (status in ('pending','completed','skipped')),
  completed_at timestamptz,
  performance_score numeric(3,2) check (performance_score between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger topic_audits_set_updated_at
  before update on public.topic_audits
  for each row execute function public.set_updated_at();

alter table public.topic_audits enable row level security;

create policy "topic_audits_select_own" on public.topic_audits
  for select using (auth.uid() = user_id);
create policy "topic_audits_insert_own" on public.topic_audits
  for insert with check (auth.uid() = user_id);
create policy "topic_audits_update_own" on public.topic_audits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "topic_audits_delete_own" on public.topic_audits
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- knowledge_gaps (computed weekly in M2)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gap_type text not null check (gap_type in ('low_correct_rate','stale_topic','rising_failures','never_consolidated')),
  affected_tags text[] default '{}',
  affected_materials uuid[] default '{}',
  severity text not null check (severity in ('low','medium','high')),
  detected_at timestamptz not null default now(),
  generated_prompt text,
  status text not null default 'open' check (status in ('open','addressed','dismissed')),
  addressed_by_material_id uuid references public.materials(id) on delete set null,
  addressed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger knowledge_gaps_set_updated_at
  before update on public.knowledge_gaps
  for each row execute function public.set_updated_at();

alter table public.knowledge_gaps enable row level security;

create policy "knowledge_gaps_select_own" on public.knowledge_gaps
  for select using (auth.uid() = user_id);
create policy "knowledge_gaps_insert_own" on public.knowledge_gaps
  for insert with check (auth.uid() = user_id);
create policy "knowledge_gaps_update_own" on public.knowledge_gaps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "knowledge_gaps_delete_own" on public.knowledge_gaps
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- usage_logs (one row per AI API call — cost tracking)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  material_id uuid references public.materials(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger usage_logs_set_updated_at
  before update on public.usage_logs
  for each row execute function public.set_updated_at();

alter table public.usage_logs enable row level security;

create policy "usage_logs_select_own" on public.usage_logs
  for select using (auth.uid() = user_id);
create policy "usage_logs_insert_own" on public.usage_logs
  for insert with check (auth.uid() = user_id);
-- no update / delete on usage_logs — append-only audit trail

-- ─────────────────────────────────────────────────────────────────────────────
-- calibration_offsets (per-category AI bias)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.calibration_offsets (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('finanse','programowanie','ai_ml','soft_skills','ogolne')),
  too_strict_count integer not null default 0,
  too_lenient_count integer not null default 0,
  total_validations integer not null default 0,
  current_offset numeric(3,2) not null default 0.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create trigger calibration_offsets_set_updated_at
  before update on public.calibration_offsets
  for each row execute function public.set_updated_at();

alter table public.calibration_offsets enable row level security;

create policy "calibration_offsets_select_own" on public.calibration_offsets
  for select using (auth.uid() = user_id);
create policy "calibration_offsets_insert_own" on public.calibration_offsets
  for insert with check (auth.uid() = user_id);
create policy "calibration_offsets_update_own" on public.calibration_offsets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- processing_jobs (background pipeline state)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('import','generate_items','compute_gaps')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb,
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();

alter table public.processing_jobs enable row level security;

create policy "processing_jobs_select_own" on public.processing_jobs
  for select using (auth.uid() = user_id);
create policy "processing_jobs_insert_own" on public.processing_jobs
  for insert with check (auth.uid() = user_id);
create policy "processing_jobs_update_own" on public.processing_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "processing_jobs_delete_own" on public.processing_jobs
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes (performance-critical per CLAUDE.md)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vector similarity (semantic dedup, semantic search)
create index materials_embedding_idx
  on public.materials using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Hot path: list user materials by status, newest first
create index materials_user_status_idx
  on public.materials (user_id, status, imported_at desc)
  where deleted_at is null;

-- Hot path: due item queue for review sessions
create index items_user_due_idx
  on public.items (user_id, fsrs_due_date)
  where is_suspended = false;

-- Items by material (detail view, generation pipeline)
create index items_material_idx
  on public.items (material_id);

-- Reviews by item (history per item)
create index reviews_item_created_idx
  on public.reviews (item_id, created_at desc);

-- Reviews by session (session summary)
create index reviews_session_idx
  on public.reviews (session_id)
  where session_id is not null;

-- Cost dashboard queries
create index usage_logs_user_date_idx
  on public.usage_logs (user_id, created_at desc);

-- Pending audits (scheduler)
create index topic_audits_pending_idx
  on public.topic_audits (user_id, scheduled_for)
  where status = 'pending';

-- Open knowledge gaps
create index knowledge_gaps_open_idx
  on public.knowledge_gaps (user_id, detected_at desc)
  where status = 'open';

-- Job status polling
create index processing_jobs_user_status_idx
  on public.processing_jobs (user_id, status, created_at desc);

-- Full-text search (Polish + English mixed content uses 'simple' config)
create index materials_fts_idx
  on public.materials using gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_compressed,'')));
