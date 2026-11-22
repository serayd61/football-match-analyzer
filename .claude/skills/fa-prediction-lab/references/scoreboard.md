# Skor tablosu — ölçülmüş her şey (güncel tut)

Kural: buraya yalnız **walk-forward, sızıntısız, raporu repo'da olan** sayı girer. Yeni
deney → önce `reports/backtest-<özellik>.md`, sonra bu tabloya satır. Tarih ve n yaz.

## 1. Baseline — gol-DC (`engine/backtest.py`, 2026-06-30)

Veri football-data.co.uk 2019→2024, test sezon 2021-22'den itibaren, pencere 540g,
yarı-ömür 180g. Bahisçi = Pinnacle kapanış (de-vig).

| Lig | n | 1X2 model | 1X2 bahisçi | Brier | Log-loss | Value-bet n | ROI (EV>5%) |
|-----|--:|--:|--:|--:|--:|--:|--:|
| E0 | 1520 | 54.7% | 57.0% | 0.5769 | 0.9747 | 1531 | −6.64% |
| SP1 | 1520 | 51.8% | 54.2% | 0.5948 | 0.9996 | 1488 | −13.47% |
| I1 | 1520 | 53.3% | 53.9% | 0.5899 | 0.9908 | 1428 | −4.42% |
| D1 | 1224 | 50.9% | 53.5% | 0.6044 | 1.0115 | 1164 | −8.16% |
| F1 | 1372 | 50.8% | 52.7% | 0.6045 | 1.0124 | 1418 | −2.73% |

Okuma: model bahisçinin 0.6–2.6 puan altında; hiçbir ligde kapanışa karşı edge yok.
Rastgele log-loss 1.099.

## 2. xG-DC (`engine/backtest_xg.py`, 2026-07-01) — GEÇTİ, w=0.75

| Lig | Log-loss w=0 → en iyi (w) | Δ | Brier Δ | ROI w=0 → w* |
|-----|--:|--:|--:|--:|
| E0 | 0.9747 → 0.9582 (0.75) | −0.0165 | −0.0089 | −6.64% → +1.73% |
| SP1 | 0.9996 → 0.9792 (1.00) | −0.0204 | −0.0124 | −13.47% → −7.46% (w=0.5) |
| I1 | 0.9908 → 0.9819 (0.75) | −0.0089 | −0.0040 | −4.42% → −11.36% |
| D1 | 1.0115 → 0.9934 (1.00) | −0.0181 | −0.0128 | −8.16% → −7.70% |
| F1 | 1.0124 → 1.0040 (0.50) | −0.0084 | −0.0043 | −2.73% → −4.44% |

Okuma: olasılık kalitesi 5/5 iyileşti; ROI karışık → edge iddiası yok. xG kapsama %100.
**Belirsizlik aralığı yok** (denetim notu) → canlıya almadan önce `gate.py` ile yeniden üret.

## 2b. xG-DC kapı yeniden ölçümü — bootstrap aralıklı (`engine/export_preds.py` + `gate.py`, 2026-09-05) — GEÇTİ

Aynı veri/test kümesi (n=7.156), w=0.75 sabit (tarama yok). Baseline satırı §1 ile birebir aynı (sağlama).

| Lig | n | ΔLL [%95 CI] | ΔBrier |
|-----|--:|--:|--:|
| E0 | 1520 | −0.0164 [−0.0262, −0.0076] | −0.0089 |
| SP1 | 1520 | −0.0196 [−0.0281, −0.0112] | −0.0120 |
| I1 | 1520 | −0.0089 [−0.0177, −0.0006] | −0.0040 |
| D1 | 1224 | −0.0181 [−0.0270, −0.0094] | −0.0123 |
| F1 | 1372 | −0.0083 [−0.0178, +0.0002] | −0.0039 |
| Toplam | 7156 | **−0.0142 [−0.0183, −0.0104]** | −0.0082 |

Okuma: 5/5 yön tutarlı, toplam aralık sıfırı dışlıyor; F1 aralığı sıfıra değiyor, I1 zar zor dışlıyor.
ROI hâlâ negatif (toplam −7.1% → −6.9%). Rapor: `reports/backtest-xg-gate.md`. Canlıya alma kodu:
`engine/store_xg.py` + `service.py` (`dc-2.0-xg`, kapsam ≥ %95 olan ligde). Elo aynı gün YENİDEN
ÖLÇÜLEMEDİ (api.clubelo.com 502).

