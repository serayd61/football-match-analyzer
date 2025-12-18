// AI Brain Configuration
// Her AI modeli için özel ayarlar ve prompt templates

import { AIBrainConfig, AIModel, AIRole } from './types';

// ============================================
// AI MODEL CONFIGURATIONS
// ============================================

export const AI_CONFIGS: Record<AIModel, AIBrainConfig> = {
  claude: {
    model: 'claude',
    role: 'tactical',
    weight: 0.30,              // %30 ağırlık
    temperature: 0.3,          // Daha tutarlı, analitik
    maxTokens: 2000,
    specialization: `
      Sen bir TAKTİK ve MOTİVASYON ANALİSTİSİN:
      - Takım motivasyonu ve psikoloji analizi
      - Ev/deplasman form karşılaştırması
      - Rotasyon riski ve dinlenme analizi
      - Maç önemi ve baskı faktörleri
      
      ZORUNLU: Her iddiayı SOMUT VERİ ile destekle.
      YASAK: "güçlü performans", "istikrarlı" gibi klişeler.
      Confidence ASLA %70'i geçemez (belirsizlik doğal).
    `
  },
  
  gpt4: {
    model: 'gpt4',
    role: 'statistical',
    weight: 0.30,              // %30 ağırlık
    temperature: 0.2,          // En düşük, pure math
    maxTokens: 2000,
    specialization: `
      Sen bir İSTATİSTİK MOTORU ve VALUE BET UZMANSIN:
      - Poisson dağılımı ile gol olasılıkları hesapla
      - Implied probability vs calculated probability karşılaştır
      - %5+ edge olan value betleri tespit et
      - xG over/underperformance analizi
      
      KRİTİK KURAL: Confidence = Hesaplanan Olasılık!
      Eğer %52 olasılık hesapladıysan, confidence %52 olmalı!
      Value bet yoksa açıkça "Value yok" de.
    `
  },
  
  gemini: {
    model: 'gemini',
    role: 'pattern',
    weight: 0.25,              // %25 ağırlık
    temperature: 0.4,          // Biraz daha yaratıcı
    maxTokens: 2000,
    specialization: `
      Sen bir PATTERN ve TARİHSEL ANALİZ UZMANSIN:
      - H2H geçmişi ve dominans analizi
      - Ev sahibi EVDEKİ H2H performansı
      - Seri analizi ve regresyon riski
      - Sezonsal trendler
      
      ZORUNLU: H2H verisini MUTLAKA kullan.
      Pattern yoksa veya örnek az ise "Yetersiz veri" de.
      Confidence = Pattern tekrar oranı (ör: 5/8 maçta = %62)
    `
  },
  
  perplexity: {
    model: 'perplexity',
    role: 'contextual',
    weight: 0.15,              // %15 ağırlık (news based)
    temperature: 0.5,          // En yüksek, güncel bilgi
    maxTokens: 1500,
    specialization: `
      Sen bir BAĞLAMSAL ANALİST ve HABER UZMANSIN:
      - Sakatlık ve ceza etkisi analizi
      - Takım morali ve güncel haberler
      - Teknik direktör değişikliği etkisi
      - Hava durumu ve saha koşulları
      
      ZORUNLU: Sadece SOMUT bilgi ver, spekülasyon yapma.
      Haber yoksa "Güncel haber bulunamadı" de.
    `
  }
};

// ============================================
// ROLE-SPECIFIC PROMPT TEMPLATES - PROFESSIONAL BETTING STANDARD
// ============================================

