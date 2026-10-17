# Biten maç derece kartı ve haftalık dersler — grade-1.0 (2026-10-16)

Kaynak: `src/lib/site/grade-rule.ts` (saf, testli), `grades.ts` (sunucu), `api/cron/match-grades`
(saatlik :50 + Pazartesi 05:30 `?lessons=1`), `supabase/migrations/20261016030000_site_match_grades.sql`,
karne sayfası bölümü "Haftalık dersler (gölge)", `tests/grade-rule.test.ts`.

## Neden

"Biten maçları hafızaya kaydet, derecelendir, gelecek haftanın tahminine taşı" isteği (2026-10-16).
Döngünün büyük kısmı zaten vardı: `settle-engine` (skor + Brier/LL), `fit-dc-models` (Salı yeniden
fit, yarı ömür 180 gün), `fit-calibration` (Pazartesi eğri), `engine-weekly-review` (hafta × lig ×
pazar metrikleri, sürüm karşılaştırması, öneriler). Eksik olan **maç bazında "kim haklıydı"** kaydı
ve bunun haftalık, insan okunur özeti. Kullanıcı kararı: dersler **kanıt katmanına, gölge olarak**
gider; model ya da seçimlere değil.

## Derece kartı (maç × pazar)

| Alan | Kaynak | Not |
|---|---|---|
| seçim, model p, isabet | `engine_predictions` resmî satırı + skor | ikili Brier / log-loss seçilen taraf |
| bahisçi favorisi, piyasa p, fark | `prediction_odds` **yalnız kickoff öncesi** en geç faz | sonrası yok sayılır (`preKickoffMarket`) |
| ayrışma çözümü | kod | `agree` / `model_right` / `market_right` / `both_wrong` |
| durum | `site_assessment_snapshots` **yalnız kickoff öncesi** | yoksa `status_source='none'`; bugünkü kuralla geriye dönük durum üretilmez |
| kovalar | `signal-buckets` seviye / fark | assess-1.0 ile aynı sınırlar |
| kodlar | `pick_hit/miss`, `market_fav_hit/miss`, `agree`, `disagree_*`, `over_edge`, `tight_market`, `status_hit/miss/missing`, `market_missing` | makine okunur |

Gol pazarlarında piyasa görüntüsü bu sürümde yok (ayrı goal book) → `market_missing`.

Tablo eklemeli ve değişmez (UPDATE/DELETE tetikleyicide yok sayılır); `(fixture_id, market,
rule_version)` tekil; cron `ignoreDuplicates` ile idempotent. Geçmişe dönük: cron son 14 günü
tarar (`?days=60`'a kadar); daha eski maçlar için durum zaten yok, piyasa varsa işlenir.

## Haftalık dersler

`weekLessons(kartlar, hafta)` → hücreler (pazar; pazar × durum; pazar × ayrışma; pazar × seviye;
pazar × fark; lig × pazar) her biri n, isabet, %95 Wilson, model ortalaması. Ders kodları
(yalnız n ≥ 20, `MIN_LESSON_N`):

| Kod | Koşul |
|---|---|
| `status_order_holds` | destekli isabet ≥ çelişkili isabet, iki kova da ≥ 20 |
| `status_order_inverted` | çelişkili Wilson alt > destekli Wilson üst |
| `disagreements_market_led` / `_model_led` | karar verilen ayrışmalarda Wilson aralığı 0,5'i dışlıyor |
| `level_overconfident` / `_underconfident` | seviye kovasında Wilson üst < kova tabanı / alt > kova tavanı |
| `over_edge_not_paying` | model ≥ +5 puan üstteyken Wilson üst < model ortalaması |

Yazım: `engine_learning_log` (layer `review`, action `report`, actor `cron:match-grades`, subject
`grade-1.0/2026-W42`, evidence = özet) — hafta başına bir kez. Karne sayfası bu kaydı okur,
yeniden hesaplamaz.

## Ne DEĞİŞMEZ

Seçimler, /picks, vitrin, model fit'i, kalibrasyon ve assess-1.0 kuralı. Dersler `validation:
'exploratory'`. Kurala girmesi: ayrı sürüm (assess-1.1), ≥ 4 haftalık gölge karne, PR ile.

## Sınırlar

- Durum kapsamı `site_assessment_snapshots` doluluğuna bağlıdır (migration `20261016020000`
  prod'da uygulanana kadar `status_source='none'`); `statusCoverage` raporda görünür.
- Piyasa kapsamı `prediction_odds` ile sınırlı (13 Ağu 2026'dan).
- Ders eşikleri başlangıç seçimi; haftalık gürültü yüksek, tek hafta karar gerekçesi değildir.

## Prod'a alma (kullanıcı)

1. `supabase/migrations/20261016030000_site_match_grades.sql` SQL editöründe.
2. Vercel cron'lar `vercel.json` ile deploy'da gelir; ilk tur `?preview=1&days=30` ile sayım.
3. İlk ders kaydı bir sonraki Pazartesi 05:30; elle `?lessons=1&week=2026-W42`.
