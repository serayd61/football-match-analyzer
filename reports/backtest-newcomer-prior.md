# Yeni gelen takım önceliği (newcomer prior) kapı ölçümü — 2026-11-22

Soru: Lig değiştiren (yükselen/düşen) takımların saldırı/savunma gücünü ilk maçlarda lig ortalamasına
büzmek olasılık kalitesini iyileştirir mi? Tetikleyici: Championship 2026-27 teşhisi
(`championship-market-check-2026-11-22.md`): model Ağustos'ta yükselenlere piyasadan 15–29 pp fazla güven verdi.

Baseline: canlı `dc-1.0` parametreleri (rho −0,10, pencere 540 g, yarı-ömür 180 g, 25 iter, shrink_k 0,
min_team_matches 6), walk-forward (fit yalnız maç tarihinden önce). Veri: football-data.co.uk,
E1/E0/SP1/I1/D1/F1, 2019-20 → 2025-26; test 2021-22'den itibaren, n = 11.071.
Betik: `engine/backtest_newcomer.py`; kapı: `scripts/gate.py` (2.000 bootstrap).

Kollar: `shrink8` (mevcut shrink_k=8, herkese), `new_k8_d300` (yalnız 300 günde ilk kez görülen takımlar,
k=8), `new_k15_d300`, `new_k8_d150`. "Yeni takım" = 540 g penceresinde ilk maçı son `d` günde olan takım
(ligde 2.733 maç, %25). Formül: `A=(n·A+k·1)/(n+k)` (D aynı), n = takımın etkin maç sayısı.

## Sonuç — tüm maçlar (ΔLL = aday − base, negatif iyi)

| Lig | n | base LL | new_k8_d150 ΔLL [%95] | new_k8_d300 ΔLL | shrink8 ΔLL |
|---|--:|--:|--:|--:|--:|
| E1 | 2591 | 1,0554 | −0,0005 [−0,0028, +0,0017] | −0,0013 | **−0,0052 [−0,0089, −0,0016]** |
| E0 | 1809 | 0,9868 | −0,0004 [−0,0032, +0,0023] | +0,0009 | −0,0004 |
| SP1 | 1815 | 0,9978 | −0,0019 [−0,0039, −0,0000] | −0,0017 | −0,0019 |
| I1 | 1800 | 0,9871 | −0,0005 [−0,0022, +0,0012] | −0,0001 | +0,0054 |
| D1 | 1462 | 1,0015 | −0,0010 [−0,0034, +0,0013] | −0,0026 | −0,0033 |
| F1 | 1594 | 1,0076 | −0,0009 [−0,0034, +0,0011] | −0,0007 | −0,0012 |
| **Toplam** | **11071** | **1,0096** | **−0,0008 [−0,0017, +0,0001]** | −0,0009 [−0,0021, +0,0002] | −0,0013 [−0,0036, +0,0008] |

## Sonuç — yeni takım dahil maçlar (n = 2.733)

| Lig | n | new_k8_d150 ΔLL [%95] | new_k8_d300 ΔLL | shrink8 ΔLL |
|---|--:|--:|--:|--:|
| E1 | 951 | −0,0014 [−0,0074, +0,0046] | −0,0035 | −0,0052 |
| E0 | 396 | −0,0017 [−0,0149, +0,0101] | +0,0039 | +0,0037 |
| SP1 | 387 | −0,0090 [−0,0185, −0,0004] | −0,0080 | −0,0051 |
| I1 | 426 | −0,0020 [−0,0097, +0,0050] | −0,0006 | +0,0011 |
| D1 | 243 | −0,0060 [−0,0206, +0,0074] | −0,0158 | −0,0112 |
| F1 | 330 | −0,0044 [−0,0161, +0,0057] | −0,0035 | +0,0026 |
| **Toplam** | **2733** | **−0,0034 [−0,0072, +0,0001]** | −0,0037 [−0,0086, +0,0010] | −0,0025 |

Yeni takım VE sezonun ilk 60 günü: yalnız **77 maç** (E1 44, F1 11, SP1 9, I1 9, E0 4, D1 0).
new_k8: E1 −0,029, SP1 −0,221, I1 −0,056, F1 −0,032, E0 +0,136 (n=4). Yön tutarlı ama örnek küçük.

## Dürüst yorum
- **Kapı: DÜŞTÜ.** Toplam ΔLL −0,0008, aralık sıfırı içeriyor; yeni takım alt kümesinde −0,0034, aralık
  sıfıra değiyor. Yön 6/6 ligde negatif (new_k8_d150), hiçbir ligde zarar yok, ama kazanç kanıt eşiğinin altında.
- **Backtest hedef rejimi göremiyor.** Canlıda Lincoln/Cardiff/Bolton 1. haftadan tahmin aldı; burada
  `min_team_matches=6` maskesi yeni takımların ilk ~6 maçını (tam da Ağustos hatasının yaşandığı yer)
  test dışında bırakıyor → "yeni ∧ erken" 77 maça düşüyor. Canlı depoda yeni gelenlerin geçmişi nereden
  geliyor (alt lig sezonu depoya karışmış olabilir) Hetzner'de `results.jsonl` ile doğrulanmalı; sorun
  oradaysa düzeltme büzülme değil, depo/alias temizliği.
- `shrink8` (herkese büzülme) E1'de anlamlı iyi (−0,0052, aralık sıfırı dışlıyor) ama I1'de +0,0054 →
  lig bazlı parametre adayı; bu turda 5/5 geçmiyor (zaten dc-1.2-cal gölgesinde shrink_k=10 var).

## Karar: DÜŞTÜ (kapı) — kod parite ile birleşir, canlıya alınmaz
- `new_team_k` / `new_team_days` varsayılan 0 → canlı davranış birebir aynı (test: parity_when_off).
- Öneri (kullanıcı onayı gerekir): gölge sürüm `dc-1.5-new` = dc-1.0 + `new_team_k=8, new_team_days=150`,
  yalnız ölçüm için; canlı karne yeni gelenlerde dc-1.0 ile yan yana okunur. Ağustos 2027 sezon başında
  gerçek rejim (1. haftadan tahmin) ancak gölgeyle ölçülebilir.
- Önce Hetzner deposunda yeni gelenlerin geçmişi kontrol edilsin; Championship'in alt lig verisi
  depodaysa `MIN_TEAM`/alias düzeltmesi bu büzülmeden daha büyük etki yapar.