## 3. Elo harmanı (`engine/backtest_elo.py`, 2026-07-01) — GEÇTİ, baseline xG-DC w=0.75

| Lig | base LL | base Brier | λ* | ΔLL | ΔBrier | a (gol/Elo) | b (ev, gol) | total |
|-----|--:|--:|--:|--:|--:|--:|--:|--:|
| E0 | 0.9590 | 0.5685 | 0.15 | −0.0010 | −0.0004 | 0.004605 | 0.008 | 2.69 |
| SP1 | 0.9803 | 0.5829 | 0.30 | −0.0017 | −0.0007 | 0.004769 | 0.228 | 2.51 |
| I1 | 0.9823 | 0.5862 | 0.30 | −0.0015 | −0.0012 | 0.005452 | 0.200 | 3.05 |
| D1 | 0.9933 | 0.5921 | 0.40 | −0.0022 | −0.0012 | 0.005213 | 0.322 | 3.03 |
| F1 | 1.0042 | 0.6006 | 0.40 | −0.0036 | −0.0026 | 0.005553 | 0.029 | 2.76 |

Okuma: küçük ama 5/5 aynı yönde → gerçek sinyal. Canlı
sabitler `engine/publish_elo.py ELO_MAP` (λ test-seti seçimi → mütevazı).

## 4. Form / H2H tilt (`engine/backtest_context.py`, 2026-07-01) — DÜŞTÜ

Form tilt 5/5 ligde kötüleştirdi (ΔLL +0.0007…+0.0037). H2H en iyi −0.0002 (gürültü), I1'de
kötü. Sebep: 180g yarı-ömür formu zaten içeriyor (çift-sayım). Tekrar deneme; denenecekse
yalnız **yarı-ömrü kısaltarak** (form yerine) ve lig-başı.

## 5. Piyasa harmanı — TS (`scripts/backtest-blend.ts`, `src/lib/odds/blend.ts`)

3 lig × 2 sezon, ~2000 maç, gerçek Pinnacle/Bet365. w=0.7'de DC-tek'e göre 1X2 isabet
~%48 → ~%52, log-loss ~%4–6 iyileşme; kazanımın ~%95'i alınırken DC katkısı ~%30 korunur.
w=1 = bahisçiyi aynen satmak (edge sıfır). **Not:** bu, bağımsız model karnesine girmez;
yayın ürünü tartışması için `methodology.md` §5.

## 6. Piyasa modeli (1X2→Poisson ters çözüm, `src/lib/market-model.ts`, 2026-08-27, n=70)

1X2 favori %41.4 (motor aynı maçlarda %38.6), çifte şans %75.7. Ü/A: "Üst" derken %84.2
(n=19), "Alt" derken %39.2 (n=51) → tek taraflı (1X2 tempo taşımıyor). KG %54.3 (taban %60)
→ güvenilmez. Kapsam dışı 242 lig için LLM zemini; motora yazmaz.

## 7. Canlı karne ölçümleri (üretim DB)

- 2026-08-11, 3.737 sonuçlanmış tahmin: sıralama doğru (%43.7 → %67.6 güven arttıkça) ama
  üst dilim %79.9 iddia / %67.6 gerçek → şişkin → izotonik kalibrasyon eklendi.
- Aynı ölçüm: tahminlerin %99.8'i `dc_model_params`'ı olmayan 242 ligden, isabet %49.4 →
  `model-coverage` (yalnız 10 lig yayınla).
- 2026-09-05: 10.687 satır hepsi `dc-1.0`; 249 kickoff-sonrası yeniden yazım; ROI açılış
  ve kapanış artık ayrı, kapsam yüzdesiyle (`performance.ts`).
- Canlı model = §1 baseline (gol-DC, FotMob deposu, 540g). §2–§3 kazanımları canlıda YOK.
- 2026-09-27, 403 kapsam-içi maç ⨝ kapanış oranı: model LL 1.0335 / piyasa 0.9960 / harman-0.7 1.0025; isabet 45.7 / 48.1 / 47.6; model piyasa favorisinden ayrıştığı 65 maçta %27.7 isabet; λ toplamı 2.85 vs gerçek 3.14. Rapor: `reports/live-audit-2026-09-27.md`.

## 7b. Gol seviyesi çarpanı (`engine/backtest_goals.py`, 2026-09-27) — DÜŞTÜ (etki yok)