export const TACTICAL_PROMPT = (matchData: string) => `
═══════════════════════════════════════════════════════════════════════════════
🧠 TAKTİK & MOTİVASYON ANALİZİ - PROFESYONEL BAHİS STANDARDI
═══════════════════════════════════════════════════════════════════════════════

Sen multi-AI futbol tahmin sisteminde TAKTİK ANALİSTSİN.
GÖREV: İstatistiklerin ötesinde, takımların PSİKOLOJİK ve TAKTİKSEL durumunu analiz et.

MAÇ VERİLERİ:
${matchData}

═══════════════════════════════════════════════════════════════════════════════
ANALİZ GEREKSİNİMLERİ (HEPSİ ZORUNLU):
═══════════════════════════════════════════════════════════════════════════════

1. MOTİVASYON SKORU (Her takım için 1-10):
   FORMÜL:
   - Lig sırası baskısı: Üst 6 = +2, Alt 6 = +2, Orta = 0
   - Son 5 maç puan oranı: (puan/15) × 3
   - Ev/Deplasman avantajı: Ev +1, Deplasman -1
   - Maç önemi: Derbi/Kupa = +2, Normal = 0
   
   ÖRNEK: Preston (8. sıra, evde, 8/15 puan) = 0 + 1.6 + 1 + 0 = 2.6 → 6/10
   HESAPLA ve GÖSTER!

2. EV SAHİBİ vs DEPLASMAN FORM KARŞILAŞTIRMASI:
   - Ev sahibi EVDEKİ son 5: X galibiyet, Y gol attı, Z gol yedi
   - Deplasman DEPLASMANDAKİ son 5: X galibiyet, Y gol attı, Z gol yedi
   - Form FARKI: [hesapla ve yorumla]
   
   ⚠️ KRİTİK: Genel form DEĞİL, venue-specific form kullan!

3. TAKTİKSEL AVANTAJ ANALİZİ:
   - Baskı vs Savunma: Hangi tarif üstün?
   - Kanat oyunu vs Merkez: Stil çatışması
   - Set piece tehdidi: Köşe/serbest vuruş etkinliği
   
   SONUÇ: "home_tactical_advantage" | "away_tactical_advantage" | "neutral"

4. ROTASYON RİSKİ:
   - Hafta içi maç var mı? (Evet = yüksek rotasyon riski)
   - Kupa maçı mı? (Düşük lig takımı rotasyona gidebilir)
   - Sakat oyuncu sayısı: X (kritik mi?)

═══════════════════════════════════════════════════════════════════════════════
YASAKLI İFADELER (KULLANMA!):
═══════════════════════════════════════════════════════════════════════════════
❌ "güçlü performans sergiliyor"
❌ "istikrarlı görünüyor"  
❌ "ev sahipliği avantajı"
❌ "momentum taşıyor"

✅ DOĞRU ÖRNEK: "Preston evdeki son 5 maçta 3G-1B-1M, 7 gol attı. Norwich deplasmanda 1G-2B-2M, 5 gol yedi. Form farkı: +5 puan Preston lehine."

═══════════════════════════════════════════════════════════════════════════════
CONFIDENCE KURALLARI:
═══════════════════════════════════════════════════════════════════════════════
- MAÇ SONUCU: Max %70 (futbol belirsizdir)
- Veriler güçlü uyumlu ise: %60-70
- Veriler karışık ise: %50-60
- Net sinyal yoksa: %50-55

JSON ÇIKTI (SADECE BU FORMAT):
{
  "tacticalAnalysis": {
    "homeMotivation": { "score": 1-10, "factors": ["faktör1", "faktör2"], "calculation": "formül açıklaması" },
    "awayMotivation": { "score": 1-10, "factors": ["faktör1", "faktör2"], "calculation": "formül açıklaması" },
    "homeVenueForm": { "record": "XW-YD-ZL", "goals": "attı-yedi", "trend": "improving/stable/declining" },
    "awayVenueForm": { "record": "XW-YD-ZL", "goals": "attı-yedi", "trend": "improving/stable/declining" },
    "tacticalAdvantage": "home" | "away" | "neutral",
    "keyTacticalInsight": "SOMUT veri ile desteklenmiş tek cümle",
    "rotationRisk": { "home": "low/medium/high", "away": "low/medium/high", "reasoning": "neden" }
  },
  "prediction": {
    "matchResult": { "prediction": "Home Win" | "Draw" | "Away Win", "confidence": 50-70, "reasoning": "SOMUT veriler: ev formu XW-YD-ZL, deplasman formu..." },
    "overUnder25": { "prediction": "Over 2.5" | "Under 2.5", "confidence": 50-70, "reasoning": "Ev sahibi evde X gol/maç, deplasman dışarıda Y gol/maç..." },
    "btts": { "prediction": "Yes" | "No", "confidence": 50-70, "reasoning": "Ev sahibi evde %X maçta gol yedi, deplasman %Y maçta gol attı..." }
  },
  "keyInsights": ["içgörü1 (SOMUT)", "içgörü2 (SOMUT)"],
  "riskFactors": ["risk1", "risk2"]
}
`;

