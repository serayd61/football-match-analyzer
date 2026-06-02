# Tahmin Motoru v2 — Teknik Plan (Ajan Tabanlı, Model Temelli)

> Amaç: İkisi birden — (a) bahis oranına karşı **+EV value** bulan kalibre bir model,
> (b) kullanıcıya **açıklamalı içerik**. Orkestrasyon **n8n**, ağır hesap **Python FastAPI**,
> ambar **Supabase**, frontend **Next.js/Vercel**, LLM yalnızca **açıklama + QA/veto**.

## 0. Temel ilke
Sayısal model tahmini üretir; LLM açıklar ve denetler. "Doğru tahmin" değil,
**kalibre olasılık + orana karşı değer**, ve bunu **backtest ile ROI olarak kanıtlamak** hedef.

---

## 1. Bileşenler

| # | Bileşen | Teknoloji | Görev |
|---|---------|-----------|-------|
| 1 | Ingestion | Python (`soccerdata`, Sportmonks) | Tarihsel sonuç+oran (football-data.co.uk), canlı fikstür/kadro/oran |
| 2 | Feature store | Supabase tabloları | Elo, form, rolling xG/gol, dinlenme, H2H, ev/deplasman, oran-implied prob |
| 3 | Model | Python (Dixon-Coles + ML ensemble) | Skor matrisi → 1X2 / Ü-A 2.5 / KG olasılıkları |
| 4 | Kalibrasyon | Python (isotonic/Platt) | Olasılıkları gerçeğe oturt; **Brier score** |
| 5 | Value motoru | Python | model_prob > 1/oran → +EV işareti, Kelly stake önerisi |
| 6 | Backtest harness | Python | Geçmişe yürüt; ROI, isabet, kalibrasyon eğrisi, sharpe |
| 7 | Explainer Agent | LLM (Claude Haiku/Sonnet) | Sayıları TR/EN/DE açıklamaya çevirir |
| 8 | Critic/QA Agent | LLM | Eksik veri/eski kadro/çelişki → VETO (doğru "Ya Bil Ya Öl") |
| 9 | Settlement | Python/cron | Sonuç çek, settle, accuracy + kalibrasyon güncelle |
| 10 | Retrain | n8n schedule | Haftalık yeniden eğit/kalibre + performans raporu |

---

## 2. Veri kaynakları

| Kaynak | İçerik | Maliyet | Kullanım |
|--------|--------|---------|----------|
| **football-data.co.uk** (`soccerdata`) | 1993+ sonuç + kapanış oranları (çok bahisçi) | **Ücretsiz** | Backtest + eğitim (tarihsel) |
| **FBref** (`soccerdata`) | xG, şut, dizilişler (tarihsel) | Ücretsiz (scrape) | Feature zenginleştirme |
| **Sportmonks** (mevcut) | Canlı fikstür, kadro, skor | Mevcut plan | Üretim/canlı |
| **API-Football** (mevcut) | Sonuç doğrulama | Mevcut | Settlement yedeği |
| (opsiyonel) **The Odds API** | Canlı/açılış oranları | Ücretsiz tier ~500 req/ay | Canlı value |

> Kritik: backtest **kapanış oranına** karşı pozitif ROI çok zordur (verimli pazar).
> Gerçekçi edge genelde **açılış/yumuşak oranlarda** ve alt liglerde. Bunu rakamla göreceğiz.

---

## 3. n8n akış şeması (günlük üretim hattı)