5 lig, 2021-22+, yarı-ömür {30..90} × k {20..80}: ΔLL Ü2,5 −0,0003…+0,0006, KG −0,0019…+0,0022,
çarpan 0,99–1,01. Tarihsel veride `base` yansız (λ ≈ gerçek gol ±0,05). Canlıdaki %8 fark = 2026-27
sezon başı rejimi ya da Hetzner depo farkı; bkz. `reports/backtest-goal-level.md`. Yan bulgu: model
Ü2,5 LL piyasadan 0,02–0,03 kötü (keskinlik), seviye değil.

## 8. Referans sabitler (dış kaynak, projeye özgü değil)

`football-match-forecasting` skill'i uluslararası maçlarda Elo→gol katsayısını 0.32 yerine
**≈0.45** (toplam gol tabanı 2.5) bulmuş; bizim kulüp verimizde eşdeğer `a≈0.0046–0.0056
gol/Elo puanı` (=0.46–0.56 / 100 Elo) ile uyumlu. Katsayıyı her Elo kaynağı için yeniden
kalibre et.

## 10. Kendi Elo'muz, iki kademeli havuz (`engine/backtest_ownelo.py`, 2026-11-14) — GEÇTİ

Baseline gol-DC (canlı eşdeğeri). Elo yalnız sonuçlardan, ülkenin ilk iki kademesi tek havuz;
K=10, λ=0,6 doğrulama sezonlarında (1920, 2021) seçildi, testte tarama yok. Veri 2012→2026-27, test 2122+.

| Lig | n | ΔLL [%95 CI] | ΔBrier |
|-----|--:|--:|--:|
| E0 | 2000 | −0.0143 [−0.0264, −0.0036] | −0.0057 |
| SP1 | 2019 | −0.0154 [−0.0232, −0.0091] | −0.0095 |
| I1 | 2010 | −0.0095 [−0.0163, −0.0030] | −0.0049 |
| D1 | 1611 | −0.0243 [−0.0347, −0.0146] | −0.0122 |
| F1 | 1768 | −0.0137 [−0.0209, −0.0066] | −0.0085 |
| Toplam | 9408 | **−0.0151 [−0.0191, −0.0113]** | −0.0080 |

Okuma: piyasaya açık 0.0331 → 0.0180; kazanç DC–piyasa ayrışması ≥10 puan olan maçlarda (−0.071)
ve Ağustos–Eylül'de (−0.046). (K, λ) tarama kenarında. xG kazancıyla (§2b) TOPLANMAZ — aynı bilgi;
xG-DC + kendi Elo birlikte ölçülmedi. ROI negatif kaldı. Rapor: `reports/backtest-own-elo.md`.

Canlı formül (`engine/elo.py`: λ düzeyinde harman, toplam gol korunur; Elo geçmişi 2 sezon):
**−0.0102 [−0.0137, −0.0067]**, 5/5 lig, E0 aralığı 0'a değiyor [−0.0205, +0.0001]; piyasaya açık
0.0331 → 0.0230. Kademesiz başlangıç −0.0091 (yeni çıkan takım maçları +0.03). Model–piyasa <5 puan
diliminde +0.005 kötüleşme. Canlıda beklenti −0.010, −0.015 değil. Gölge sürüm adı `dc-1.4-elo`.

