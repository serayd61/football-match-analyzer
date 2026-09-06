# Metodoloji — katmanlar, formüller, seçilmiş sabitler

## 1. Çekirdek: zaman-ağırlıklı Dixon-Coles (çarpımsal)

```
λ_home = base · A_home · D_away · H        λ_away = base · A_away · D_home
w_k    = exp(−ln2 · yaş_gün / 180)         (yarı-ömür 180 g, pencere 540 g)
A,D    : sabit-nokta MLE, ortalama 1'e normalize (kimliklenebilirlik), base ölçeği taşır
P(i,j) = Pois(i;λ_h)·Pois(j;λ_a)·τ(i,j)    τ: DC düşük-skor düzeltmesi, ρ = −0.10 sabit
```
1X2 / Ü-A 2.5 / KG skor ızgarasından (0–10 gol) toplanır; λ [0.05, 6] kırpılır.
Yol B (TS) toplamsal eşdeğeri: `attack_i = ln A_i + ½ ln base`, `defense_i = ln D_i + ½ ln base`,
`homeAdv = ln H`, parite Δ≈1e-16 (`publish_xg.py`).

Bilinen sınırlar: ρ tek sabit (lige/sezona göre −0.05…−0.15 değişir; global beraberlik
oranı için ρ'yu kurcalama — beraberlik hatası "yakınlığa" bağlıdır); ev avantajı tek sayı
(2020 sonrası düşüş, lig-başı); yeni çıkan takım depoda yoksa maç atlanır (kapsam kaybı).

## 2. xG hedefi (GEÇTİ)

Atak/defans hedefi `(1−w)·gol + w·xG`, w=0.75. xG gürültüyü (şans, kaleci) azaltır; fit
değişmez, predict değişmez. xG eksikse o maç gole düşer. Kaynak Understat (top-5 lig);
`features.canon()` ile %100 ad eşleme şartı.

## 3. Elo harmanı (GEÇTİ, küçük)

```
sup = clamp(a·(elo_h − elo_a) + b, ±2.5)   λ_h = (total+sup)/2, λ_a = (total−sup)/2
p = (1−λ)·p_xgDC + λ·p_Elo                   (yalnız 1X2; Ü/A, KG DC'den)
```
Lig sabitleri `scoreboard.md §3`. Elo snapshot'ı maç öncesi Pazartesi (point-in-time).
Elo'nun kattığı: kupa/Avrupa formu, uzun hafıza, piyasa-benzeri kalibrasyon.

## 4. Kalibrasyon (izotonik)

`confidence_calibration`: (güven x, tuttu y) çiftlerinden PAVA ile monoton eğri, ≤40 knot,
n≥30. Segment `covered` tercih (doğru rejim), `all` yedek; `ou25`/`btts` ayrı. Eğri yalnız
**gösterilen güveni** düzeltir, argmax'ı (pick) değiştirmez. Holdout: kronolojik %20,
`brier_holdout_before/after`. Walk-forward kovaları performans sayfasında (önceki aylar).
Kural: eğri elle ayarlanmaz; örneklem büyüyünce kendini düzeltir.

## 5. Piyasa: benchmark, harman ve edge — üç ayrı kavram

| Kavram | Formül | Nerede |
|---|---|---|
| De-vig | multiplicative `q_i/Σq` veya Shin (favori-longshot düzeltir) | `src/lib/odds/devig.ts`; `betting` skill `devig` |
| Benchmark | Pinnacle kapanış de-vig olasılığı → aynı satırlarda bahisçi Brier/isabet | `engine/backtest.py`, `site/roi.ts` |
| Value bet / ROI | `p_model·oran − 1 > eşik(0.05)` → düz 1 birim; ROI = kâr/yatırılan | backtest'ler; canlı `performance.ts` açılış/kapanış ayrı |
| CLV (closing line value) | `oran_alınan / oran_kapanış − 1` (ya da de-vig olasılık farkı); pozitif CLV ROI'den az gürültülü edge kanıtı | `prediction_odds` opening vs closing ile ölçülebilir — **roadmap** |
| Kelly | `f* = (p·o − 1)/(o − 1)`; yarım/çeyrek Kelly | `betting` skill |
| Harman | `p = (1−w)·p_DC + w·p_market`, w≈0.7 | `src/lib/odds/blend.ts`; yalnız Yol B |

Kural: **bağımsız model** (edge ölçümü, karne) ile **harman** (en iyi kalibre yayın) ayrı
`model_version` taşır. Public site'ın hangisini "resmi" göstereceği `SITE_MODEL_VERSION` ile
seçilir; iki sürüm aynı fixture'da tek resmi kayıt kuralı `official.ts`'de.

## 6. Ölçüm tanımları (hepsi 3-sınıf, düşük = iyi)

- Brier: `Σ_o (p_o − y_o)²` (0 mükemmel, 2 en kötü). Log-loss: `−ln p_gerçek` (rastgele 1.099).
- ECE: 10 güven kovasında |ortalama güven − isabet| ağırlıklı ortalaması.
- Reliability: Elo-farkı ya da güven kovası başına gerçek vs tahmin frekansı
  (`calibrate_backtest.py` bunu basar).
- Kapı: Δlog-loss ve ΔBrier paired bootstrap %95 aralığı 0'ı dışlamalı VEYA 5 ligde aynı
  yönde olmalı (küçük tutarlı kazanım kabul, tek ligde büyük kazanım şüpheli).

## 7. LLM katmanı (yalnız dashboard/legacy)

Çıpa = kayıtlı bağımsız olasılık; sapma yalnız isimli bilgiyle, ≤ ±0.08/faktör, toplam
yeniden normalize; `baseline` ve `final` ayrı saklanır ki AI-vs-baseline Brier ölçülsün.
Ayrıntı `match-analysis.md`. Public site LLM çıktısı göstermez (karar 2026-09-04).

## 8. Dış referans (uluslararası, `football-match-forecasting` skill'i)

Elo→gol: `goalDiff = (Δelo/100)·COEFF`, COEFF≈0.45 (0.32 favoriyi ezer), toplam gol 2.5;
Elo + atak/defans ensemble 50/50 ortalaması tek modeli özellikle beraberlik/sürprizde geçer.
Bizde eşdeğer yapı zaten var (xG-DC + Elo harmanı); katsayıları kendi Elo kaynağına göre
yeniden kalibre et, doğrudan kopyalama.
