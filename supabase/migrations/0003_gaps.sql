-- M2 Phase 4 — knowledge gaps: human-readable title from Sonnet ranker.

alter table public.knowledge_gaps
  add column if not exists title text;
