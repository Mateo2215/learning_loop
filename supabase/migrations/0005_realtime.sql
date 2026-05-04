-- M3 Phase 7 — enable Supabase Realtime on tables the client subscribes to.
-- Without these statements the client gets channel SUBSCRIBED state but no
-- postgres_changes events, so the UI silently falls back to polling.

-- `supabase_realtime` is the default publication created by Supabase.
-- `add table` is idempotent only via `if not exists` syntax in pg 15+.
-- We wrap each in DO blocks to skip when already added.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'processing_jobs'
  ) then
    alter publication supabase_realtime add table public.processing_jobs;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'materials'
  ) then
    alter publication supabase_realtime add table public.materials;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;
