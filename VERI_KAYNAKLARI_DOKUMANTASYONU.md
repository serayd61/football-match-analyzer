# 📊 Agent Analysis Veri Kaynakları Dokümantasyonu

## 🔍 Bu Analiz Hangi Verilerden Oluşuyor?

Gönderdiğiniz analiz sonucuna göre, veriler şu kaynaklardan geliyor:

---

## 1️⃣ **STATS AGENT (İstatistik Analiz Ajanı)**

### Veri Kaynakları:

#### ✅ **Form Verileri** (Sportmonks)
- **Kaynak:** `getTeamStats()` → Sportmonks API
- **Veriler:**
  - Son 5 maç formu (W/D/L)
  - Form puanları (W=3, D=1, L=0)
  - Ev sahibi: 13p (form grafiği)
  - Deplasman: 17p (form grafiği)
- **Kod:** `src/lib/sportmonks/index.ts` → `getTeamStats()`

#### ✅ **Gol İstatistikleri** (Sportmonks)
- **Kaynak:** `getTeamStats()` → Sportmonks API
- **Veriler:**
  - Ortalama atılan goller: `avgGoalsScored`
  - Ortalama yenilen goller: `avgGoalsConceded`
  - Ev sahibi: 1.35 gol atıyor, 1.55 gol yiyor
  - Deplasman: 1.55 gol atıyor, 1.35 gol yiyor
- **Hesaplama:** Son 10 maç ortalaması

#### ✅ **xG (Expected Goals) Analizi** (Sportmonks + Hesaplama)
- **Kaynak:** 
  - `getTeamXG()` → Sportmonks API (varsa)
  - Yoksa: Form verilerinden tahmin edilir
