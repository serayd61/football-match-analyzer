# Ortak değerlendirme — assess-1.0 (2026-10-16)

Kaynak: `src/lib/site/assessment.ts` (saf kural), `assess.ts` (sunucu veri yolu),
`assessment-snapshot-rule.ts` + `assessment-snapshots.ts` (gölge kayıt),
`supabase/migrations/20261016020000_site_assessment_snapshots.sql`.

## Neden

Aynı maç için bir yerde "%74 güven / önerilen tahmin", başka yerde "benzer seçimler %24
tuttu" görülüyordu. Üç sinyal farklı şeyleri ölçer:

| Sinyal | Ne | Kaynak |
|---|---|---|
| Model p | Bu maçın olasılığı (ham Dixon-Coles) | `engine_predictions` |
| Kalibre p | Ham değerin geçmişte ne teslim ettiği (izotonik eğri) | `confidence_calibration` |
| Piyasa p | Bahisçinin marjsız fiyatı | `prediction_odds` (en geç faz) |
| Kayıt | Aynı kovaya düşen geçmiş seçimlerimizin isabeti | `performance.ts` sinyal karnesi / sicil dilimleri |

Kalibre p ve kayıt aynı sonuçlanmış satırlardan türer → **örtüşen kanıt**, ikisi
bağımsız oy gibi toplanmaz. Kayıt yalnız durum belirler; kalibre p gösterim değeridir.

## Durumlar (kanıt etiketi, kazanma olasılığı değil)

| Durum | Koşul |
|---|---|
| `conflicting` | piyasa bayrağı `disagree` / `over` (risk.ts ile birebir; gol pazarında ham < %50 ya da ham − piyasa ≥ +5) **veya** kayıt Wilson üst sınırı hem güçlü eşiğin hem model p'nin altında |
| `supported` | yukarıdakiler yok, piyasa sıkı değil, kayıt Wilson alt sınırı ≥ güçlü eşiği (1X2 %55, gol %65) ve n ≥ 20 |
| `insufficient` | geri kalan her şey: kova < 10 maç, aralık kararsız, kayıt yok, piyasa sıkı (favori < %45) |

Öncelik deterministik: bayrak > kayıt çelişkisi > sıkı piyasa > kayıt desteği > yetersiz.
Yüksek kalibre güven bir çelişkiyi `supported`'a çeviremez. Eksik piyasa tek başına ret
değildir (`market_missing` gerekçesi; 1X2 seviye kovasına düşer). Pazarlar bağımsızdır.

## Eşik gerekçesi

- `STRONG_ACC`, `MIN_EVIDENCE` (10): projenin mevcut "güçlü" tanımı, değiştirilmedi.
- Nokta isabet yerine **%95 Wilson alt sınırı**: 9/10 gibi küçük parlak örneklem artık
  "destekli" değil. Destek için `MIN_SUPPORT_N = 20` (kapsam bant kuralı `bandFor` ile aynı
  alt sınır). Aralık yalnız belirsizlik ölçüsüdür; avantaj/kârlılık kanıtı sayılmaz.
- Kova sınırları (fark ±5/±10, seviye dilimleri) 12 Eyl 2026 backtest'inde geçmiş veride
  bulundu → çıktı `validation: 'exploratory'`. İleriye dönük ölçüm gölge kayıttan gelecek.

## Gerekçe kodları

`market_disagrees`, `market_above`, `market_tight`, `market_missing`, `market_stale` (>24 s),
`record_supports`, `record_contradicts`, `record_uncertain`, `record_thin`, `record_missing`,
`calibration_missing` (eğri yoksa gösterilen değer ham; UI "ham" etiketi basar).

## Ekranlar

Maç detayı üst kartı, tahmin listesi satır çipi (1X2), dashboard "Model–piyasa ayrışmaları"
(eski value radar; yalnız modelin kendi seçimleri, pozitif fark yeşil değil), /picks satır
çipi. Hepsi `assessRows` / `assessWithDeps` üzerinden aynı girdiyi aynı kuraldan geçirir.
/picks üyeliği ve sıralaması (`standing-1.0`), günün seçimi, vitrin ve öneri karneleri
**değişmedi**; strateji değişikliği gerekirse ayrı sürümlenir.

## Gölge kayıt

`site_assessment_snapshots`: `(fixture_id, market, rule_version)` tekil, `assessed_at <
kickoff` zorunlu, UPDATE/DELETE tetikleyiciyle yok sayılır. Yazan: `cron/standing-picks`
(:45) aynı turda, başlamaya ≤180 dk kala, `ignoreDuplicates` ile (ilk yazan kalır). Tüm
durumlar kaydedilir. Skor sonradan `engine_predictions`'tan eşlenir
(`?assessment=history&days=N`, keşifsel). Geçmiş günlere bugünkü kuralla kayıt üretilmez.

## İstihbarat satırı (2026-10-16, engine_intel)

Kartın başlığının hemen altında, pazar satırlarından **önce** gelen ayrı blok (Claude turuncusu `--s-claude` rozetli; 2026-10-16 geri bildirimi: altta kalıyordu): `src/lib/site/intel.ts` (okuyucu, 5 dk önbellek) →
`intel-view.ts` (saf görünüm, testli) → `Assessment.tsx` `IntelBlock`. Kaynak `engine_intel`
(`engine/intel_agent.py`): motorun çıpa olasılığı + Claude'un web aramasıyla bulduğu İSİMLİ
faktörler (sakat/ceza/rotasyon…), sapma kodda kırpılmış (faktör başına ≤ ±0,08).

Kurallar:
- **Durumu değiştirmez.** `supported / conflicting / insufficient` yalnız assess-1.0'dan gelir;
  istihbarat satırı bilgi katmanıdır. Katkısı `engine_intel` settle karnesinde ölçülür
  (baseline vs final Brier, kapı ≥200 maç); ölçüm geçmeden kurala girmez.
- **LLM serbest metni yok:** faktör başlığı, kategori, taraf, sapma (puan), kaynak (alan adı +
  bağlantı), tarih. `reason`/`narrative` alanları siteye taşınmaz.
- Aynı maçta birden çok analiz (model karşılaştırması `intel-1.0` / `intel-1.0-haiku`) varsa
  **en son kickoff-öncesi** analiz gösterilir; `issued_after_kickoff=true` satır gizlenir.
- Sapma yoksa blok yine gösterilir: "isimli etken bulunmadı" — tarandığı bilgisi de değerlidir.
- Yalnız üye sayfasında; örnek maç ziyaretçisine (`publicSample`) gösterilmez. Public/SEO
  yüzeylerine girmez ("istatistiksel model" dili korunur).
- Rozet: "Claude ile kontrol edildi" (4 dil, `assessment.intel.*`).
