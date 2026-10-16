# Geçmiş kanıt analizi ajanı — evidence-1.0 (2026-10-16)

Kaynak: `src/lib/site/evidence-rule.ts` (saf kural, testli), `evidence.ts` (sunucu veri yolu),
`src/components/site/Evidence.tsx` (maç sayfası bölümü), `src/app/api/site/evidence/[fixtureId]/route.ts`
(üye API'si), `tests/evidence-rule.test.ts`.

## Ne yapar, ne yapmaz

Bir maç için **doğrulanmış mevcut veriyi** toplar, **geçmişten karşılaştırılabilir kanıt** bulur,
istatistikleri **deterministik kodla** hesaplar ve model / kalibrasyon / piyasa / geçmiş kanıt
arasındaki uyumu pazar başına **bulgu kodlarıyla** açıklar. Veri yetersizse bunu söyler.

- Mevcut modelin yerine geçmez; yeni olasılık üretmez, harmanlamaz.
- Durumu (`supported / conflicting / insufficient`) **değiştirmez**: durum assess-1.0'dan gelir
  (`docs/assessment-rules.md`), bu rapor onu açıklar.
- Hiçbir seçimi, motor çıktısını ya da karneyi yazmaz (salt okunur).
- **İlk sürümde LLM yoktur.** Rapordaki her sayı ve her cümle kod + i18n metnidir. Anlatı katmanı
  istenirse yalnız bu rapor üzerinden, şema doğrulamalı ve sayısız yazılır; rapor onsuz çalışır.

## Gerçekten kullanılabilen veri (2026-10-16 doğrulaması)

| Veri | Kaynak | Maç-öncesi damga | Durum |
|---|---|---|---|
| Dixon-Coles 1X2, λ, Ü2,5, KG | `engine_predictions` (resmî sürüm `dc-1.0`) | tahmin yalnız ileriki maç için yazılır; `engine_prediction_history.issued_at` kesin damga | üretim; 12.7k sonuçlanmış maç (Haziran 2026'dan) |
| Kalibre olasılık | `confidence_calibration` izotonik eğri | eğri `fitted_at` | üretim; eğri yoksa ham etiketi |
| Piyasa (marjsız p, gerçek oran) | `prediction_odds` | `captured_at`, faz | üretim; 13 Ağu 2026'dan, ~2.5k satır |
| Sinyal karnesi | `performance.ts` kovaları → assess-1.0 | sonuçlanmış satırlar | keşifsel (kova sınırları geçmiş veride bulundu) |
| xG | `dc-2.0-xg` gölge sürüm, `engine/features.py` | — | **canlı değil**, geçmiş maç başına damgalı kayıt yok → "hesaplanamıyor" |
| Elo | `engine/features_elo.py`, haftalık snapshot deneyi | — | **araştırma**, tabloda yok → "hesaplanamıyor" |
| Eksikler / kadro | `af_fixture_context` (API-Football) | `injuries_at`, `lineups_at` | üretim, yalnız eşlenen ligler; bu raporda kullanılmaz (sayfanın kendi bölümü) |

Erişim: maç sayfası ve API aynı kapıdan (`getSiteAccess` + `canSeeMatches`; örnek maç herkese). Rapor
istemciye yalnız yetkili istekte gider; CSS ile gizlenmez.

## Kanıt grupları

**A. Takımın kendi geçmişi** — ev sahibinin iç saha maçları, deplasmanın dış saha maçları (havuzdan,
`home_id` / `away_id` eşleşmesi). 10 maçın altı **ince**: oran gösterilmez, `own_*_thin` bulgusu.
"Benzer rakip gücü" filtresi ilk sürümde yok (örneklem zaten ince).

**B. Karşılaştırılabilir maçlar** — modelin maç-öncesi λ uzayında en yakın komşular (`similarMatches`):

| Parametre | Değer | Neden |
|---|---|---|
| özellikler | `lambdaHome`, `lambdaAway` | elimizdeki tek gerçek maç-öncesi özellik; p'ler λ'dan türer |
| ölçek | havuzun (asOf öncesi) standart sapması | gelecekteki veri ölçeklemeye girmez |
| yarıçap | 0,35 z | başlangıç seçimi; keşifsel |
| k | 50 | |
| alt sınır | 20 | assess-1.0 `MIN_SUPPORT_N` ile aynı |
| kapsam | önce lig; yarıçap içinde < 20 aday varsa **tüm ligler** (raporda söylenir) | Eredivisie'de 64 sonuçlanmış maç var |
| pencere | 365 gün | |
| sıralama | (uzaklık, fixtureId) | deterministik |

**Dürüst adlandırma:** komşular modelin kendi λ'sıyla seçildiği için "benzer maçlarda gerçekleşme
oranı" aslında **modelin kendi kalibrasyonunun bir kontrolüdür**. Kalibrasyon eğrisi ve kova kaydıyla
örtüşen kanıttır; üç bağımsız oy değildir. Her grup için modelin o gruptaki ortalama olasılığı da
gerçekleşmenin yanında gösterilir.

**C. Sinyal karnesi** — assess-1.0 çıktısı olduğu gibi (kayıt, piyasa bayrağı, durum).

Kesişim: A ve B'de ortak fixture sayısı `overlap` ile raporlanır; yüzdeler toplanmaz, ortalanmaz.

## Analiz zamanı (asOf)

Gerçek sınırdır: havuza yalnız `kickoff < asOf` **ve** `settled_at ≤ asOf` (yoksa `kickoff + 3 sa`)
satırlar girer; maçın kendisi dışlanır. Piyasa görüntüsü `captured_at > asOf` ise karşılaştırmaya girmez
(`market_after_asof`). Hedefin λ/p'si asOf'tan sonra yazılmışsa `features.afterAsOf=true` uyarısı.
Gelecek asOf şimdiye kırpılır. İlk sürüm sınırı: hedefin özellikleri geçmiş asOf için history
tablosundan değil güncel satırdan gelir (uyarıyla); sıkı retrospektif ölçüm `engine_prediction_history`
ile ayrı iş.

## Hesaplar

Her grup: n, tarih aralığı, 1/X/2 dağılımı, Ü/A 2,5 ve KG dağılımı, seçilen taraf için **%95 Wilson
aralığı** (`assessment.ts wilson`), modelin gruptaki ortalama p'si. Ağırlıksız; ağırlıklı istatistik
yok (etkin örneklem sorunu). Komşu uzaklıkları ayrıca listelenir.

Bulgu kodları (pazar başına, makine okunur): `similar_insufficient | similar_agrees | similar_below |
similar_above` (model p Wilson aralığına göre), `own_home_thin | own_away_thin`, `market_missing |
market_after_asof | market_agrees | market_above | market_below` (±5 puan, risk.ts `OVER_EDGE`),
`calibration_missing`. Eksikler: `xg/not_live`, `elo/no_history`, `market/none|after_asof`,
`calibration/no_curve`, `similar/insufficient`, `own_home|own_away/thin`, `league_scope/fallback_all`.

## Önbellek ve sınırlar

Havuz süreç belleğinde 30 dk (`asOf` günü anahtarı); `unstable_cache` kullanılmadı (12k+ satır,
2 MB sınırı). Rapor her istekte saf koddan yeniden kurulur. Havuz 40k satırda kırpılır (`pool.truncated`).
API: `GET /api/site/evidence/{fixtureId}?asOf=` — üye kapısı, Redis rate limit (30/dk, pro 60), `no-store`.

## Doğrulama

`tests/evidence-rule.test.ts` (12 test): asOf sınırı, kendi maçı dışlama, komşunun kendi λ'sı,
yetersiz örneklem, xG/Elo uydurulmaz, örtüşme, kalibrasyon etiketi, model–piyasa çelişkisi,
piyasa asOf, determinizm, uyuşma/altında. Test havuzu **sentetiktir**; gerçek maç sonucu değildir.
Uçtan uca: Telstar–Feyenoord (fixture 5781774, 17 Eki 2026) ile maç sayfasında.
