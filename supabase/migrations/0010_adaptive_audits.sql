-- 0010 — adaptive audits
-- Przeprojektowanie audytów: zamiast 3 stałych wierszy/materiał (day_7/30/90)
-- tworzonych przy imporcie, model adaptacyjny z jednym aktywnym wierszem 'pending'
-- na materiał. Audyt startuje dopiero po opanowaniu materiału, a kolejny interwał
-- zależy od wyniku (lib/audits/intervals.ts). Sesja audytu konsoliduje ≤3 materiały.

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_round: numer audytu dla materiału (1, 2, 3, …) — napędza drabinę interwałów
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.topic_audits
  add column if not exists audit_round int not null default 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- trigger: dodaj 'adaptive' (nowe audyty). Stare wartości zostają dla zgodności
-- z istniejącą historią (day_7/30/90/resurrection).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.topic_audits
  drop constraint if exists topic_audits_trigger_check;

alter table public.topic_audits
  add constraint topic_audits_trigger_check
  check (trigger in ('day_7','day_30','day_90','resurrection','adaptive'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup backlogu: nieruszony backlog 7/30/90 (tworzony przy imporcie) jest
-- niezgodny z nowym modelem. Oznaczamy go 'skipped' — historia zachowana,
-- kolejka wyzerowana. Nowe audyty powstaną naturalnie po opanowaniu materiałów.
-- ─────────────────────────────────────────────────────────────────────────────

update public.topic_audits
  set status = 'skipped'
  where status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- Egzekwuje „co najwyżej jeden pending audyt na materiał" na poziomie bazy.
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists topic_audits_one_pending_per_material
  on public.topic_audits (user_id, material_id)
  where status = 'pending';