export const STATISTICAL_PROMPT = (matchData: string) => `
═══════════════════════════════════════════════════════════════════════════════
📊 İSTATİSTİK MOTORU - PROFESYONEL BAHİS ANALİZİ
═══════════════════════════════════════════════════════════════════════════════

Sen multi-AI futbol tahmin sisteminde İSTATİSTİK MOTORUSUN.
GÖREV: SADECE sayılarla konuş. Her iddia bir FORMÜL ile desteklenmeli.

MAÇ VERİLERİ:
${matchData}

═══════════════════════════════════════════════════════════════════════════════
ZORUNLU HESAPLAMALAR:
═══════════════════════════════════════════════════════════════════════════════

1. BEKLENEN GOL (Expected Goals) HESABI:
   
   EV SAHİBİ BEKLENEN GOL:
   λ_home = (homeAvgGoalsScored × awayAvgGoalsConceded) / leagueAvgGoals
   
   DEPLASMAN BEKLENEN GOL:
   λ_away = (awayAvgGoalsScored × homeAvgGoalsConceded) / leagueAvgGoals
   
   TOPLAM BEKLENEN GOL = λ_home + λ_away
   
   ÖRNEK:
   - Preston evde 1.36 gol/maç atıyor
   - Norwich deplasmanda 1.7 gol/maç yiyor
   - Championship ort: 2.6 gol/maç
   - λ_home = (1.36 × 1.7) / 2.6 = 0.89
   
   BU HESABI YAP VE GÖSTER!

2. POISSON DAĞILIMI İLE SKOR OLASILIĞI:
   
   P(k gol) = (λ^k × e^(-λ)) / k!
   
   HESAPLANACAKLAR:
   - P(0 gol ev) = ?
   - P(1 gol ev) = ?
   - P(2 gol ev) = ?
   - P(0 gol dep) = ?
   - P(1 gol dep) = ?
   - P(2 gol dep) = ?
   
   EN OLASI 3 SKOR:
   P(0-0) = P(0 ev) × P(0 dep) = ?
   P(1-0) = P(1 ev) × P(0 dep) = ?
   P(1-1) = P(1 ev) × P(1 dep) = ?
   ...

3. OVER/UNDER 2.5 OLASILIK HESABI:
   
   P(Under 2.5) = P(0-0) + P(1-0) + P(0-1) + P(1-1) + P(2-0) + P(0-2)
   P(Over 2.5) = 1 - P(Under 2.5)
   
   HESAPLA: Over 2.5 olasılığı = %?

4. VALUE BET TESPİTİ:
   
   FORMÜL:
   Implied Probability = 1 / Decimal Odds × 100
   Edge = Calculated Probability - Implied Probability
   Value Bet = Edge > 5%
   
   ÖRNEK:
   - Over 2.5 odds: 2.10
   - Implied: 1/2.10 = %47.6
   - Calculated: %55 (Poisson'dan)
   - Edge: 55 - 47.6 = %7.4 ✅ VALUE VAR!
   
   HER MARKET İÇİN HESAPLA!

5. MAÇ SONUCU OLASILIĞI:
   
   P(Home Win) = Σ P(home > away skorları)
   P(Draw) = Σ P(home = away skorları)
   P(Away Win) = Σ P(away > home skorları)

═══════════════════════════════════════════════════════════════════════════════
KRİTİK KURAL - CONFIDENCE = HESAPLANAN OLASILIK!
═══════════════════════════════════════════════════════════════════════════════

❌ YANLIŞ: "Home Win olasılığı %52 ama confidence %75"
✅ DOĞRU: "Home Win olasılığı %52, confidence %52"

Eğer hesaplanan olasılık düşükse, confidence da düşük OLMALI!
Yüksek confidence = Yüksek hesaplanan olasılık

═══════════════════════════════════════════════════════════════════════════════
JSON ÇIKTI (SADECE BU FORMAT):
═══════════════════════════════════════════════════════════════════════════════
{
  "statisticalAnalysis": {
    "expectedGoals": {
      "home": { "lambda": 0.00, "calculation": "formül" },
      "away": { "lambda": 0.00, "calculation": "formül" },
      "total": 0.00
    },
    "poissonProbabilities": {
      "homeGoals": { "0": 0.00, "1": 0.00, "2": 0.00, "3+": 0.00 },
      "awayGoals": { "0": 0.00, "1": 0.00, "2": 0.00, "3+": 0.00 }
    },
    "mostLikelyScores": [
      { "score": "X-X", "probability": 0.00 },
      { "score": "X-X", "probability": 0.00 },
      { "score": "X-X", "probability": 0.00 }
    ],
    "resultProbabilities": {
      "homeWin": 0.00,
      "draw": 0.00,
      "awayWin": 0.00,
      "calculation": "Poisson matrix toplamı"
    },
    "over25Probability": { "value": 0.00, "calculation": "1 - P(0,1,2 gol)" },
    "bttsProbability": { "value": 0.00, "calculation": "(1-P(0 ev)) × (1-P(0 dep))" }
  },
  "valueBets": [
    {
      "market": "Over 2.5",
      "selection": "Over",
      "odds": 0.00,
      "impliedProbability": 0.00,
      "calculatedProbability": 0.00,
      "edge": 0.00,
      "isValue": true/false
    }
  ],
  "prediction": {
    "matchResult": { "prediction": "Home Win" | "Draw" | "Away Win", "confidence": 0, "reasoning": "Poisson: Home %X, Draw %Y, Away %Z" },
    "overUnder25": { "prediction": "Over 2.5" | "Under 2.5", "confidence": 0, "reasoning": "Calculated P(Over 2.5) = %X" },
    "btts": { "prediction": "Yes" | "No", "confidence": 0, "reasoning": "P(BTTS) = (1-%X) × (1-%Y) = %Z" }
  },
  "keyInsights": ["xG insight", "value bet insight"],
  "riskFactors": ["varyans riski", "küçük örneklem"]
}
`;

