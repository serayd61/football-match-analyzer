# Veritabanı şeması (Supabase)

## Klasörler

| Klasör | İçerik | Nasıl kullanılır |
|---|---|---|
| `migrations/` | **Tek geçerli sıra.** Supabase CLI adlandırması `YYYYMMDDHHMMSS_ad.sql`. Hepsi tekrar çalıştırılabilir (`if not exists`, `or replace`, `drop … if exists`). | Yeni şema değişikliği her zaman buraya, yeni bir zaman damgasıyla. |
| `queries/` | Salt okuma kontrol sorguları. `migration_status.sql` hangi migration'ın canlıda uygulandığını gösterir. | SQL editöründe serbestçe çalıştırılabilir. |
| `legacy/` | 2026-09 öncesi dağınık şema dosyaları (eski ajan/konsensüs sistemi, n8n view'ları, ilk `engine_predictions`). `legacy/app/` eski `src/lib/supabase/migrations`. | Tarihçe/başvuru. Yeniden çalıştırma — sıraları ve canlıyla uyumları bilinmiyor. |
| `legacy/oneoff/` | **Yıkıcı** tek seferlik betikler (`delete_*`, `populate_*`, `migrate_*`). | Çalıştırma. Yalnız geçmiş kayıt için saklanıyor. |

## Bilinen açık: canlı şemanın bir kısmı repoda yok

Kodun kullandığı şu tabloların `CREATE` ifadesi repoda hiçbir yerde yok; yalnız canlı
veritabanında var. Veritabanı bu repodan sıfırdan kurulamaz:

`users`, `subscriptions`, `profiles`, `password_reset_tokens`, `email_unsubscribes`,
`email_campaign_log`, `prediction_odds`, `confidence_calibration`,
`confidence_performance`, `league_catalog`, `predictions`, `model_comparison`,
`ip_tracking`, `user_analysis_history` · RPC: `engine_proof_summary`,
`increment_daily_predictions`.

`tests/migrations.test.ts` bu listeyi dondurur: koda **yeni** bir tablo eklenip
migration'ı yazılmazsa test kırılır.

**Kapatmak için (bir kez, bilgisayarında):**

```bash
npm i -g supabase
supabase login
supabase link --project-ref njrpxhmdqadejjarizmj
# 1) canlı şemanın tam dökümünü baseline olarak al (veri değil, yalnız şema)
supabase db dump --schema public -f supabase/migrations/20260101000000_baseline.sql
# 2) canlıda zaten var olanları "uygulandı" olarak işaretle (hiçbir SQL çalıştırmaz)
supabase migration repair --status applied 20260101000000
#    + queries/migration_status.sql çıktısında applied=true olan her sürüm için aynısı
# 3) kontrol
supabase migration list
```

Ardından `tests/migrations.test.ts` içindeki `KNOWN_UNDECLARED` listesi boşaltılabilir.

## Denetimde işaretlenen, uygulanıp uygulanmadığı bilinmeyenler

`20260905020000_engine_prediction_history` (tetikleyici) ve
`20260905010000_confidence_calibration_holdout` (sütunlar) — `queries/migration_status.sql`
ile kontrol et; `applied=false` ise dosyayı SQL editöründe çalıştır.