- **Veriler:**
  - `homeXG: 1.29` (Norwich City'nin beklenen golü)
  - `awayXG: 1.47` (Watford'un beklenen golü)
  - `totalXG: 2.76` (toplam beklenen gol)
- **Kod:** `src/lib/football-intelligence/xg-provider.ts`

#### ✅ **Timing Patterns (Zamanlama Paternleri)** (Sportmonks Recent Matches)
- **Kaynak:** `getTeamRecentMatches()` → Sportmonks API
- **Veriler:**
  - İlk yarı gol yüzdesi: %45 (her iki takım)
  - İkinci yarı gol yüzdesi: %55 (her iki takım)
  - Son 15 dakika gol yüzdesi: %20 (her iki takım)
- **Hesaplama:** Son 10 maçın skorlarından hesaplanır
- **Kod:** `src/lib/agent-analyzer/index.ts` → `analyzeTimingPatterns()`

#### ✅ **Clean Sheet Analizi** (Sportmonks Recent Matches)
- **Kaynak:** `getTeamRecentMatches()` → Sportmonks API
- **Veriler:**
  - Clean sheet serisi: 0 (her iki takım)
  - Clean sheet yüzdesi: %20 (her iki takım)
  - Gol atamama sayısı: 0 (her iki takım)
- **Hesaplama:** Son 10 maçın skorlarından hesaplanır
- **Kod:** `src/lib/agent-analyzer/index.ts` → `analyzeCleanSheets()`

#### ✅ **Expected Goals (Beklenen Goller)** (Hesaplama)
- **Kaynak:** Form verilerinden hesaplanır
- **Formül:**
  - `homeExpected = (homeGoalsScored + awayGoalsConceded) / 2`
  - `awayExpected = (awayGoalsScored + homeGoalsConceded) / 2`
- **Veriler:**
  - `homeExpected: 1.35`
  - `awayExpected: 1.55`
  - `expectedTotal: 2.90`
- **Kod:** `src/lib/heurist/agents/stats.ts` → `runStatsAgent()`

#### ✅ **Goals Conceded Expectation (Gol Yeme Beklentisi)** (Hesaplama)
- **Kaynak:** Form verilerinden hesaplanır
- **Formül:**
  - `homeConcededExpected = (homeGoalsConceded + awayGoalsScored) / 2`
  - `awayConcededExpected = (awayGoalsConceded + homeGoalsScored) / 2`
- **Veriler:**
  - `homeConcededExpected: 1.55`
  - `awayConcededExpected: 1.35`
- **Kod:** `src/lib/heurist/agents/stats.ts` → `runStatsAgent()`

#### ✅ **Over 2.5 / BTTS Yüzdeleri** (Sportmonks)
- **Kaynak:** `getTeamStats()` → Sportmonks API
- **Veriler:**
  - `avgOver25: 50%` (ortalama)
  - `avgBtts: 80%` (ortalama)
- **Hesaplama:** Ev sahibi, deplasman ve H2H yüzdelerinin ortalaması

---

## 2️⃣ **ODDS AGENT (Oran Analiz Ajanı)**

### Veri Kaynakları:

#### ✅ **Bahis Oranları** (Sportmonks)
- **Kaynak:** `getPreMatchOdds()` → Sportmonks API
- **Veriler:**
  - `homeImplied: 50%` (Ev oranından hesaplanan olasılık)
  - `awayImplied: 40%` (Deplasman oranından hesaplanan olasılık)
  - `overImplied: 53%` (Over 2.5 oranından)
  - `bttsYesImplied: 56%` (BTTS Evet oranından)
- **Kod:** `src/lib/sportmonks/index.ts` → `getPreMatchOdds()`

#### ✅ **Form Olasılıkları** (Stats Agent'tan)
- **Kaynak:** Stats Agent'ın hesapladığı form verileri
- **Veriler:**
  - `homeFormProb: 30%` (Form analizine göre ev kazanma olasılığı)
  - `awayFormProb: 41%` (Form analizine göre deplasman kazanma olasılığı)
  - `overProb: 50%` (Over 2.5 olasılığı)
  - `bttsProb: 53%` (BTTS olasılığı)

#### ✅ **Value Hesaplamaları** (Hesaplama)
- **Kaynak:** Oranlar ve form verilerinden hesaplanır
- **Formül:**
  - `value = formProb - impliedProb`
  - Örnek: `awayValue = 41% - 40% = +1%`
- **Veriler:**
  - `homeValue: -20%` (Value yok)
  - `awayValue: +1%` (Düşük value)
  - `bestValue: "bttsNo"` (En iyi value)
  - `bestValueAmount: 3%`

#### ✅ **Correct Score Tahminleri** (Hesaplama)
- **Kaynak:** Poisson dağılımı ile hesaplanır
- **Veriler:**
  - En olası: 1-1 (%15)
  - İkinci: 1-2 (%13)
  - Üçüncü: 0-1 (%11)

#### ✅ **Asian Handicap** (Hesaplama)
- **Kaynak:** Form farkı ve gol beklentilerinden hesaplanır
- **Veriler:**
  - `recommendation: "+0.5 Ev Sahibi"`
  - `confidence: 65%`
  - `reasoning: "Form farkı %-11. Deplasman favori. AH +0.5 Ev Sahibi önerisi."`

---

## 3️⃣ **DEEP ANALYSIS AGENT (Derin Analiz Ajanı)**

### Veri Kaynakları:

#### ✅ **Form ve Gol Ortalamaları** (Sportmonks)
- **Kaynak:** `getTeamStats()` → Sportmonks API
- **Veriler:**
  - Ev sahibi: 1.2 gol atıyor, 1 gol yiyor (evde)
  - Deplasman: 1.2 gol atıyor, 1 gol yiyor (deplasmanda)
- **Not:** Bu veriler ev/deplasman spesifik olarak hesaplanır

#### ✅ **H2H (Head-to-Head) Verileri** (Sportmonks)
- **Kaynak:** `getHeadToHead()` → Sportmonks API
- **Veriler:**
  - Toplam maç: 27
  - Ev kazanma: 4
  - Deplasman kazanma: 3
  - Beraberlik: 20
- **Kod:** `src/lib/sportmonks/index.ts` → `getHeadToHead()`

#### ✅ **Motivasyon Skorları** (Hesaplama)
- **Kaynak:** Son 10 maç formundan hesaplanır
- **Formül:**
  - Form puanları: W=3, D=1, L=0
  - Trend analizi: Son 3 maç vs önceki 3 maç
  - Momentum bonusu
- **Veriler:**
  - `home: 18` (düşük motivasyon, düşüyor)
  - `away: 48` (orta motivasyon, iyileşiyor)
  - `homeTrend: "düşüyor"`
  - `awayTrend: "iyileşiyor"`
- **Kod:** `src/lib/heurist/agents/deepAnalysis.ts` → `calculateTeamMotivationScore()`

#### ✅ **Beklenen Gol Hesaplamaları** (Hesaplama)
- **Kaynak:** Form verilerinden hesaplanır
- **Veriler:**
  - `expectedHomeGoals: 1.35`
  - `expectedAwayGoals: 1.55`
  - `expectedTotal: 2.90`
- **Kod:** `src/lib/heurist/agents/deepAnalysis.ts` → `buildDeepAnalysisContext()`

#### ✅ **Hakem Analizi** (Sportmonks)
- **Kaynak:** `getReferee()` → Sportmonks API
- **Veriler:**
  - Hakem adı: "Henüz açıklanmadı"
  - Ortalama kart: 4.2 sarı, 0.2 kırmızı
  - Penaltı: 0.3/maç
- **Kod:** `src/lib/football-intelligence/referee-stats.ts`

#### ✅ **Lineup Analizi** (Sportmonks)
- **Kaynak:** `getLineup()` → Sportmonks API
- **Veriler:**
  - Formasyon: 4-3-3 (ev), 4-4-2 (deplasman)
  - Anahtar oyuncular
- **Kod:** `src/lib/football-intelligence/lineup-injuries.ts`

---

## 4️⃣ **MATCH RESULT (Maç Sonucu Tahmini)**

### Veri Kaynakları:

#### ✅ **Sportmonks Puan Bazlı Analiz** (Hesaplama)
- **Kaynak:** `calculateMatchResultFromSportmonksData()`
- **Veriler:**
  - Form: Ev 13p vs Dep 17p (Fark: -4)
  - Gol Farkı: Ev -0.1 vs Dep 0.3
  - H2H: 27 maç (Ev 4G, Dep 3G)
  - Toplam Puan: Ev 47p vs Dep 44p (Fark: 3)
- **Tahmin:** Beraberlik (53.24% güven)
- **Kod:** `src/lib/agent-analyzer/index.ts` → `calculateMatchResultFromSportmonksData()`

---

## 📊 **VERİ AKIŞI ÖZETİ**

```
Agent Analysis Başlat
    ↓
Provider Manager (Bright Data öncelikli)
    ↓
┌─────────────────────────────────────┐
│  Bright Data MCP (8s timeout)      │
│  ❌ Session hatası → Fallback       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Sportmonks (Fallback)              │
│  ✅ Çalışıyor                       │
│                                     │
│  Veriler:                           │
│  - getFullFixtureData()             │
│  - getTeamStats()                   │
│  - getHeadToHead()                  │
│  - getTeamRecentMatches()           │
│  - getPreMatchOdds()                │
│  - getTeamInjuries()                │
│  - getReferee()                     │
│  - getLineup()                      │
└─────────────────────────────────────┘
    ↓
MatchData Formatına Dönüştür
    ↓
┌─────────────────────────────────────┐
│  Agent'lar Çalıştırılır:            │
│  - Stats Agent (xG, timing, clean)  │
│  - Odds Agent (value, odds)         │
│  - Deep Analysis (motivation, H2H) │
└─────────────────────────────────────┘
    ↓
Sonuçlar Birleştirilir
```

---

## 🎯 **SONUÇ**

**Bu analiz %100 Sportmonks verilerinden oluşuyor** çünkü:

1. ✅ Bright Data MCP session hatası veriyor → Fallback devreye girdi
2. ✅ Sportmonks fallback başarıyla çalıştı
3. ✅ Tüm veriler Sportmonks API'den geldi:
   - Form verileri
   - Gol istatistikleri
   - H2H verileri
   - Bahis oranları
   - Recent matches (timing patterns için)
   - xG verileri (varsa)

**Not:** Bright Data MCP session sorunu çözülürse, gelecekte FlashScore ve SofaScore'dan daha zengin veriler gelecek.