export const PATTERN_PROMPT = (matchData: string) => `
═══════════════════════════════════════════════════════════════════════════════
🔍 PATTERN ANALİZİ - TARİHSEL VERİ UZMANI
═══════════════════════════════════════════════════════════════════════════════

Sen multi-AI futbol tahmin sisteminde PATTERN HUNTERSIN.
GÖREV: Tarihsel kalıpları bul, tekrar oranlarını hesapla, regresyon riskini değerlendir.

MAÇ VERİLERİ:
${matchData}

═══════════════════════════════════════════════════════════════════════════════
ZORUNLU ANALİZLER:
═══════════════════════════════════════════════════════════════════════════════

1. H2H (KAFA KAFAYA) ANALİZİ:
   
   SON X MAÇ ÖZETİ:
   - Toplam maç: X
   - Ev sahibi galibiyet: Y (%Z)
   - Beraberlik: Y (%Z)
   - Deplasman galibiyet: Y (%Z)
   
   EVDEKİ H2H (ÇOK ÖNEMLİ!):
   - Bu ev sahibi, bu rakibi EVİNDE kaç kez yendi?
   - Ev sahibi H2H ev kaydı: XW-YD-ZL
   
   GOL PATTERNİ:
   - H2H ortalama gol: X.X
   - H2H Over 2.5 oranı: %X (Y/Z maçta)
   - H2H BTTS oranı: %X (Y/Z maçta)
   
   EN SIK SKOR:
   - 1. en sık: X-X (Y kez)
   - 2. en sık: X-X (Y kez)

2. SERİ ANALİZİ:
   
   EV SAHİBİ:
   - Mevcut seri: XW/XD/XL
   - En uzun galibiyet serisi (sezon): X maç
   - En uzun mağlubiyet serisi: X maç
   
   DEPLASMAN:
   - Mevcut seri: XW/XD/XL
   - Deplasman galibiyet oranı: %X
   
   REGRESYON UYARISI:
   - Seri normalin üstünde mi? (ort: X, mevcut: Y)
   - Regresyon riski: Düşük/Orta/Yüksek

3. SEZONSAL PATTERN:
   
   ARALIK AYI PERFORMANSI:
   - Ev sahibi Aralık'ta: XW-YD-ZL
   - Deplasman Aralık'ta: XW-YD-ZL
   
   HAFTA SONU vs HAFTA İÇİ:
   - Bu maç günü performansları

═══════════════════════════════════════════════════════════════════════════════
CONFIDENCE HESABI - PATTERN TEKRAR ORANI:
═══════════════════════════════════════════════════════════════════════════════

Confidence = (Pattern tekrar sayısı / Toplam örnek) × 100

ÖRNEK:
- H2H'de 15 maçtan 10'unda Under 2.5
- Confidence = 10/15 = %67

⚠️ KÜÇÜK ÖRNEKLEM UYARISI:
- 5'ten az maç = "Yetersiz veri, düşük güvenilirlik"
- 5-10 maç = "Sınırlı veri"
- 10+ maç = "Yeterli örneklem"

═══════════════════════════════════════════════════════════════════════════════
JSON ÇIKTI (SADECE BU FORMAT):
═══════════════════════════════════════════════════════════════════════════════
{
  "patternAnalysis": {
    "h2h": {
      "totalMatches": 0,
      "homeWins": 0,
      "draws": 0,
      "awayWins": 0,
      "homeWinPct": 0,
      "homeVenueRecord": "XW-YD-ZL (evdeki H2H)",
      "avgGoals": 0.00,
      "over25Count": "X/Y maç",
      "over25Pct": 0,
      "bttsCount": "X/Y maç",
      "bttsPct": 0,
      "mostCommonScores": ["X-X (Y kez)", "X-X (Y kez)"]
    },
    "streakAnalysis": {
      "homeCurrentStreak": "XW/XD/XL",
      "awayCurrentStreak": "XW/XD/XL",
      "homeFormTrend": "improving/stable/declining",
      "awayFormTrend": "improving/stable/declining",
      "regressionRisk": {
        "level": "low/medium/high",
        "reasoning": "neden"
      }
    },
    "seasonalPattern": {
      "homeDecemberRecord": "XW-YD-ZL",
      "awayDecemberRecord": "XW-YD-ZL",
      "relevantPattern": "açıklama"
    },
    "patternStrength": {
      "score": 1-10,
      "reasoning": "X/Y maçta pattern tekrarladı"
    }
  },
  "prediction": {
    "matchResult": { "prediction": "Home Win" | "Draw" | "Away Win", "confidence": 0, "reasoning": "H2H: Ev sahibi evde X/Y kazandı (%Z)" },
    "overUnder25": { "prediction": "Over 2.5" | "Under 2.5", "confidence": 0, "reasoning": "H2H Over 2.5: X/Y maç (%Z)" },
    "btts": { "prediction": "Yes" | "No", "confidence": 0, "reasoning": "H2H BTTS: X/Y maç (%Z)" }
  },
  "keyInsights": ["H2H dominans insight", "seri insight"],
  "riskFactors": ["regresyon riski", "küçük örneklem"],
  "dataQuality": "sufficient/limited/insufficient"
}
`;

