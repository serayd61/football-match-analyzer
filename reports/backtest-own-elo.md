# Kendi Elo'muz (iki kademeli havuz) backtest — 2026-11-14

Baseline: gol-DC, canlı `dc-1.0` eşdeğeri (`model.fit`, 540 g pencere, 180 g yarı-ömür)
Aday: `p = (1−λ)·p_DC + λ·p_Elo`, K=10, λ=0,6, HFA=60
Veri: football-data.co.uk, E0/SP1/I1/D1/F1 ve ikinci kademeleri (E1/SP2/I2/D2/F2), 2012-13 → 2026-27
Test: 2021-22 sezonundan itibaren, n=9.408

## Soru

Canlı gol-DC'ye, dış servis olmadan yalnız maç sonuçlarından hesaplanan Elo harmanlanırsa
walk-forward log-loss 5 ligde düşer mi? **Evet.**

## Neden denendi

Canlı denetim (2026-11-14, 1.699 maç, kapanış oranı): modelin piyasaya açığı 0,025 LL ve
neredeyse tamamı modelin piyasadan ≥10 puan ayrıştığı maçlardan (açık 0,069), en çok sezon
başında (Ağustos 0,044). Açılış→kapanış farkı yalnız 0,003: eksik olan son dakika haberi
değil, takım gücü. Gol-DC 540 günlük pencereyle yalnız üst ligi görür ve yeni çıkan takımı
"ortalama" sayar (`model.predict`: bilinmeyen takım A=D=1,0).

## Yöntem

- Elo: ülke başına tek havuz, ilk iki kademe birlikte; World Football Elo güncellemesi
  (gol farkı çarpanı), sabit ev avantajı 60 puan. Yeni görülen takım 1500 (üst) / 1350 (alt).
- Elo → 1X2: gol farkı ~ a·ΔElo + b doğrusal eşlemesi, yalnız 2015-16 → 2018-19 sezonlarında
  fit edilir; sonra canlıdakiyle aynı Poisson + DC(ρ) skorlaması.
- Sızıntı: Elo maçtan önceki değerdir (aynı günün maçları günün başındaki puanı okur).
  (K, λ) yalnız doğrulama sezonlarında (2019-20, 2020-21; n=3.551) 5 lig havuzlanarak
  seçildi; test sezonlarında hiçbir şey taranmadı.
- Kapı sağlaması: λ=0 baseline'a birebir eşit (doğrulama tablosunda ilk sütun).

## Sonuç

| Lig | n | LL base | ΔLL [%95 CI] | ΔBrier |
|---|--:|--:|--:|--:|
| E0 | 2.000 | 0,9940 | −0,0143 [−0,0264, −0,0036] | −0,0057 |
| SP1 | 2.019 | 0,9956 | −0,0154 [−0,0232, −0,0091] | −0,0095 |
| I1 | 2.010 | 0,9898 | −0,0095 [−0,0163, −0,0030] | −0,0049 |
| D1 | 1.611 | 1,0156 | −0,0243 [−0,0347, −0,0146] | −0,0122 |
| F1 | 1.768 | 1,0131 | −0,0137 [−0,0209, −0,0066] | −0,0085 |
| **Toplam** | **9.408** | **1,0007** | **−0,0151 [−0,0191, −0,0113]** | **−0,0080** |

Piyasaya (kapanış, de-vig) açık: 0,0331 → 0,0180. Sezon bazında altı sezonun altısında düştü:

| Sezon | n | base | aday | yalnız Elo | piyasa |
|---|--:|--:|--:|--:|--:|
| 2021-22 | 1.826 | 1,0070 | 0,9917 | 0,9942 | 0,9758 |
| 2022-23 | 1.826 | 1,0080 | 0,9919 | 0,9928 | 0,9749 |
| 2023-24 | 1.752 | 0,9801 | 0,9730 | 0,9776 | 0,9525 |
| 2024-25 | 1.752 | 0,9917 | 0,9840 | 0,9903 | 0,9606 |
| 2025-26 | 1.752 | 1,0151 | 0,9958 | 0,9988 | 0,9795 |
| 2026-27 (kısmi) | 500 | 1,0048 | 0,9542 | 0,9500 | 0,9465 |

Kazanç nerede (ΔLL, aday − baseline):

| Dilim | n | Δ |
|---|--:|--:|
| DC–piyasa farkı ≥10 puan | 1.945 | −0,0706 |
| DC–piyasa farkı 5–10 puan | 2.899 | −0,0046 |
| DC–piyasa farkı <5 puan | 4.564 | +0,0018 |
| Ağustos–Eylül | 1.805 | −0,0456 |
| Ekim–Aralık | 2.821 | −0,0161 |
| Ocak–sezon sonu | 4.782 | −0,0031 |
| DC en az bir takımı tanımıyor | 54 | −0,0483 |

## Dürüst yorum

- Kazanç tam canlı denetimin gösterdiği yerde: modelin piyasadan ayrıştığı maçlar ve sezon başı.
  Sezon ortasından sonra etki küçük; modelle piyasanın zaten aynı fikirde olduğu maçlarda hafif
  kötüleşme var (+0,0018).
- Seçilen (K=10, λ=0,6) taramanın **kenarında**: daha düşük K ya da daha yüksek λ biraz daha iyi
  olabilir. Yalnız Elo (λ=1) baseline'ı −0,0121 geçiyor ama harmandan +0,0030 [+0,0011, +0,0049]
  kötü; yani DC hâlâ bilgi katıyor. Tarama genişletilmedi (seçim yanlılığına kapı açmamak için).
- Bu kazanç xG kapısındaki kazançla (−0,0142, `backtest-xg-gate.md`) **toplanmaz**. xG-DC üstüne
  Club Elo harmanı yalnız −0,001…−0,004 eklemişti (`backtest-elo.md`); ikisi büyük ölçüde aynı
  bilgiyi (şanstan arınmış takım gücü) taşıyor. Farkı: bu sürüm dış veri istemiyor ve xG'si
  olmayan liglerde de çalışır. xG-DC + kendi Elo'muz birlikte ölçülmedi.
- Value-bet ROI hâlâ negatif (−%7,8 → −%8,6): olasılık kalitesi arttı, kapanışa karşı edge yok.
- 2026-27 satırı 500 maç ve sezonun Elo'nun en çok işe yaradığı bölümü; açığın 0,058'den 0,008'e
  inmesi sezon geneli için beklenti değildir.

## Karar: GEÇTİ

Canlıya alma planı (üretim yazımı kullanıcı onayıyla):
1. `engine/service.py` FotMob deposu yalnız kapsam içi ligleri tutuyorsa ikinci kademe sonuçları
   eklenmeli (ya da Elo havuzu FD.co.uk'tan beslenip FotMob id'sine eşlenmeli) — ad eşleme işi.
2. Gölge sürüm (`dc-1.4-elo`, params: k, lambda, hfa) → haftalık kapıda aktifle eşleştirilmiş ΔLL.
3. 5 büyük lig dışındaki kapsam içi ligler için aynı backtest (ikinci kademe verisi olanlarda).

## Çalıştırma

```bash
python3 engine/backtest_ownelo.py --out /tmp/gate-ownelo
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-ownelo/base.jsonl /tmp/gate-ownelo/ownelo.jsonl
```
