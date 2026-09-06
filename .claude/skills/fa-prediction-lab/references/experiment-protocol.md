# Deney protokolü — bir özellik canlıya nasıl girer

## 0. Soru cümlesi
Tek cümle: "X eklenirse, canlı modele göre walk-forward log-loss 5 ligde düşer mi?"
Cevap evet/hayır + aralık olmalı. Soru ROI ile başlıyorsa önce log-loss'a çevir.

## 1. Kurulum
- **Baseline = canlıdaki model** (bugün `dc-1.0`: `engine/model.py`, FotMob deposu). Backtest'te
  eşdeğeri `engine/backtest.py` (FD.co.uk verisi). Aday, baseline koduna **parametreyle**
  eklenir; parametre 0 iken baseline'a birebir eşit olduğunu kanıtla (`xg_weight=0`,
  `λ=0`, `beta=0` deseni — "kapı sağlaması").
- Veri: football-data.co.uk 2019→güncel, test `2122`+ (ya da son 3 sezon); 5 lig
  E0/SP1/I1/D1/F1; ek lig eklenecekse N1/P1/T1.
- Walk-forward: her maç için `ref_date = maç tarihi`, fit yalnız öncesi; aynı gün tek fit
  (`fit_cache`). Snapshot özellikler (Elo, sakat, kadro) maç öncesi tarihli.
- Parametre taraması test setinde yapılırsa **seçim yanlılığı** var: en iyi değeri değil,
  "makul plato"yu al (xG'de 0.75, Elo'da lig-başı λ'nın mütevazı hâli) ve bunu raporda yaz.

## 2. Çıktı dosyası
Her maç için JSONL satırı (baseline ve aday ayrı dosya, **aynı sırada, aynı n**):
```json
{"league":"E0","date":"2023-10-01","home":"Arsenal","away":"Bournemouth",
 "p_home":0.71,"p_draw":0.18,"p_away":0.11,"result":"H",
 "odds_home":1.30,"odds_draw":5.5,"odds_away":10.0}
```
`scripts/gate.py baseline.jsonl candidate.jsonl` → n, isabet, Brier, log-loss, ECE,
Δ + bootstrap %95 aralığı (eşleştirilmiş), value-bet ROI (EV>5%) ve bahisçi benchmark,
lig-başı tablo, KARAR satırı.

## 3. Karar kuralı
- GEÇTİ: Δlog-loss < 0 ve ΔBrier < 0, 5/5 ligde (4/5 + toplam aralık 0'ı dışlıyorsa kabul).
- ROI tek başına karar vermez; pozitif ROI iddiası için bahis n≥500 ve aralık.
- DÜŞTÜ: bir ligde bile belirgin kötüleşme (+0.003'ten büyük) ve toplam kazanç yok.
- Kalibrasyon kötüleşirse (ECE ↑) izotonik eğrinin toparlayıp toparlamadığına bakma;
  önce modeli düzelt.

## 4. Rapor şablonu (`reports/backtest-<özellik>.md`)
```
# <Özellik> backtest — <tarih>
Baseline: <model_version + komut>  Aday: <parametre>  Veri: <ligler, sezonlar>  Test: <sezon>+
## Yöntem (3–6 satır: formül, sızıntı önlemi, tarama)
## Sonuç tablosu (lig | n | LL base→aday | Δ [%95 CI] | Brier Δ | ECE | ROI base→aday)
## Dürüst yorum (ne iyileşti, ne bozuldu, neden; seçim yanlılığı notu)
## Karar: GEÇTİ / DÜŞTÜ — canlıya alma planı veya "kod referans olarak kalıyor"
## Çalıştırma komutu
```
Sonra `scoreboard.md`'ye satır ekle.

## 5. Canlıya alma (üretim yazımı → kullanıcı onayı)
1. `MODEL_VERSION` yükselt (örn. `dc-2.0-xg`); `engine_predictions` unique (fixture, version)
   olduğundan eski satırlar kalır, karşılaştırma mümkün.
2. `SITE_MODEL_VERSION` ile resmi sürümü seç (yoksa en son `updated_at` kazanır — geçişte
   iki sürüm karışmasın diye pin'le).
3. `engine_prediction_history` yayın kaydını tutar; `issued_after_kickoff` bayrağı.
4. İlk 300 sonuçlanmış maçtan sonra `performance.ts` karnesini eski sürümle yan yana oku;
   kalibrasyon eğrisi `covered` segmentini yeni sürümle yeniden fit eder (haftalık).
5. Kapsam: yeni özellik bir ligde kaynak eşlemesi %100 değilse o lig baseline'da kalır
   (publish_xg deseni).

## 6. Sık hatalar
- Test setinde tarayıp aynı sette raporlamak (aralık ve plato notu ile telafi).
- Kickoff sonrası tahmin satırı (ingest reddeder; geçmişte 249 satır var — karneden düş).
- Oran kaynağı karışıklığı: PSC (kapanış) vs PS (açılış) vs B365; benchmark daima kapanış.
- Ad eşleme kaçağı: eşleşmeyen takım sessizce λ=1.0 ile tahmin edilir → kapsamı logla.
- Küçük n'de "sinyal": <1000 test maçı/lig ise sonuç "ön bulgu".
