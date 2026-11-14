# Dinamik takım gücü (skor-güdümlü Poisson) backtest — 2026-11-15

Betik: `engine/backtest_dynamic.py`. Kapı: `.claude/skills/fa-prediction-lab/scripts/gate.py`.
Veri: football-data.co.uk, 5 lig + ikinci kademeleri, 2012-13 → 2026-27. Test 2021-22+, n=9.408.

## Soru

Takım atak/savunma gücü sabit yarı-ömürlü pencereyle (canlı gol-DC: 540 gün, 180 gün yarı-ömür)
yeniden fit edilmek yerine her maçtan sonra küçük bir adımla güncellenirse log-loss düşer mi?
Ve gölgedeki DC+Elo harmanının (`dc-1.4-elo`) üstüne bir şey katar mı?

## Neden denendi

Dış araştırma (2026-11-14): Koopman & Lit, Premier League'de zaman ağırlıklı Dixon-Coles'a göre
skor-güdümlü / durum-uzayı modelde RPS −0,002…−0,004 ölçmüş. Ek veri istemeyen, kanıtı en güçlü
iyileştirme buydu.

## Yöntem

- log λ_ev = log ḡ_ev + atak_ev − savunma_dep; log λ_dep = log ḡ_dep + atak_dep − savunma_ev.
  Maçtan sonra atak ve savunma κ·(gol − λ) kadar güncellenir. ḡ: kademenin üstel ağırlıklı gol
  ortalaması. Ülkenin ilk iki kademesi tek havuz; alt kademede ilk görülen takım −δ ile başlar.
- 1X2 / Ü-A / KG canlıdakiyle aynı Poisson + DC(ρ) skorlamasından.
- Sızıntı: aynı günün maçları günün başındaki gücü okur. (κ, δ) ve harman ağırlıkları yalnız
  doğrulama sezonlarında (2019-20, 2020-21; n=3.551) seçildi; testte tarama yok.
- Baseline: gol-DC (dc-1.0 eşdeğeri). Elo karşılaştırmaları `reports/backtest-own-elo.md`'deki
  sabit K=10, λ=0,6 ile; yeniden taranmadı.
- "2 sezon geçmiş": Hetzner deposunun derinliğini taklit eder (her sezon yalnız önceki 2 sezonla).

## Sonuç — 1X2 (ΔLL, %95 CI)

| Karşılaştırma | Tam geçmiş (κ=0,015, δ=0,25) | 2 sezon geçmiş (κ=0,02, δ=0,35) |
|---|--:|--:|
| Dinamik − gol-DC | **−0,0164 [−0,0211, −0,0120]** 5/5 lig | **−0,0137 [−0,0181, −0,0092]** 5/5 lig |
| Dinamik − (DC+Elo, olasılık harmanı) | −0,0013 [−0,0032, +0,0006] 4/5 | −0,0005 [−0,0022, +0,0013] 4/5 |
| (DC+Elo ⊕ dinamik, w=0,6) − (DC+Elo) | −0,0018 [−0,0030, −0,0007] 5/5 | −0,0012 [−0,0022, −0,0001] 4/5 |
| Dinamik − canlı Elo formülü (λ harmanı) | — | **−0,0035 [−0,0056, −0,0014]** 4/5 |

Mutlak log-loss (test, tam geçmiş): gol-DC 1,0007 · DC+Elo 0,9856 · dinamik 0,9843 ·
DC+Elo⊕dinamik 0,9838 · piyasa (kapanış) 0,9676. Piyasaya açık 0,0331 → 0,0167.

Lig bazında dinamik − gol-DC (2 sezon geçmiş): E0 −0,0086 [−0,0220, +0,0032], SP1 −0,0127,
I1 −0,0083, D1 −0,0260, F1 −0,0155. Canlı Elo formülüne karşı İngiltere'de hafif kötü
(+0,0012 [−0,0032, +0,0057]); kazanç Almanya (−0,0088) ve Fransa'dan (−0,0078) geliyor.

Dilimler (tam geçmiş, log-loss): DC–piyasa farkı ≥10 puan 1,0971 → 1,0195; Ağustos–Eylül
1,0220 → 0,9774; fark <5 puan 0,9596 → 0,9637 (kötüleşme, Elo harmanındakiyle aynı desen).

## Sonuç — gol pazarları (test, 2 sezon geçmiş)

Dinamik model toplam gol beklentisini de değiştirir (Elo harmanı değiştirmez).

| Pazar | gol-DC | Dinamik | Δ LL |
|---|--:|--:|--:|
| Ü/A 2,5 ham | 0,6944 | 0,6794 | −0,0150 |
| Ü/A 2,5 Platt-kalibre | 0,6817 | 0,6771 | −0,0046 |
| KG Var ham | 0,6975 | 0,6860 | −0,0115 |
| KG Var Platt-kalibre | 0,6852 | 0,6841 | −0,0012 |

Platt eğrisi doğrulama sezonlarında fit edildi (canlıdaki `calib` ile aynı biçim). Canlı sürüm
kalibrasyon kullandığı için adil karşılaştırma kalibre satırlar. Gol pazarlarında güven aralığı
hesaplanmadı.

## Dürüst yorum

- Dinamik model gol-DC'yi açık farkla geçiyor, ama bu kazancın neredeyse tamamı Elo'nun zaten
  getirdiği bilgi: DC+Elo'ya karşı fark anlamsız (CI 0'ı içeriyor), üstüne harmanlanınca
  −0,001…−0,002 — haftalık terfi eşiğinin (−0,003) altında.
- Anlamlı fark yalnız **canlı** Elo formülüne karşı var (−0,0035): Elo'yu λ düzeyine indirmek
  ~0,003 kaybettirmişti; dinamik model λ'ları doğrudan ürettiği için o kaybı vermiyor ve Ü/A'yı
  da biraz iyileştiriyor. Yani dinamik model, "DC + Elo yaması" yerine tek parça bir aday.
- İngiltere'de kanıt yok (her iki karşılaştırmada aralık 0'ı içeriyor ya da ters yönde).
- Aynı test kümesinde art arda dördüncü karşılaştırma; −0,0035 gibi küçük farklar için çoklu
  karşılaştırma payı bırakılmalı.
- Ham gol-DC'nin Ü/A log-loss'u yazı-turadan (0,6931) kötü; bu, kalibrasyonun neden canlıya
  alındığını doğruluyor, dinamik modelin üstünlüğünü değil.
- Value-bet ROI negatif kaldı.

## Karar: GEÇTİ (gol-DC'ye karşı) — canlıya alma ERTELENDİ

`dc-1.4-elo` gölgede yeni başladı ve aynı bilgiyi taşıyor. Önce onun 4 haftalık gölge sonucu
görülmeli. Elo gölgesi kapıdan geçerse dinamik model onun halefi olarak (ayrı sürüm, gol
pazarlarını da değiştirdiği için Ü/A–KG kapısıyla) denenebilir; servis tarafı kodu yazılmadı.

## Çalıştırma

```bash
python3 engine/backtest_dynamic.py --out /tmp/gate-dyn --dc-cache /tmp/dc-cache.json
python3 engine/backtest_dynamic.py --out /tmp/gate-dyn2 --dc-cache /tmp/dc-cache.json --history-seasons 2
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-dyn2/base.jsonl /tmp/gate-dyn2/dyn.jsonl
python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-dyn2/elo.jsonl /tmp/gate-dyn2/elodyn.jsonl
```
