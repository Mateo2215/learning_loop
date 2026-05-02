-- M2 Phase 2 — topic_audits execution
-- Adds the link from a topic_audit to the session that fulfilled it,
-- plus a pg_cron schedule that nudges the daily audit runner endpoint.

-- ─────────────────────────────────────────────────────────────────────────────
-- topic_audits: link to the session that executed the audit
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.topic_audits
  add column if not exists session_id uuid
    references public.sessions(id) on delete set null;

create index if not exists topic_audits_session_idx
  on public.topic_audits (session_id)
  where session_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- items: link to audit if the question was generated for an audit run.
-- Normal Deep Dive sessions filter `audit_id is null` so audit questions
-- don't pollute the regular pool. Reviews still reference items by id.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.items
  add column if not exists audit_id uuid
    references public.topic_audits(id) on delete cascade;

create index if not exists items_audit_idx
  on public.items (audit_id)
  where audit_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron job (manual install — paste into Supabase SQL Editor as service_role)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- pg_cron jobs cannot be created from a normal migration applied via the SQL
-- Editor without elevated permissions. Run the block below ONCE in the Supabase
-- SQL Editor (it's idempotent):
--
--   select cron.schedule(
--     'audits-daily',
--     '0 6 * * *',                      -- 06:00 UTC every day
--     $$
--       select net.http_post(
--         url := '<your-app-base-url>/api/cron/audits',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
--           'Content-Type', 'application/json'
--         ),
--         body := '{}'::jsonb
--       );
--     $$
--   );
--
-- Replace <your-app-base-url>. The Bearer token must match CRON_SECRET in env.
-- For local dev (no public URL) just hit the endpoint manually — see README.
