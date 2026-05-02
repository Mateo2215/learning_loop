-- M2 Phase 1 + 6 — Voyage embeddings online.
-- Adds knowledge_gaps.embedding (so loop closure can match imported materials
-- to open gaps) plus two `match_*` RPCs that wrap pgvector cosine similarity.

-- ─────────────────────────────────────────────────────────────────────────────
-- materials.suggested_gap_id — set by the import pipeline when an open gap
-- looks similar to the new material. UI shows a "does this address gap X?"
-- banner; confirming flips the gap to 'addressed' and clears this column,
-- dismissing just clears it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.materials
  add column if not exists suggested_gap_id uuid
    references public.knowledge_gaps(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- knowledge_gaps embedding
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.knowledge_gaps
  add column if not exists embedding vector(1024);

-- ivfflat index parallels materials_embedding_idx (cosine ops, lists=100).
-- Useful only once we have a meaningful number of gaps; harmless on small N.
create index if not exists knowledge_gaps_embedding_idx
  on public.knowledge_gaps using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- match_materials — cosine similarity over materials. Returns rows above the
-- threshold, ordered by distance ascending (most similar first).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.match_materials(
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  exclude_id uuid default null
)
returns table (id uuid, similarity float, title text)
language sql
stable
security invoker
as $$
  select
    m.id,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.title
  from public.materials m
  where m.user_id = auth.uid()
    and m.deleted_at is null
    and m.embedding is not null
    and (exclude_id is null or m.id <> exclude_id)
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding asc
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- match_gaps — cosine similarity over open gaps. Used by the import pipeline
-- to suggest "this material addresses gap X".
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.match_gaps(
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (id uuid, similarity float, title text, gap_type text)
language sql
stable
security invoker
as $$
  select
    g.id,
    1 - (g.embedding <=> query_embedding) as similarity,
    g.title,
    g.gap_type
  from public.knowledge_gaps g
  where g.user_id = auth.uid()
    and g.status = 'open'
    and g.embedding is not null
    and 1 - (g.embedding <=> query_embedding) >= match_threshold
  order by g.embedding <=> query_embedding asc
  limit match_count;
$$;

