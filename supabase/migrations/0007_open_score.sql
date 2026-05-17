-- Deep Dive open-answer scoring (1-10).
-- Adds a granular score alongside the existing 3-state ai_evaluation,
-- plus a per-category score_offset that mirrors how current_offset
-- biases the 3-state evaluation based on user calibration feedback.

alter table public.reviews
  add column if not exists score smallint
    check (score is null or (score between 1 and 10));

create index if not exists reviews_item_score_idx
  on public.reviews (item_id, created_at desc)
  where score is not null;

create index if not exists reviews_user_score_idx
  on public.reviews (user_id, created_at desc)
  where score is not null;

alter table public.calibration_offsets
  add column if not exists score_offset numeric(3,2) not null default 0.0;
