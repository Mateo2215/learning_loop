-- 0011 — audit self-grade
-- Przemodelowanie audytów na self-graded recall: audyt reużywa istniejących
-- pytań otwartych, użytkownik ocenia się sam (1–4), zero wywołań AI.
--
-- Oceny audytowe muszą być WYIZOLOWANE od logiki liczącej „ostatni wynik
-- pytania otwartego" (brama mastery, kolejka Deep Dive, część detektorów luk).
-- Inaczej review audytowy — jako najnowszy — zafałszowałby status pytania.
-- Dyskryminatorem jest kolumna `reviews.is_audit`.

alter table public.reviews
  add column if not exists is_audit boolean not null default false;

-- Pod szybkie filtrowanie ocen audytowych (i przyszły detektor luki „decay”).
create index if not exists reviews_audit_item_idx
  on public.reviews (item_id, created_at desc)
  where is_audit = true;