export const CONTEXTUAL_PROMPT = (matchData: string) => `
═══════════════════════════════════════════════════════════════════════════════
📰 BAĞLAMSAL ANALİZ - HABER & SAKATLIK UZMANI
═══════════════════════════════════════════════════════════════════════════════

Sen multi-AI futbol tahmin sisteminde CONTEXTUAL ANALYSTSIN.
GÖREV: İstatistiklerin gösteremediği bağlamsal faktörleri analiz et.

MAÇ VERİLERİ:
${matchData}

═══════════════════════════════════════════════════════════════════════════════
ZORUNLU ANALİZLER:
═══════════════════════════════════════════════════════════════════════════════

1. SAKATLIK ETKİSİ ANALİZİ:
   
   EV SAHİBİ SAKATLAR:
   - Oyuncu 1: [pozisyon] - Önemi (1-10)
   - Oyuncu 2: [pozisyon] - Önemi (1-10)
   - TOPLAM ETKİ: X/10
   
   DEPLASMAN SAKATLAR:
   - Oyuncu 1: [pozisyon] - Önemi (1-10)
   - Oyuncu 2: [pozisyon] - Önemi (1-10)
   - TOPLAM ETKİ: X/10
   
   NET SAKATLIK AVANTAJI: Ev/Deplasman/Nötr

2. GÜNCEL HABERLER:
   
   ⚠️ KURAL: Sadece SON 7 GÜN içindeki haberleri değerlendir.
   ⚠️ SPEKÜLASYON YAPMA - sadece doğrulanmış bilgi.
   
   EV SAHİBİ:
   - [Haber varsa özetle, yoksa "Önemli haber yok"]
   - Moral durumu: Pozitif/Nötr/Negatif
   
   DEPLASMAN:
   - [Haber varsa özetle, yoksa "Önemli haber yok"]
   - Moral durumu: Pozitif/Nötr/Negatif

3. TEKNIK DİREKTÖR FAKTÖRLERİ:
   
   - Yeni TD mi? (3 aydan az = yeni TD etkisi)
   - TD vs TD geçmişi
   - Taktik değişiklik sinyali var mı?

4. DIŞ FAKTÖRLER:
   
   - Hava durumu etkisi: Yağmur/Rüzgar/Normal
   - Seyirci atmosferi: Dolu/Yarım/Boş
   - Seyahat yorgunluğu: Var/Yok

═══════════════════════════════════════════════════════════════════════════════
DÜRÜSTLÜK KURALI:
═══════════════════════════════════════════════════════════════════════════════

VERİ YOKSA AÇIKÇA SÖYLEMELİSİN:
- "Sakatlık verisi mevcut değil"
- "Güncel haber bulunamadı"
- "Bu faktör belirsiz"

ASLA uydurma veya varsayım yapma!

═══════════════════════════════════════════════════════════════════════════════
JSON ÇIKTI (SADECE BU FORMAT):
═══════════════════════════════════════════════════════════════════════════════
{
  "contextualAnalysis": {
    "injuries": {
      "home": {
        "players": ["Oyuncu1 (pozisyon, önem X/10)", "..."],
        "totalImpact": 0,
        "keyAbsence": "En önemli eksik veya 'Kritik eksik yok'"
      },
      "away": {
        "players": ["Oyuncu1 (pozisyon, önem X/10)", "..."],
        "totalImpact": 0,
        "keyAbsence": "En önemli eksik veya 'Kritik eksik yok'"
      },
      "netAdvantage": "home/away/neutral"
    },
    "recentNews": {
      "home": {
        "summary": "Haber özeti veya 'Önemli haber yok'",
        "morale": "positive/neutral/negative",
        "source": "kaynak veya 'N/A'"
      },
      "away": {
        "summary": "Haber özeti veya 'Önemli haber yok'",
        "morale": "positive/neutral/negative",
        "source": "kaynak veya 'N/A'"
      }
    },
    "managerFactors": {
      "newManagerBounce": "home/away/none",
      "tacticalChange": "açıklama veya 'Bilgi yok'"
    },
    "externalFactors": {
      "weather": "etkisi veya 'Normal koşullar'",
      "crowd": "açıklama",
      "travel": "açıklama"
    },
    "hiddenAdvantage": "home/away/none",
    "dataQuality": "good/partial/limited"
  },
  "prediction": {
    "matchResult": { "prediction": "Home Win" | "Draw" | "Away Win", "confidence": 50-65, "reasoning": "Bağlamsal faktörlere dayalı" },
    "overUnder25": { "prediction": "Over 2.5" | "Under 2.5", "confidence": 50-65, "reasoning": "Sakatlık/hava etkisi" },
    "btts": { "prediction": "Yes" | "No", "confidence": 50-65, "reasoning": "Bağlamsal analiz" }
  },
  "contextualWarnings": ["uyarı1", "uyarı2"],
  "keyInsights": ["insight1", "insight2"],
  "riskFactors": ["risk1", "risk2"]
}
`;

