# xG-Dixon-Coles Haftalık Fit Job (Hetzner)

Bu job, 5 üst-lig (PL/PD/SA/BL1/FL1) için **xG-tabanlı** Dixon-Coles parametrelerini haftalık fit edip canlı `dc_model_params` tablosuna yazar. Canlı TS maç-analizi (`model-store.ts`) bunları okur → tahminler xG ile güçlenir.

**Neden Hetzner (Vercel/Railway değil):** xG kaynağı Understat, `soccerdata` kütüphanesiyle çekiliyor; bu kütüphanenin TLS-scraping'i serverless ortamlarda (Vercel/Railway) çöküyor, Hetzner kutusunda (n8n batch'in zaten koştuğu yer) çalışıyor.

## Ne yapar
`engine/publish_xg.py --write`:
1. features.py ile gol (football-data.co.uk) + xG (Understat) birleştirir, takım-adı eşler (%100 kapsama şart).
2. model_xg.py ile `(1-0.75)*gol + 0.75*xG` harmanlı hedefte DC fit eder.
3. Python `{A,D,H,base}` → TS `{attack,defense,homeAdv,rho}` **birebir** dönüştürür (parite Δ≈0).
4. FD.co.uk → football-data.org takım-adı eşler.
5. **Kendi doğrular:** yalnız %100 kapsama + parite-temiz ligleri `dc_model_params`'a INSERT eder.

## Zamanlama
Çarşamba 05:00 UTC (`0 5 * * 3`) — Vercel gol-only cron'undan (Salı 04:00) **sonra**. Not: Vercel cron artık bu 5 ligi ATLIYOR (`fit-dc-models/route.ts` `XG_MANAGED`), yani çakışma yok; Çarşamba yalnız tazeleme için.

## Ön-koşullar (Hetzner kutusunda)
1. Repo `/opt/football-match-analyzer` altında (n8n workflow bu yolu bekliyor; farklıysa workflow'daki path'i güncelle).
2. Python venv (soccerdata + pandas + numpy):
   ```bash
   cd /opt/football-match-analyzer
   python3 -m venv src/lib/data-sources/venv
   src/lib/data-sources/venv/bin/pip install soccerdata pandas numpy
   ```
3. soccerdata cache dizini: `SOCCERDATA_DIR=/opt/soccerdata` (yazılabilir olmalı).
4. Env (n8n process'ine veya shell'e):
   - `SUPABASE_URL` = `https://njrpxhmdqadejjarizmj.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (Supabase service role — GİZLİ, koda gömme)

## Manuel test (yazımdan önce)
```bash
cd /opt/football-match-analyzer/engine
export SOCCERDATA_DIR=/opt/soccerdata
# DRY-RUN (DB'ye yazmaz) — kapsama + parite gör:
SHOW_MAP=1 ../src/lib/data-sources/venv/bin/python publish_xg.py
# 5/5 lig ✅ ise gerçek yazım:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ../src/lib/data-sources/venv/bin/python publish_xg.py --write
```

## n8n kurulumu
`n8n/xg-fit-workflow.json`'u n8n'e import et. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`'i n8n ortamında tanımla. Trigger'ı etkinleştir.

## İzleme / doğrulama
Yazım sonrası Supabase'te:
```sql
select league_code, trained_at, season, trained_matches
from dc_model_params
where league_code in ('PL','PD','SA','BL1','FL1')
order by trained_at desc limit 10;
```
En son satırların `trained_at`'i job çalışmasıyla güncel olmalı. Backtest kanıtı: `reports/backtest-xg.md`.

## Sezon geçişi notu
`publish_xg.py` içindeki `FDORG_TEAMS` (football-data.org takım adları) ve `START,END` (sezonlar) yıllık güncellenmeli — yeni sezon takımları/promosyon-küme değişince. Kapsama %100'ün altına düşerse job o ligi yazmaz (güvenli) ve log'a `EŞLEŞMEYEN` basar → `OVERRIDES`/`FDORG_TEAMS` güncelle.
