-- 0012 — piąty typ luki: decayed_mastery
--
-- Materiał był opanowany (przeszedł bramę zaliczenia → trafił do audytów),
-- a w audycie recall wrócił słaby (najnowszy audytowy score ≤ AUDIT_POOR_SCORE).
-- To sygnał, którego pozostałe 4 detektory nie widzą — wszystkie filtrują
-- is_audit = false; ten jedyny czyta is_audit = true.
--
-- gap_type ma inline CHECK z 0001 (auto-nazwa: knowledge_gaps_gap_type_check).
-- DROP + ADD z piątą wartością. Zastosować w Supabase ZANIM nowy kod trafi
-- na prod — inaczej CHECK odrzuci insert nowego typu.

alter table public.knowledge_gaps
  drop constraint if exists knowledge_gaps_gap_type_check;

alter table public.knowledge_gaps
  add constraint knowledge_gaps_gap_type_check
  check (gap_type in ('low_correct_rate','stale_topic','rising_failures','never_consolidated','decayed_mastery'));