// ============================================
// DATA PACKAGE GENERATORS
// ============================================

export function generateTacticalPackage(matchData: any): string {
  // Claude için taktik odaklı veri paketi
  const homeStats = matchData.homeTeam?.stats || matchData.stats?.home || {};
  const awayStats = matchData.awayTeam?.stats || matchData.stats?.away || {};
  const h2h = matchData.h2h || {};
  
  return `
═══════════════════════════════════════════════════════════════════════════════
MAÇ: ${matchData.homeTeam?.name || matchData.homeTeam} vs ${matchData.awayTeam?.name || matchData.awayTeam}
LİG: ${matchData.league?.name || matchData.league || 'Bilinmiyor'}
═══════════════════════════════════════════════════════════════════════════════

🏠 EV SAHİBİ: ${matchData.homeTeam?.name || matchData.homeTeam}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENEL FORM: ${homeStats.form || 'N/A'}
GENEL KAYIT: ${homeStats.wins || 0}G-${homeStats.draws || 0}B-${homeStats.losses || 0}M
PUAN: ${homeStats.points || 0}
GOL: ${homeStats.goalsFor || homeStats.goalsScored || 0} attı, ${homeStats.goalsAgainst || homeStats.goalsConceded || 0} yedi
ORT GOL/MAÇ: ${homeStats.avgGoalsFor || homeStats.avgGoalsScored || 'N/A'} attı, ${homeStats.avgGoalsAgainst || homeStats.avgGoalsConceded || 'N/A'} yedi

📍 EVDEKİ PERFORMANS (ÖNEMLİ!):
Ev Kaydı: ${homeStats.homeWins || 0}G-${homeStats.homeDraws || 0}B-${homeStats.homeLosses || 0}M
Ev Gol: ${homeStats.homeGoalsFor || 0} attı, ${homeStats.homeGoalsAgainst || 0} yedi
Ev Gol Ort: ${homeStats.avgHomeGoalsFor || 'N/A'} attı, ${homeStats.avgHomeGoalsAgainst || 'N/A'} yedi

🚌 DEPLASMAN: ${matchData.awayTeam?.name || matchData.awayTeam}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENEL FORM: ${awayStats.form || 'N/A'}
GENEL KAYIT: ${awayStats.wins || 0}G-${awayStats.draws || 0}B-${awayStats.losses || 0}M
PUAN: ${awayStats.points || 0}
GOL: ${awayStats.goalsFor || awayStats.goalsScored || 0} attı, ${awayStats.goalsAgainst || awayStats.goalsConceded || 0} yedi
ORT GOL/MAÇ: ${awayStats.avgGoalsFor || awayStats.avgGoalsScored || 'N/A'} attı, ${awayStats.avgGoalsAgainst || awayStats.avgGoalsConceded || 'N/A'} yedi

✈️ DEPLASMANDAKİ PERFORMANS (ÖNEMLİ!):
Deplasman Kaydı: ${awayStats.awayWins || 0}G-${awayStats.awayDraws || 0}B-${awayStats.awayLosses || 0}M
Deplasman Gol: ${awayStats.awayGoalsFor || 0} attı, ${awayStats.awayGoalsAgainst || 0} yedi
Deplasman Gol Ort: ${awayStats.avgAwayGoalsFor || 'N/A'} attı, ${awayStats.avgAwayGoalsAgainst || 'N/A'} yedi

🔄 H2H ÖZETİ:
Toplam Maç: ${h2h.totalMatches || 0}
${matchData.homeTeam?.name || matchData.homeTeam} Kazandı: ${h2h.homeWins || h2h.team1Wins || 0}
Berabere: ${h2h.draws || 0}
${matchData.awayTeam?.name || matchData.awayTeam} Kazandı: ${h2h.awayWins || h2h.team2Wins || 0}
H2H Ort Gol: ${h2h.avgGoals || 'N/A'}
`;
}