```
        ┌──────────────────────── n8n: DAILY PIPELINE (örn. 08:00 & T-2h) ───────────────────────┐
        │                                                                                          │
 [Cron] → [HTTP: Sportmonks fixtures] → [HTTP: odds] → [Function: normalize]                       │
        │            │                                                                              │
        │            ▼                                                                              │
        │   [HTTP → Python /features]  (Elo/form/xG/rest/H2H + implied prob)                        │
        │            │                                                                              │
        │            ▼                                                                              │
        │   [HTTP → Python /predict]   (Dixon-Coles + ML → kalibre olasılıklar)                     │
        │            │                                                                              │
        │            ▼                                                                              │
        │   [HTTP → Python /value]     (+EV bahisler, Kelly stake)                                  │
        │            │                                                                              │
        │      ┌─────┴───────────────┐                                                              │
        │      ▼                     ▼                                                              │
        │ [LLM: Critic/QA]     [LLM: Explainer]   (veto + TR/EN/DE açıklama)                        │
        │      │  (veto?)            │                                                              │
        │      └─────┬───────────────┘                                                              │
        │            ▼                                                                              │
        │   [Supabase: upsert predictions]  →  [Webhook → Next.js revalidate]                       │
        └──────────────────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────── n8n: SETTLEMENT (saatlik) ──────────────────────────┐
 [Cron] → [HTTP: results] → [Function: settle] → [Supabase: update + accuracy/Brier]   │
        └────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────── n8n: RETRAIN (haftalık) ────────────────────────────┐
 [Cron] → [HTTP → Python /retrain] → [Python: backtest+recalibrate] → [Rapor: ROI/Brier]│
        └────────────────────────────────────────────────────────────────────────────┘
```

Python servisi (FastAPI) endpoint'leri: `/features`, `/predict`, `/value`, `/backtest`, `/retrain`, `/health`.

---

## 4. Faz planı + efor

| Faz | Kapsam | Çıktı | Efor (build oturumu) |
|-----|--------|-------|----------------------|
| **1** | Dikey dilim (1 lig): veri yükleyici + feature + Dixon-Coles + backtest + kalibrasyon | "Edge var mı?" → ROI/Brier raporu | 1–2 oturum kurulum + 1–2 ayar |
| **2** | Value motoru + Explainer + Critic ajanları + Supabase şeması | +EV işaretli, açıklamalı tahminler | 2–3 oturum |
| **3** | n8n hattı + çok lig + FastAPI servis + frontend entegrasyon | Canlı günlük üretim | 3–4 oturum |
| **4** | Haftalık otomatik retrain + performans paneli | Kendini güncelleyen sistem | 2 oturum |

> Not: Kodu hızlı iskeletleyebilirim; asıl zaman **veri tuhaflıkları + backtest doğruluğu + ayar**
> iterasyonunda geçer. Faz 1 sonunda gerçek karar verisi elde olur.

---

## 5. Aylık işletme maliyeti (tahmini)

| Kalem | Seçenek | Aylık |
|-------|---------|-------|
| Tarihsel veri | football-data.co.uk | **$0** |
| Python model servisi | Railway / Hetzner VPS | $5–20 |
| n8n | Self-host (aynı VPS) / n8n Cloud | $0 / ~$20–24 |
| LLM (Explainer+Critic) | Claude Haiku ağırlıklı, ~50 maç/gün | ~$10–40 |
| Supabase | Mevcut | $0 (mevcut) |
| Vercel | Mevcut Pro | mevcut |
| Sportmonks (canlı) | Mevcut plan | mevcut |
| **Ek toplam** | | **~$15–80 / ay** |

Tek seferlik: yok (açık kaynak kütüphaneler).

---

## 6. Riskler ve gerçekçi beklenti
- **Pazar verimli:** Kapanış oranını yenmek zor. Hedef = kalibrasyon + seçici value, körlemesine "isabet" değil.
- **Veri kalitesi:** scrape kaynakları (FBref) ara sıra kırılır → fallback + validasyon şart.
- **Aşırı uyum (overfit):** Sıkı zaman-bölmeli (walk-forward) backtest ile önlenir.
- **Süper Lig:** tarihsel oran verisi büyük 5 lig kadar zengin değil → önce EPL ile kanıtla.
- **Başarı ölçütü:** Faz 1'de pozitif/realist ROI veya en azından bahisçiyle yarışır Brier; çıkmazsa modeli/feature'ı revize ederiz (hype yok).

---

## 7. Önerilen ilk adım
**Faz 1 / Premier League:** football-data.co.uk'tan ~5 sezon, Dixon-Coles + walk-forward backtest,
çıktı = ROI + Brier + kalibrasyon raporu. Repo içinde `engine/` klasörü, production'a dokunmadan.
