-- Resumable Deep Dive sessions.
-- Stores the source material and the planned open-question order on the
-- session row so a user can leave and resume on any device.

alter table public.sessions
  add column if not exists material_id uuid
    references public.materials(id) on delete set null;

alter table public.sessions
  add column if not exists planned_item_ids uuid[] not null default '{}';

create index if not exists sessions_active_material_idx
  on public.sessions (user_id, mode, material_id, started_at desc)
  where ended_at is null;