§7 eki — canlı denetim 2026-11-14 (1.699 maç ⨝ kapanış): model LL 0.9848 / piyasa 0.9598
(açık 0.025 [0.013, 0.037]); açılış→kapanış yalnız 0.003; açık ayrışma ≥10 puanda 0.069,
Ağustos'ta 0.044. Gölgeler dc-1.0'a göre: lvl +0.0002, ctx +0.0001, cal +0.006, xg −0.007 (n=272, CI 0'ı içeriyor).

## 11. Dinamik takım gücü, skor-güdümlü Poisson (`engine/backtest_dynamic.py`, 2026-11-15) — GEÇTİ, canlıya alma ertelendi

Atak/savunma her maçtan sonra κ·(gol − λ) ile güncellenir; iki kademeli havuz, alt kademe −δ. Test 2122+, n=9408.

| Karşılaştırma | Tam geçmiş | 2 sezon geçmiş |
|---|--:|--:|
| dinamik − gol-DC | **−0.0164 [−0.0211, −0.0120]** 5/5 | −0.0137 [−0.0181, −0.0092] 5/5 |
| dinamik − (DC+Elo olasılık harmanı) | −0.0013 [−0.0032, +0.0006] | −0.0005 [−0.0022, +0.0013] |
| (DC+Elo ⊕ dinamik) − (DC+Elo) | −0.0018 [−0.0030, −0.0007] | −0.0012 [−0.0022, −0.0001] |
| dinamik − canlı Elo formülü (§10) | — | −0.0035 [−0.0056, −0.0014] 4/5 |

Okuma: Elo ile aynı bilgi — üstüne eklenince kazanç terfi eşiğinin altında. Tek parça aday olarak
canlı Elo formülünden −0.0035 iyi (E0 hariç) ve Ü/A 2,5 kalibre LL 0.6817 → 0.6771, KG 0.6852 → 0.6841.
Dış kaynak (Koopman & Lit) ile uyumlu. Rapor: `reports/backtest-dynamic-strength.md`.

## 12. Kadro piyasa değeri, Transfermarkt (`engine/backtest_value.py`, 2026-11-15) — ölçüldü, ALINMIYOR

x = ln V_ev − ln V_dep (son 120 günde forma giyenlerin en değerli 18'i, maç öncesi değerle). Test 2122+, n=9408.

| Referans | ΔLL [%95 CI] |
|---|--:|
| gol-DC ⊕ değer (w=0.4) | **−0.0120 [−0.0151, −0.0090]** 5/5 |
| DC+Elo ⊕ değer (w=0.2) | −0.0019 [−0.0028, −0.0010] 5/5 |
| dinamik ⊕ değer (w=0.1) | −0.0008 [−0.0011, −0.0004] 5/5 |

Okuma: Elo / dinamik model varken katkı terfi eşiğinin altında; üçü de aynı bilgiyi taşıyor. Ölçüm
yeni transferleri ve yeni çıkan takımları göremiyor (kadro forma kayıtlarından). Canlı veri kaynağı yok
(veri seti 2026-06-28'de durdu). Tekrar deneme koşulu: sezon öncesi kadro listesi veren kaynak.
Rapor: `reports/backtest-squad-value.md`.

## Güncelleme günlüğü

- 2026-11-15: §11 dinamik takım gücü kapısı (GEÇTİ, ertelendi); §12 kadro piyasa değeri (alınmıyor).
- 2026-11-22: lig bazlı 1X2 sıcaklık + kısmi havuzlama (DÜŞTÜ, 4/12 lig; ham test LL 0,9914 < global 0,9964 < en iyi havuz 0,9952) → reports/backtest-x12-league-calib.md. Championship aşırı güveni zaman-yerel (Ağu–Eyl t=0,20, Eki–Kas 0,83).
- 2026-11-14: §10 kendi Elo kapısı (GEÇTİ), canlı formül ölçümü ve canlı denetim eki.

- 2026-09-27: canlı denetim (§7) — 131 void satır geri kazanıldı, UCL kimlik düzeltmesi, harman ve anlaşmazlık koruması ölçümü.

- 2026-09-05: tablo oluşturuldu (kaynak: reports/*.md, docs/audit-2026-09-05.md, kod yorumları).
- 2026-09-05: §2b xG kapısı bootstrap aralığıyla yeniden ölçüldü (GEÇTİ); canlı entegrasyon kodu yazıldı (deploy bekliyor).

## 9. Hızlı bulgu — kurulum testi (2026-09-05, `calibrate_backtest.py`, E0 2019→2024)

`export_fdco_csv.py E0 2019 2024` → forecasting skill'in **kendi rolling Elo → Poisson/DC**
modeli (dış veri yok, yalnız sonuçlar). Test 2021-08-01+, n=1440 (≥20 maç filtresi; §1'deki
1520 ile birebir aynı küme DEĞİL).

| coeff | tgb | Brier | Log-loss |
|--:|--:|--:|--:|
| 0.32 | 2.5 | 0.5727 | 0.9642 |
| **0.40** | **2.6** | **0.5700** | **0.9598** |
| 0.45 | 2.5 | 0.5711 | 0.9629 |

Okuma: sadece sonuç tabanlı rolling Elo, PL'de gol-DC baseline'ı (0.9747) belirgin geçiyor
ve xG-DC'ye (0.9582) yaklaşıyor. Reliability: deplasman büyük favorileri (Elo farkı < −150)
gerçek %68 kazanırken model %61 diyor → deplasman favorisi ezmesi; ev favorisi (+150) %63
gerçek / %66 model → hafif şişkin. Sonuç: **kulüp verisi için coeff≈0.40**, 0.45 değil.
Bu, roadmap #1 (Elo'yu canlıya taşıma) ve #3 (ev avantajı) için ek gerekçe; 5 ligde ve
aynı test kümesinde `gate.py` ile tekrarlanmadan tabloya "geçti" olarak girmez.