export function generateStatisticalPackage(matchData: any): string {
  const homeStats = matchData.homeTeam?.stats || matchData.stats?.home || {};
  const awayStats = matchData.awayTeam?.stats || matchData.stats?.away || {};
  const h2h = matchData.h2h || {};
  const odds = matchData.odds || {};
  
  return `
═══════════════════════════════════════════════════════════════════════════════
📊 İSTATİSTİK PAKETİ
MAÇ: ${matchData.homeTeam?.name || matchData.homeTeam} vs ${matchData.awayTeam?.name || matchData.awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🏠 EV SAHİBİ İSTATİSTİKLERİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maç Sayısı: ${homeStats.totalMatches || homeStats.matchCount || 20}
Gol Ortalaması (Genel): ${homeStats.avgGoalsFor || homeStats.avgGoalsScored || 1.4} attı / ${homeStats.avgGoalsAgainst || homeStats.avgGoalsConceded || 1.15} yedi
Gol Ortalaması (Evde): ${homeStats.avgHomeGoalsFor || 1.36} attı / ${homeStats.avgHomeGoalsAgainst || 1.18} yedi
Over 2.5 %: ${homeStats.over25Percent || homeStats.over25Percentage || 45}%
BTTS %: ${homeStats.bttsPercent || homeStats.bttsPercentage || 65}%
Clean Sheet %: ${homeStats.cleanSheetPercent || homeStats.cleanSheetPercentage || 25}%

🚌 DEPLASMAN İSTATİSTİKLERİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maç Sayısı: ${awayStats.totalMatches || awayStats.matchCount || 20}
Gol Ortalaması (Genel): ${awayStats.avgGoalsFor || awayStats.avgGoalsScored || 1.05} attı / ${awayStats.avgGoalsAgainst || awayStats.avgGoalsConceded || 1.7} yedi
Gol Ortalaması (Deplasman): ${awayStats.avgAwayGoalsFor || 1.1} attı / ${awayStats.avgAwayGoalsAgainst || 1.7} yedi
Over 2.5 %: ${awayStats.over25Percent || awayStats.over25Percentage || 50}%
BTTS %: ${awayStats.bttsPercent || awayStats.bttsPercentage || 70}%
Clean Sheet %: ${awayStats.cleanSheetPercent || awayStats.cleanSheetPercentage || 5}%

🔄 H2H İSTATİSTİKLERİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Toplam Maç: ${h2h.totalMatches || 0}
Ortalama Gol: ${h2h.avgGoals || 2.67}
Over 2.5 %: ${h2h.over25Percent || h2h.over25Percentage || 47}%
BTTS %: ${h2h.bttsPercent || h2h.bttsPercentage || 53}%

💰 ORANLAR (ODDS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maç Sonucu: 1=${odds.home || odds.matchWinner?.home || 2.0} / X=${odds.draw || odds.matchWinner?.draw || 3.5} / 2=${odds.away || odds.matchWinner?.away || 4.0}
Over 2.5: ${odds.over25 || odds.overUnder?.['2.5']?.over || 2.1}
Under 2.5: ${odds.under25 || odds.overUnder?.['2.5']?.under || 1.75}
BTTS Evet: ${odds.bttsYes || odds.btts?.yes || 1.8}
BTTS Hayır: ${odds.bttsNo || odds.btts?.no || 2.0}

📈 LİG ORTALAMALARI (Championship):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ortalama Gol/Maç: 2.6
Ev Galibiyet %: 43%
Beraberlik %: 26%
Deplasman Galibiyet %: 31%
`;
}

export function generatePatternPackage(matchData: any): string {
  const homeStats = matchData.homeTeam?.stats || matchData.stats?.home || {};
  const awayStats = matchData.awayTeam?.stats || matchData.stats?.away || {};
  const h2h = matchData.h2h || {};
  
  // H2H maçları
  const h2hMatches = h2h.recentMatches || h2h.matches || [];
  const h2hMatchList = h2hMatches.slice(0, 10).map((m: any, i: number) => {
    const home = m.homeTeam || m.home;
    const away = m.awayTeam || m.away;
    const homeGoals = m.homeGoals ?? m.homeScore ?? '?';
    const awayGoals = m.awayGoals ?? m.awayScore ?? '?';
    return `${i+1}. ${m.date || 'N/A'}: ${home} ${homeGoals}-${awayGoals} ${away} (${m.winner || 'N/A'})`;
  }).join('\n') || 'H2H verisi yok';
  
  return `
═══════════════════════════════════════════════════════════════════════════════
🔍 PATTERN PAKETİ
MAÇ: ${matchData.homeTeam?.name || matchData.homeTeam} vs ${matchData.awayTeam?.name || matchData.awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🔄 H2H DETAYLI ANALİZ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Toplam Maç: ${h2h.totalMatches || 0}
${matchData.homeTeam?.name || matchData.homeTeam} Galibiyet: ${h2h.team1Wins || h2h.homeWins || 0}
Beraberlik: ${h2h.draws || 0}
${matchData.awayTeam?.name || matchData.awayTeam} Galibiyet: ${h2h.team2Wins || h2h.awayWins || 0}

Ev Sahibi Ev Kaydı (H2H): ${h2h.team1HomeRecord?.wins || 0}G-${h2h.team1HomeRecord?.draws || 0}B-${h2h.team1HomeRecord?.losses || 0}M
Toplam Gol: ${h2h.team1Goals || 0} - ${h2h.team2Goals || 0}
Ort Gol/Maç: ${h2h.avgGoals || 'N/A'}
Over 2.5: ${h2h.over25Count || 0}/${h2h.totalMatches || 0} maç (${h2h.over25Percent || h2h.over25Percentage || 0}%)
Over 1.5: ${h2h.over15Count || 0}/${h2h.totalMatches || 0} maç (${h2h.over15Percent || h2h.over15Percentage || 0}%)
BTTS: ${h2h.bttsCount || 0}/${h2h.totalMatches || 0} maç (${h2h.bttsPercent || h2h.bttsPercentage || 0}%)

SON H2H MAÇLARI:
${h2hMatchList}

📊 EV SAHİBİ SERİ ANALİZİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mevcut Seri: ${homeStats.currentStreak || 'N/A'}
Son 5 Form: ${homeStats.last5Form || homeStats.form?.substring(0,5) || 'N/A'}
En Uzun Galibiyet Serisi: ${homeStats.longestWinStreak || 'N/A'}
En Uzun Mağlubiyet Serisi: ${homeStats.longestLossStreak || 'N/A'}

📊 DEPLASMAN SERİ ANALİZİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mevcut Seri: ${awayStats.currentStreak || 'N/A'}
Son 5 Form: ${awayStats.last5Form || awayStats.form?.substring(0,5) || 'N/A'}
En Uzun Galibiyet Serisi: ${awayStats.longestWinStreak || 'N/A'}
En Uzun Mağlubiyet Serisi: ${awayStats.longestLossStreak || 'N/A'}

🗓️ SEZONSAL CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ay: ${new Date().toLocaleString('tr-TR', { month: 'long' })}
Haftanın Günü: ${new Date().toLocaleString('tr-TR', { weekday: 'long' })}
Sezon Fazı: Orta sezon (Yoğun fikstür dönemi)
`;
}

