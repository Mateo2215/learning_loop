-- Allow users to delete their own usage_logs.
-- The original schema marked usage_logs as append-only, but for a
-- single-user app the audit-trail invariant has little value and
-- blocks the "Wyczyść wszystkie dane" reset flow.

create policy "usage_logs_delete_own" on public.usage_logs
  for delete using (auth.uid() = user_id);
