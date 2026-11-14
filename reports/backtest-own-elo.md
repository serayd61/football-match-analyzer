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

## Ek (aynı gün): canlıya girecek formül ve kısa geçmiş

Yukarıdaki sonuç olasılık düzeyinde harman ve 2012'den beri Elo geçmişiyle ölçüldü. Canlı servis
ikisini de yapamaz: Hetzner deposunda yaklaşık iki sezon sonuç var ve 1X2 / Ü-A / KG aynı gol
beklentisinden çıkmak zorunda. Bu yüzden canlı formül (`engine/elo.py`) λ düzeyinde harmanlar
(üstünlük = (1−lam)·DC + lam·(gpe·ΔElo + ev avantajı), toplam gol DC'den, değişmez) ve aynı
dosya backtest'te `--mode lambda --history-seasons 2` ile ölçüldü. Test kümesi ve baseline aynı.

| Varyant | K, λ | ΔLL [%95 CI] | Lig yönü |
|---|---|--:|:-:|
| Olasılık harmanı, tam geçmiş (üstteki tablo) | 10, 0,6 | −0,0151 [−0,0191, −0,0113] | 5/5 |
| Olasılık harmanı, 2 sezon geçmiş | 10, 0,6 | −0,0132 [−0,0170, −0,0093] | 5/5 |
| Olasılık harmanı, 1 sezon geçmiş | 15, 0,5 | −0,0109 [−0,0144, −0,0077] | 5/5 |
| Olasılık harmanı, 2 sezon, kademesiz başlangıç | 10, 0,4 | −0,0091 [−0,0127, −0,0056] | 5/5 |
| λ harmanı, tam geçmiş | 10, 0,6 | −0,0127 [−0,0162, −0,0093] | 5/5 |
| **λ harmanı, 2 sezon geçmiş (canlı formül)** | **10, 0,6** | **−0,0102 [−0,0137, −0,0067]** | **5/5** |
| λ harmanı, 2 sezon, genişletilmiş ızgara | 15, 0,8 | −0,0102 [−0,0143, −0,0063] | 5/5 |

Canlı formül, lig bazında: E0 −0,0098 [−0,0205, +0,0001], SP1 −0,0093 [−0,0157, −0,0038],
I1 −0,0079 [−0,0141, −0,0019], D1 −0,0171 [−0,0267, −0,0085], F1 −0,0077 [−0,0140, −0,0017].
ΔBrier −0,0045. Piyasaya açık 0,0331 → 0,0230. Kapı kararı: GEÇTİ.

Okuma:
- Kısa geçmiş ve λ düzeyi birlikte kazancın üçte birini götürüyor (−0,0151 → −0,0102). Canlıda
  beklenecek sayı −0,010 civarıdır, −0,015 değil.
- İngiltere'de aralık 0'a değiyor; tek lig olarak kanıtlanmış değil.
- Kademe bilgisi şart: herkes 1500'den başlarsa kazanç −0,0091'e düşüyor ve yeni çıkan takımın
  maçları +0,03 kötüleşiyor.
- Kazanç yine ayrışma maçlarında ve sezon başında (en büyük olasılık farkı ≥10 puan: −0,049,
  n=2.431; Ağustos–Eylül: −0,031). Model ile piyasanın 5 puandan yakın olduğu maçlarda
  kötüleşme var (+0,005, n=3.796) — gölgede izlenecek ilk sayı bu.
- Genişletilmiş ızgara (K 6–30, λ 0–0,9) doğrulamada K=15, λ=0,8'i seçti ama testte K=10, λ=0,6'dan
  iyi değil ve İngiltere aralığı genişledi. Doğrulama yüzeyi ikisi arasında düz (0,9930 / 0,9936).
  Varsayılan K=10, λ=0,6 kaldı; bu değer birden çok koşudan sonra sabitlendi, yani hafif seçim
  yanlılığı taşır — gerçek hakem haftalık gölge kapısıdır.

## Karar: GEÇTİ — gölge sürüm `dc-1.4-elo`

Kod bu PR'da: `engine/elo.py`, `engine/service.py` (`params.elo` varsa λ harmanı; havuzu olmayan
lig ya da havuzda 8 maçtan azı olan takım için satır üretilmez, DC'ye düşülmez),
`engine/tests/test_elo.py`. `params.elo` yoksa çıktı birebir aynı (parite).
Kurulum adımları: `engine/DEPLOY.md` § "dc-1.4-elo gölgesi". Üretim yazımı kullanıcı onayıyla.

Sonraki: 5 büyük lig dışındaki kapsam içi liglerde aynı backtest (ikinci kademe verisi olanlarda);
xG-DC + kendi Elo birlikte.

## Çalıştırma

```bash
python3 engine/backtest_ownelo.py --out /tmp/gate-ownelo
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-ownelo/base.jsonl /tmp/gate-ownelo/ownelo.jsonl

# canlı formül (λ harmanı, 2 sezon Elo geçmişi, sabit K/λ)
python3 engine/backtest_ownelo.py --out /tmp/gate-live --mode lambda --history-seasons 2 --k 10 --lam 0.6
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-live/base.jsonl /tmp/gate-live/ownelo.jsonl
```
