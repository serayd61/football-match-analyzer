# Yol haritası — beklenen kazanca göre sıralı (2026-09-05)

Puanlama: kanıt (ölçülmüş mü?) × canlı etkisi × işçilik. Her madde bir deney sorusu ve
kapıyla bitmeli. Tamamlanınca `scoreboard.md` ve burası güncellenir.

| # | İş | Beklenen etki | Kanıt durumu | İşçilik | Bağımlılık |
|---|---|---|---|---|---|
| 1 | **xG + Elo'yu canlı Yol A'ya taşı** — xG kısmı 2026-09-05: kapı CI ile GEÇTİ, `store_xg.py`+`service.py` hazır, Hetzner'de `DEPLOY.md §xG` bekliyor; Elo kısmı Club Elo API (502) düzelince yeniden ölçülecek (`dc-2.0`): `service.py` FotMob deposuna Understat xG ve Club Elo eşlemesi, ya da fit'i FD.co.uk+Understat'tan yapıp FotMob id'ye eşle | Log-loss −0.009…−0.020 + −0.001…−0.004 (5/5 ölçüldü) | Ölçüldü, aralıksız → önce `gate.py` ile yeniden üret | Orta (ad-eşleme katmanı FotMob↔FD.co.uk gerekir) | Hetzner venv, soccerdata |
| 2 | **CLV ölçümü** performans sayfasına: `prediction_odds` opening→closing farkı, model seçimi tarafında ortalama CLV ve dağılım | Edge'in doğru ölçüsü; ROI gürültüsünü keser | Veri toplanıyor (455 satır, Eylül) | Düşük (`roi.ts` benzeri saf fonksiyon + test) | Kapsam ≥ %60 |
| 3 | **Lig-başı ρ ve ev avantajı yarı-ömrü** taraması (ρ ∈ [−0.15,−0.03], H'ye ayrı yarı-ömür) | Beraberlik kalibrasyonu; küçük | Ölçülmedi | Düşük (backtest parametre) | — |
| 4 | **Gol pazarları için ayrı değerlendirme**: Ü/A 2.5 ve KG'nin walk-forward log-loss'u ve bahisçi Ü/A kapanışıyla (FD.co.uk `B365>2.5`, `P>2.5`) benchmark | Bugün Ü/A-KG karnesi yalnız ham Brier; edge bilinmiyor | Ölçülmedi | Düşük-orta (`backtest.py`'ye kolon) | — |
| 5 | **Yayın harmanı sürümü** (`dc-2.0-blend`, w≈0.7 piyasa): kullanıcıya en kalibre olasılık; bağımsız sürüm karne için kalır | 1X2 isabet +3–4 puan, LL −%4–6 (TS ölçümü) | Ölçüldü (Yol B) — Python'da tekrar | Orta (ingest'e ikinci sürüm, `SITE_MODEL_VERSION`) | Kapanış oranı zamanında (kickoff −90 dk) |
| 6 | **Kapsam genişletme**: T1 Süper Lig, N1, P1, E1 için xG'siz DC + Elo fit; `model-coverage` listesine ekle | Daha çok maç, aynı kalite | Baseline lig bazlı ölçülmeli | Düşük-orta | Deponun ligde ≥150 maçı |
| 7 | **Kadro/sakatlık istihbaratı** (dashboard): `football-data` `get_missing_players` (PL) + web; çıpa+isimli sapma; `baseline` vs `final` Brier'i sakla | LLM katkısı ilk kez ölçülebilir | Altyapı var (`match_intelligence`), ölçüm yok | Orta | ≥50 sonuçlanmış analiz |
| 8 | **Kickoff-sonrası yeniden yazımı** karneden kesin düşür; `engine_prediction_history` backfill | Karne dürüstlüğü | 249 satır tespit | Düşük | Migration uygulandı |
| 9 | **Bootstrap aralığı** tüm eski raporlara (`gate.py`) ve `reports/`'a "CI" sütunu | Karar kalitesi | — | Düşük | — |
| 10 | **Takım-gücü zaman serisi** (Kalman/EWMA atak-defans, DC'nin blok fit'i yerine online güncelleme) | Orta vadede sezon-içi tepki; belirsiz | Literatür + | Yüksek | 1–5 bitmiş |
| 11 | **Bivariate / Skellam alternatifleri** ρ yerine | Küçük, belirsiz | — | Orta | 3 bitmiş |

Yapılmayacaklar (kanıtla düştü): form/H2H tilt (çift-sayım); ρ ile global beraberlik ayarı;
piyasa olasılığını bağımsız modele girdi yapmak; "AI-powered" iddiası.

## İlk sprint önerisi
1 (gate ile yeniden ölçüm → canlıya taşıma planı) + 2 (CLV) + 9 (aralıklar). Üçü de
mevcut veriyle yapılır, üretim yazımı yalnız 1'in son adımında ve kullanıcı onayıyla.
