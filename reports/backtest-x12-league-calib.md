# Lig bazlı 1X2 kalibrasyon eğimi + kısmi havuzlama — 2026-11-22

Soru: Championship'te ölçülen aşırı güven (kalibrasyon eğimi 0,31; `championship-market-check-2026-11-22`)
global bir 1X2 sıcaklık (temperature) katmanı ya da lig bazlı eğim + kısmi havuzlama ile düzelir mi?

Baseline: canlı `dc-1.0` ham 1X2 olasılıkları (Platt yalnız ou25/btts'de; 1X2'de kalibrasyon yok).
Veri: `engine_predictions` sonuçlanmış dc-1.0 satırları, n = 16.477, 2026-08 → 2026-11-21.
Bölme: zaman — eğitim < 2026-10-08 (11.533), test ≥ 2026-10-08 (4.944). Eşik seçimi yalnız eğitimde.
Betik: `engine/calib_x12_league.py` (tek parametreli sıcaklık t; t<1 = yumuşatma; lig t'si
`(n·t_lig + k·t_global)/(n+k)` ile havuzlanır).

## Sonuç — global sıcaklık

| | t | eğitim LL | test LL |
|---|--:|--:|--:|
| ham | 1,00 | 1,0370 | **0,9914** |
| global | 0,713 | 1,0279 | 0,9964 |

Eğitimde (sezon başı dahil) model aşırı güvenli → t=0,71 seçiliyor; testte (Ekim sonrası) ham model
zaten kalibre ve sıcaklık **+0,005 kötüleştiriyor**. Aşırı güven lig geneli değil, zaman-yerel.

## Sonuç — kısmi havuzlama (k taraması, test LL)

| k | 0 | 50 | 100 | 200 | 400 | 800 | ∞ (global) |
|---|--:|--:|--:|--:|--:|--:|--:|
| test LL | 0,9989 | 0,9956 | **0,9952** | 0,9953 | 0,9956 | 0,9959 | 0,9964 |

En iyi k=100 globali yalnız 0,0012 geçiyor, ham modelin (0,9914) altında kalıyor.
Eğitim n≥100 olan 12 ligde havuzlanmış eğim globali **4/12** ligde geçiyor (5/5 kuralı: DÜŞTÜ).

## Championship (938218 + 1000001801 alias birleşik, n=169)

| dönem | n | t |
|---|--:|--:|
| Ağu–Eyl | 85 | 0,20 |
| Eki–Kas | 84 | 0,83 |

Ağu–Eyl'de öğrenilen lig eğimi (0,20) Eki–Kas'a uygulansa test LL 1,0450 (ham) → **1,0747** (daha kötü);
global 1,0437; k=100 havuz 1,0525. Lig eğimi sezon içinde kararlı değil: sorun Ağustos'ta yeni gelen
takımların gücünün abartılması, ligin kalıcı bir özelliği değil.

## Karar: DÜŞTÜ — 1X2'ye ne global ne lig bazlı sıcaklık katmanı eklenmez.
- Aşırı güven zaman-yerel (sezonun ilk ~8 haftası) ve takım-yerel (yeni gelenler). Doğru müdahale:
  motor tarafında yeni gelen takım önceliği (`feat/newcomer-prior`, ayrı rapor) + yüzeyde piyasa kapısı
  (PR #256, güçlü pazar 1X2'si EDGE_MAX_1X2).
- Sezon başına kadar (Ağustos 2027) yeniden ölçmeye gerek yok; sezon başı verisi gelince
  `calib_x12_league.py` ile "ilk 60 gün" alt kümesi ayrıca okunmalı.
- Uyarı: 2026-11-06 Platt (ou25/btts) sonrası dönem test kümesinin yarısı; 1X2 bundan etkilenmez.
