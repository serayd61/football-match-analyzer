-- Kapsam sicili: 'hidden' durumu (2026-09-24). 1X2 log-loss'u rastgeleden (1,0986)
-- kötü olan kapsam dışı ligler (n≥20) sitede ve Tier-B listesinde hiç gösterilmez;
-- motor tahmin üretmeye devam eder ki karne düzelirse (LL<1,05) otomatik geri açılsın.
alter table public.league_coverage drop constraint if exists league_coverage_status_check;
alter table public.league_coverage add constraint league_coverage_status_check
  check (status in ('whitelist', 'observe', 'excluded', 'hidden'));
