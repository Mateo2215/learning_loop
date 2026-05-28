-- Flag set during compression step when Haiku hits max_tokens.
-- Surfaces in import success toast and on the material detail page as
-- a banner, so the user knows the end of the source may be missing
-- from the compressed content (and from generated items).

alter table public.materials
  add column was_truncated boolean default false not null;

comment on column public.materials.was_truncated is
  'True if Haiku compression hit max_tokens and may have skipped the end of the source text.';