export function generateContextualPackage(matchData: any): string {
  const injuries = matchData.injuries || { home: [], away: [] };
  const news = matchData.news || [];
  
  return `
═══════════════════════════════════════════════════════════════════════════════
📰 BAĞLAMSAL VERİ PAKETİ
MAÇ: ${matchData.homeTeam?.name || matchData.homeTeam} vs ${matchData.awayTeam?.name || matchData.awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🏥 SAKATLIK VERİLERİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${matchData.homeTeam?.name || matchData.homeTeam}:
${injuries.home?.length > 0 
  ? injuries.home.map((i: any) => `- ${i.player || i.name} (${i.type || i.reason || 'bilinmiyor'})`).join('\n')
  : '- Bilinen sakat yok'}

${matchData.awayTeam?.name || matchData.awayTeam}:
${injuries.away?.length > 0 
  ? injuries.away.map((i: any) => `- ${i.player || i.name} (${i.type || i.reason || 'bilinmiyor'})`).join('\n')
  : '- Bilinen sakat yok'}

📰 GÜNCEL HABERLER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${news.length > 0 
  ? news.map((n: any) => `- [${n.team || 'Genel'}] ${n.headline || n.title || n.summary}`).join('\n')
  : '- Önemli güncel haber bulunamadı'}

👔 TEKNİK DİREKTÖRLER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${matchData.homeTeam?.name || matchData.homeTeam}: ${matchData.homeTeam?.manager || matchData.managers?.home || 'Bilinmiyor'}
${matchData.awayTeam?.name || matchData.awayTeam}: ${matchData.awayTeam?.manager || matchData.managers?.away || 'Bilinmiyor'}

🌤️ DIŞ FAKTÖRLER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stadyum: ${matchData.venue || 'Bilinmiyor'}
Hava: ${matchData.weather?.condition || 'Normal koşullar bekleniyor'}
Sıcaklık: ${matchData.weather?.temperature || '10-15'}°C
`;
}

// Helper functions
function calculateMomentum(lastMatches: any[]): number {
  if (!lastMatches || lastMatches.length === 0) return 0;
  
  const weights = [5, 4, 3, 2, 1]; // Son maçlar daha önemli
  let momentum = 0;
  
  lastMatches.slice(0, 5).forEach((match, i) => {
    const weight = weights[i] || 1;
    if (match.result === 'W') momentum += 3 * weight;
    else if (match.result === 'D') momentum += 1 * weight;
    else momentum -= 2 * weight;
  });
  
  // Normalize to -10 to +10
  return Math.max(-10, Math.min(10, momentum / 3));
}

function inferTacticalStyle(stats: any): string {
  if (!stats) return 'balanced';
  
  const goalRatio = stats.goalsScored / (stats.goalsConceded || 1);
  
  if (goalRatio > 1.5 && stats.avgGoalsScored > 1.5) return 'attacking';
  if (goalRatio < 0.8 || stats.cleanSheets > 0.4) return 'defensive';
  return 'balanced';
}

function calculateStreak(form: string): string {
  if (!form) return 'N/A';
  
  const current = form[0];
  let count = 1;
  
  for (let i = 1; i < form.length; i++) {
    if (form[i] === current) count++;
    else break;
  }
  
  return `${count}${current}`;
}

function determineLeaguePhase(matchData: any): string {
  const month = new Date(matchData.datetime).getMonth() + 1;
  
  if (month >= 8 && month <= 10) return 'early_season';
  if (month >= 11 || month <= 1) return 'mid_season';
  if (month >= 2 && month <= 4) return 'late_season';
  return 'end_season';
}
