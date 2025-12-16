// ============================================================================
// LEAGUE PROFILES - LIG KARAKTERİSTİKLERİ
// Her ligin gerçek istatistiksel özelliklerine dayalı profiller
// Veriler: 2023-24 sezonu ortalamaları (WhoScored, FBref, Transfermarkt)
// ============================================================================

export interface LeagueProfile {
  id: string;
  name: string;
  country: string;
  
  // Gol İstatistikleri
  avgGoalsPerMatch: number;        // Maç başına ortalama gol
  over25Percentage: number;        // Over 2.5 yüzdesi
  bttsPercentage: number;          // KG Var yüzdesi
  under25Percentage: number;       // Under 2.5 yüzdesi
  
  // Ev Sahibi Avantajı
  homeWinPercentage: number;       // Ev sahibi kazanma yüzdesi
  drawPercentage: number;          // Beraberlik yüzdesi
  awayWinPercentage: number;       // Deplasman kazanma yüzdesi
  homeGoalAdvantage: number;       // Ev sahibi gol avantajı (ekstra gol)
  
  // İlk Yarı / İkinci Yarı
  firstHalfGoalPercentage: number; // Gollerin ilk yarıda atılma yüzdesi
  secondHalfGoalPercentage: number;// Gollerin ikinci yarıda atılma yüzdesi
  lateGoalPercentage: number;      // 75+ dakikada atılan gol yüzdesi
  
  // Korner ve Kart
  avgCornersPerMatch: number;      // Maç başına ortalama korner
  avgYellowCardsPerMatch: number;  // Maç başına ortalama sarı kart
  avgRedCardsPerMatch: number;     // Maç başına ortalama kırmızı kart
  avgFoulsPerMatch: number;        // Maç başına ortalama faul
  
  // Lig Özellikleri
  competitiveness: 'very_high' | 'high' | 'medium' | 'low';  // Rekabet düzeyi
  tempo: 'very_fast' | 'fast' | 'medium' | 'slow';           // Oyun temposu
  physicalIntensity: 'very_high' | 'high' | 'medium' | 'low'; // Fiziksel yoğunluk
  tacticalComplexity: 'very_high' | 'high' | 'medium' | 'low'; // Taktiksel karmaşıklık
  
  // Tahmin Ayarlamaları
  overUnderBias: number;           // -10 to +10 (- = Under, + = Over)
  homeAwayBias: number;            // -10 to +10 (- = Away, + = Home)
  bttsBias: number;                // -10 to +10 (- = No, + = Yes)
  
  // xG Kalibrasyonu
  xgMultiplier: number;            // xG'nin gerçek gole dönüşüm oranı
  xgReliability: number;           // xG'nin güvenilirliği (0-100)
  
  // Notlar
  notes: string[];
}

// ============================================================================
// ANA LİGLER - GERÇEK VERİLERLE
// ============================================================================

export const LEAGUE_PROFILES: { [key: string]: LeagueProfile } = {
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 PREMIER LEAGUE (İngiltere)
  // ══════════════════════════════════════════════════════════════════════════
  'premier-league': {
    id: 'premier-league',
    name: 'Premier League',
    country: 'England',
    
    // 2023-24: 2.85 gol/maç ortalaması
    avgGoalsPerMatch: 2.85,
    over25Percentage: 56,
    bttsPercentage: 52,
    under25Percentage: 44,
    
    // Ev sahibi avantajı görece düşük
    homeWinPercentage: 43,
    drawPercentage: 24,
    awayWinPercentage: 33,
    homeGoalAdvantage: 0.35,
    
    // Gol dağılımı
    firstHalfGoalPercentage: 44,
    secondHalfGoalPercentage: 56,
    lateGoalPercentage: 22,
    
    // Korner ve kartlar
    avgCornersPerMatch: 10.2,
    avgYellowCardsPerMatch: 3.8,
    avgRedCardsPerMatch: 0.12,
    avgFoulsPerMatch: 20.5,
    
    // Karakteristikler
    competitiveness: 'very_high',
    tempo: 'very_fast',
    physicalIntensity: 'very_high',
    tacticalComplexity: 'high',
    
    // Ayarlamalar
    overUnderBias: 3,  // Hafif Over eğilimi
    homeAwayBias: 1,   // Neredeyse dengeli
    bttsBias: 2,       // BTTS Yes hafif eğilimi
    
    xgMultiplier: 0.98,  // xG oldukça güvenilir
    xgReliability: 85,
    
    notes: [
      'Yüksek tempolu, fiziksel lig',
      'Büyük 6 takım dışında rekabet çok yüksek',
      'Aralık-Ocak yoğun fikstür döneminde yorgunluk faktörü',
      'VAR penaltı oranını artırdı',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇪🇸 LA LIGA (İspanya)
  // ══════════════════════════════════════════════════════════════════════════
  'la-liga': {
    id: 'la-liga',
    name: 'La Liga',
    country: 'Spain',
    
    // 2023-24: 2.65 gol/maç
    avgGoalsPerMatch: 2.65,
    over25Percentage: 51,
    bttsPercentage: 48,
    under25Percentage: 49,
    
    // Ev sahibi avantajı yüksek
    homeWinPercentage: 47,
    drawPercentage: 23,
    awayWinPercentage: 30,
    homeGoalAdvantage: 0.45,
    
    firstHalfGoalPercentage: 42,
    secondHalfGoalPercentage: 58,
    lateGoalPercentage: 24,
    
    avgCornersPerMatch: 9.8,
    avgYellowCardsPerMatch: 4.5,
    avgRedCardsPerMatch: 0.18,
    avgFoulsPerMatch: 23.2,
    
    competitiveness: 'high',
    tempo: 'medium',
    physicalIntensity: 'medium',
    tacticalComplexity: 'very_high',
    
    overUnderBias: 0,
    homeAwayBias: 3,  // Ev sahibi avantajı belirgin
    bttsBias: 0,
    
    xgMultiplier: 0.95,
    xgReliability: 88,
    
    notes: [
      'Teknik ve taktiksel futbol',
      'Real Madrid-Barcelona-Atletico üçlüsü dominant',
      'Küçük takımlar defansif oynar',
      'Yaz sıcaklıkları tempo düşürür',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇩🇪 BUNDESLIGA (Almanya)
  // ══════════════════════════════════════════════════════════════════════════
  'bundesliga': {
    id: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    
    // 2023-24: 3.15 gol/maç - EN YÜKSEK!
    avgGoalsPerMatch: 3.15,
    over25Percentage: 62,
    bttsPercentage: 58,
    under25Percentage: 38,
    
    homeWinPercentage: 45,
    drawPercentage: 22,
    awayWinPercentage: 33,
    homeGoalAdvantage: 0.40,
    
    firstHalfGoalPercentage: 45,
    secondHalfGoalPercentage: 55,
    lateGoalPercentage: 21,
    
    avgCornersPerMatch: 10.5,
    avgYellowCardsPerMatch: 3.5,
    avgRedCardsPerMatch: 0.10,
    avgFoulsPerMatch: 19.8,
    
    competitiveness: 'high',
    tempo: 'fast',
    physicalIntensity: 'high',
    tacticalComplexity: 'high',
    
    overUnderBias: 6,  // GÜÇLÜ Over eğilimi
    homeAwayBias: 2,
    bttsBias: 5,  // BTTS Yes eğilimi güçlü
    
    xgMultiplier: 1.02,  // xG'nin biraz üstünde skor
    xgReliability: 82,
    
    notes: [
      'En yüksek gol ortalamasına sahip top 5 lig',
      'Gegenpressing stili yaygın',
      'Bayern dominansı var ama diğer takımlar da gol atar',
      'Kış arasında 1 ay mola',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇮🇹 SERIE A (İtalya)
  // ══════════════════════════════════════════════════════════════════════════
  'serie-a': {
    id: 'serie-a',
    name: 'Serie A',
    country: 'Italy',
    
    // 2023-24: 2.75 gol/maç
    avgGoalsPerMatch: 2.75,
    over25Percentage: 53,
    bttsPercentage: 50,
    under25Percentage: 47,
    
    homeWinPercentage: 44,
    drawPercentage: 26,
    awayWinPercentage: 30,
    homeGoalAdvantage: 0.42,
    
    firstHalfGoalPercentage: 41,
    secondHalfGoalPercentage: 59,
    lateGoalPercentage: 25,
    
    avgCornersPerMatch: 10.0,
    avgYellowCardsPerMatch: 4.8,
    avgRedCardsPerMatch: 0.15,
    avgFoulsPerMatch: 24.5,
    
    competitiveness: 'high',
    tempo: 'medium',
    physicalIntensity: 'medium',
    tacticalComplexity: 'very_high',
    
    overUnderBias: 1,
    homeAwayBias: 2,
    bttsBias: 0,
    
    xgMultiplier: 0.94,  // xG'nin biraz altında (defansif lig)
    xgReliability: 86,
    
    notes: [
      'Taktiksel ve defansif futbol',
      'Beraberlik oranı yüksek',
      'İkinci yarı golleri daha yaygın',
      'Küçük takımlar bile taktiksel oynar',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇫🇷 LIGUE 1 (Fransa)
  // ══════════════════════════════════════════════════════════════════════════
  'ligue-1': {
    id: 'ligue-1',
    name: 'Ligue 1',
    country: 'France',
    
    // 2023-24: 2.78 gol/maç
    avgGoalsPerMatch: 2.78,
    over25Percentage: 54,
    bttsPercentage: 49,
    under25Percentage: 46,
    
    homeWinPercentage: 46,
    drawPercentage: 24,
    awayWinPercentage: 30,
    homeGoalAdvantage: 0.48,
    
    firstHalfGoalPercentage: 43,
    secondHalfGoalPercentage: 57,
    lateGoalPercentage: 23,
    
    avgCornersPerMatch: 9.5,
    avgYellowCardsPerMatch: 4.2,
    avgRedCardsPerMatch: 0.20,
    avgFoulsPerMatch: 22.8,
    
    competitiveness: 'medium',
    tempo: 'medium',
    physicalIntensity: 'high',
    tacticalComplexity: 'medium',
    
    overUnderBias: 2,
    homeAwayBias: 3,
    bttsBias: 0,
    
    xgMultiplier: 0.96,
    xgReliability: 80,
    
    notes: [
      'PSG dominant (maçlarında Over yüksek)',
      'Kırmızı kart oranı yüksek',
      'Fiziksel lig',
      'Alt sıra takımları düşük skor eğilimli',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇹🇷 SÜPER LİG (Türkiye)
  // ══════════════════════════════════════════════════════════════════════════
  'super-lig': {
    id: 'super-lig',
    name: 'Süper Lig',
    country: 'Turkey',
    
    // 2023-24: 2.72 gol/maç
    avgGoalsPerMatch: 2.72,
    over25Percentage: 52,
    bttsPercentage: 51,
    under25Percentage: 48,
    
    // EV SAHİBİ AVANTAJI ÇOK YÜKSEK!
    homeWinPercentage: 51,
    drawPercentage: 22,
    awayWinPercentage: 27,
    homeGoalAdvantage: 0.55,  // En yüksek değerlerden biri
    
    firstHalfGoalPercentage: 44,
    secondHalfGoalPercentage: 56,
    lateGoalPercentage: 26,
    
    avgCornersPerMatch: 9.8,
    avgYellowCardsPerMatch: 5.2,  // YÜKSEK!
    avgRedCardsPerMatch: 0.22,
    avgFoulsPerMatch: 26.5,
    
    competitiveness: 'high',
    tempo: 'fast',
    physicalIntensity: 'high',
    tacticalComplexity: 'medium',
    
    overUnderBias: 1,
    homeAwayBias: 6,  // GÜÇLÜ ev sahibi eğilimi
    bttsBias: 2,
    
    xgMultiplier: 1.05,  // xG üstünde skor (duygusal futbol)
    xgReliability: 72,   // xG daha az güvenilir
    
    notes: [
      'Ev sahibi avantajı Avrupa\'nın en yükseklerinden',
      'Taraftar baskısı çok etkili',
      'Kart ortalaması yüksek, sert müdahaleler',
      'Büyük 4 (GS, FB, BJK, TS) dışında sonuçlar değişken',
      'Derbi maçlarında her şey olabilir',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇳🇱 EREDIVISIE (Hollanda)
  // ══════════════════════════════════════════════════════════════════════════
  'eredivisie': {
    id: 'eredivisie',
    name: 'Eredivisie',
    country: 'Netherlands',
    
    // 2023-24: 3.25 gol/maç - EN YÜKSEK!
    avgGoalsPerMatch: 3.25,
    over25Percentage: 65,
    bttsPercentage: 60,
    under25Percentage: 35,
    
    homeWinPercentage: 48,
    drawPercentage: 21,
    awayWinPercentage: 31,
    homeGoalAdvantage: 0.38,
    
    firstHalfGoalPercentage: 46,
    secondHalfGoalPercentage: 54,
    lateGoalPercentage: 20,
    
    avgCornersPerMatch: 10.8,
    avgYellowCardsPerMatch: 3.2,
    avgRedCardsPerMatch: 0.08,
    avgFoulsPerMatch: 18.5,
    
    competitiveness: 'medium',
    tempo: 'fast',
    physicalIntensity: 'medium',
    tacticalComplexity: 'medium',
    
    overUnderBias: 8,  // ÇOK GÜÇLÜ Over eğilimi
    homeAwayBias: 3,
    bttsBias: 6,  // BTTS Yes çok yüksek
    
    xgMultiplier: 1.08,  // xG'nin üstünde skor
    xgReliability: 78,
    
    notes: [
      'Avrupa\'nın en golcü ligi',
      'Ajax, PSV, Feyenoord dominant',
      'Ofansif futbol kültürü',
      'Genç oyuncu geliştirme odaklı',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇵🇹 PRIMEIRA LIGA (Portekiz)
  // ══════════════════════════════════════════════════════════════════════════
  'primeira-liga': {
    id: 'primeira-liga',
    name: 'Primeira Liga',
    country: 'Portugal',
    
    avgGoalsPerMatch: 2.68,
    over25Percentage: 50,
    bttsPercentage: 47,
    under25Percentage: 50,
    
    homeWinPercentage: 49,
    drawPercentage: 23,
    awayWinPercentage: 28,
    homeGoalAdvantage: 0.50,
    
    firstHalfGoalPercentage: 43,
    secondHalfGoalPercentage: 57,
    lateGoalPercentage: 24,
    
    avgCornersPerMatch: 9.6,
    avgYellowCardsPerMatch: 4.8,
    avgRedCardsPerMatch: 0.18,
    avgFoulsPerMatch: 24.0,
    
    competitiveness: 'medium',
    tempo: 'medium',
    physicalIntensity: 'medium',
    tacticalComplexity: 'high',
    
    overUnderBias: 0,
    homeAwayBias: 4,
    bttsBias: -1,
    
    xgMultiplier: 0.95,
    xgReliability: 80,
    
    notes: [
      'Benfica, Porto, Sporting üçlüsü dominant',
      'Fiziksel ve teknik karışımı',
      'Ev sahibi avantajı yüksek',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🏆 UEFA CHAMPIONS LEAGUE
  // ══════════════════════════════════════════════════════════════════════════
  'champions-league': {
    id: 'champions-league',
    name: 'UEFA Champions League',
    country: 'Europe',
    
    avgGoalsPerMatch: 2.95,
    over25Percentage: 58,
    bttsPercentage: 54,
    under25Percentage: 42,
    
    homeWinPercentage: 46,
    drawPercentage: 23,
    awayWinPercentage: 31,
    homeGoalAdvantage: 0.35,
    
    firstHalfGoalPercentage: 42,
    secondHalfGoalPercentage: 58,
    lateGoalPercentage: 26,
    
    avgCornersPerMatch: 10.5,
    avgYellowCardsPerMatch: 3.5,
    avgRedCardsPerMatch: 0.12,
    avgFoulsPerMatch: 21.0,
    
    competitiveness: 'very_high',
    tempo: 'fast',
    physicalIntensity: 'high',
    tacticalComplexity: 'very_high',
    
    overUnderBias: 3,
    homeAwayBias: 2,
    bttsBias: 3,
    
    xgMultiplier: 0.92,  // Savunmalar daha iyi
    xgReliability: 90,   // En yüksek kalite maçlar
    
    notes: [
      'En yüksek kalite futbol',
      'Grup aşaması vs eleme turu farklı dinamikler',
      'İlk maç vs rövanş maçı farklı',
      'Deplasman golü kuralı kaldırıldı',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🏆 UEFA EUROPA LEAGUE
  // ══════════════════════════════════════════════════════════════════════════
  'europa-league': {
    id: 'europa-league',
    name: 'UEFA Europa League',
    country: 'Europe',
    
    avgGoalsPerMatch: 2.82,
    over25Percentage: 55,
    bttsPercentage: 51,
    under25Percentage: 45,
    
    homeWinPercentage: 47,
    drawPercentage: 24,
    awayWinPercentage: 29,
    homeGoalAdvantage: 0.40,
    
    firstHalfGoalPercentage: 43,
    secondHalfGoalPercentage: 57,
    lateGoalPercentage: 24,
    
    avgCornersPerMatch: 10.2,
    avgYellowCardsPerMatch: 4.0,
    avgRedCardsPerMatch: 0.14,
    avgFoulsPerMatch: 22.5,
    
    competitiveness: 'high',
    tempo: 'medium',
    physicalIntensity: 'high',
    tacticalComplexity: 'high',
    
    overUnderBias: 2,
    homeAwayBias: 3,
    bttsBias: 1,
    
    xgMultiplier: 0.96,
    xgReliability: 82,
    
    notes: [
      'Takım kalitesi daha değişken',
      'Büyük takımlar rotasyon yapar',
      'Uzun deplasman yorgunluk faktörü',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🏴󠁧󠁢󠁥󠁮󠁧󠁿 CHAMPIONSHIP (İngiltere 2. Lig)
  // ══════════════════════════════════════════════════════════════════════════
  'championship': {
    id: 'championship',
    name: 'Championship',
    country: 'England',
    
    avgGoalsPerMatch: 2.72,
    over25Percentage: 52,
    bttsPercentage: 50,
    under25Percentage: 48,
    
    homeWinPercentage: 44,
    drawPercentage: 25,
    awayWinPercentage: 31,
    homeGoalAdvantage: 0.38,
    
    firstHalfGoalPercentage: 44,
    secondHalfGoalPercentage: 56,
    lateGoalPercentage: 23,
    
    avgCornersPerMatch: 9.8,
    avgYellowCardsPerMatch: 4.0,
    avgRedCardsPerMatch: 0.12,
    avgFoulsPerMatch: 21.5,
    
    competitiveness: 'very_high',
    tempo: 'fast',
    physicalIntensity: 'very_high',
    tacticalComplexity: 'medium',
    
    overUnderBias: 1,
    homeAwayBias: 2,
    bttsBias: 1,
    
    xgMultiplier: 1.02,
    xgReliability: 75,
    
    notes: [
      'Dünyanın en rekabetçi 2. ligi',
      '46 maçlık uzun sezon',
      'Fiziksel yoğunluk çok yüksek',
      'Playoff dönemi çok farklı dinamik',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇨🇭 SWISS SUPER LEAGUE (İsviçre)
  // ══════════════════════════════════════════════════════════════════════════
  'swiss-super-league': {
    id: 'swiss-super-league',
    name: 'Swiss Super League',
    country: 'Switzerland',
    
    avgGoalsPerMatch: 2.85,
    over25Percentage: 55,
    bttsPercentage: 52,
    under25Percentage: 45,
    
    homeWinPercentage: 46,
    drawPercentage: 24,
    awayWinPercentage: 30,
    homeGoalAdvantage: 0.42,
    
    firstHalfGoalPercentage: 45,
    secondHalfGoalPercentage: 55,
    lateGoalPercentage: 22,
    
    avgCornersPerMatch: 10.0,
    avgYellowCardsPerMatch: 3.8,
    avgRedCardsPerMatch: 0.12,
    avgFoulsPerMatch: 20.0,
    
    competitiveness: 'medium',
    tempo: 'medium',
    physicalIntensity: 'medium',
    tacticalComplexity: 'medium',
    
    overUnderBias: 3,
    homeAwayBias: 3,
    bttsBias: 2,
    
    xgMultiplier: 1.00,
    xgReliability: 76,
    
    notes: [
      'Young Boys dominant',
      'Basel, Servette, Zürich rekabetçi',
      'Yapay çim sahaları var',
      'Kış aylarında kar etkisi',
    ],
  },
  
  // ══════════════════════════════════════════════════════════════════════════
  // 🇪🇸 COPA DEL REY (İspanya Kupası)
  // ══════════════════════════════════════════════════════════════════════════
  'copa-del-rey': {
    id: 'copa-del-rey',
    name: 'Copa del Rey',
    country: 'Spain',
    
    avgGoalsPerMatch: 2.95,
    over25Percentage: 58,
    bttsPercentage: 53,
    under25Percentage: 42,
    
    homeWinPercentage: 52,  // Ev avantajı kupa maçlarında yüksek
    drawPercentage: 18,     // Beraberlik düşük (eleme var)
    awayWinPercentage: 30,
    homeGoalAdvantage: 0.50,
    
    firstHalfGoalPercentage: 44,
    secondHalfGoalPercentage: 56,
    lateGoalPercentage: 25,
    
    avgCornersPerMatch: 10.2,
    avgYellowCardsPerMatch: 4.2,
    avgRedCardsPerMatch: 0.15,
    avgFoulsPerMatch: 22.0,
    
    competitiveness: 'high',
    tempo: 'fast',
    physicalIntensity: 'high',
    tacticalComplexity: 'medium',
    
    overUnderBias: 4,
    homeAwayBias: 5,  // Kupa maçlarında ev avantajı çok yüksek
    bttsBias: 3,
    
    xgMultiplier: 1.05,
    xgReliability: 70,  // Alt lig takımları xG'yi bozabilir
    
    notes: [
      'Alt lig takımlarına karşı dikkat',
      'Büyük takımlar rotasyon yapar',
      'Tek maç eleme formatı değişken',
      'Ev sahibi avantajı çok önemli',
    ],
  },
};

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * Lig adına göre profil bul
 */
export function getLeagueProfile(leagueName: string): LeagueProfile | null {
  const normalizedName = leagueName.toLowerCase().trim();
  
  // Direkt eşleşme
  for (const [key, profile] of Object.entries(LEAGUE_PROFILES)) {
    if (key === normalizedName || profile.name.toLowerCase() === normalizedName) {
      return profile;
    }
  }
  
  // Kısmi eşleşme
  for (const [key, profile] of Object.entries(LEAGUE_PROFILES)) {
    if (normalizedName.includes(key) || 
        normalizedName.includes(profile.name.toLowerCase()) ||
        profile.name.toLowerCase().includes(normalizedName)) {
      return profile;
    }
  }
  
  // Özel eşleşmeler
  const specialMappings: { [key: string]: string } = {
    'england': 'premier-league',
    'english premier': 'premier-league',
    'epl': 'premier-league',
    'spain': 'la-liga',
    'laliga': 'la-liga',
    'spanish': 'la-liga',
    'germany': 'bundesliga',
    'german': 'bundesliga',
    'italy': 'serie-a',
    'italian': 'serie-a',
    'calcio': 'serie-a',
    'france': 'ligue-1',
    'french': 'ligue-1',
    'turkey': 'super-lig',
    'turkish': 'super-lig',
    'türkiye': 'super-lig',
    'netherlands': 'eredivisie',
    'dutch': 'eredivisie',
    'holland': 'eredivisie',
    'portugal': 'primeira-liga',
    'portuguese': 'primeira-liga',
    'liga portugal': 'primeira-liga',
    'ucl': 'champions-league',
    'cl': 'champions-league',
    'uel': 'europa-league',
    'swiss': 'swiss-super-league',
    'switzerland': 'swiss-super-league',
    'super league': 'swiss-super-league',
    'copa': 'copa-del-rey',
    'kings cup': 'copa-del-rey',
  };
  
  for (const [term, leagueId] of Object.entries(specialMappings)) {
    if (normalizedName.includes(term)) {
      return LEAGUE_PROFILES[leagueId] || null;
    }
  }
  
  return null;
}

/**
 * Lig profiline göre tahmin ayarla
 */
export function adjustPredictionByLeague(
  prediction: {
    overUnder: string;
    overUnderConfidence: number;
    matchResult: string;
    matchResultConfidence: number;
    btts: string;
    bttsConfidence: number;
  },
  league: LeagueProfile
): typeof prediction {
  const adjusted = { ...prediction };
  
  // Over/Under ayarlaması
  if (league.overUnderBias !== 0) {
    const currentIsOver = adjusted.overUnder === 'Over';
    const biasTowardsOver = league.overUnderBias > 0;
    
    if (currentIsOver === biasTowardsOver) {
      // Lig eğilimi tahmini destekliyor
      adjusted.overUnderConfidence = Math.min(85, adjusted.overUnderConfidence + Math.abs(league.overUnderBias));
    } else {
      // Lig eğilimi tahminin tersine
      adjusted.overUnderConfidence = Math.max(45, adjusted.overUnderConfidence - Math.abs(league.overUnderBias) / 2);
      
      // Eğer çok güçlü bir eğilim varsa ve güven düşükse, tahmini değiştir
      if (Math.abs(league.overUnderBias) >= 5 && adjusted.overUnderConfidence < 55) {
        adjusted.overUnder = biasTowardsOver ? 'Over' : 'Under';
        adjusted.overUnderConfidence = 55 + Math.abs(league.overUnderBias);
      }
    }
  }
  
  // Ev sahibi/Deplasman ayarlaması
  if (league.homeAwayBias !== 0) {
    if (adjusted.matchResult === '1' && league.homeAwayBias > 0) {
      adjusted.matchResultConfidence = Math.min(80, adjusted.matchResultConfidence + league.homeAwayBias);
    } else if (adjusted.matchResult === '2' && league.homeAwayBias < 0) {
      adjusted.matchResultConfidence = Math.min(80, adjusted.matchResultConfidence + Math.abs(league.homeAwayBias));
    } else if (adjusted.matchResult === '2' && league.homeAwayBias > 3) {
      // Güçlü ev sahibi liginde deplasman tahmini
      adjusted.matchResultConfidence = Math.max(45, adjusted.matchResultConfidence - league.homeAwayBias);
    }
  }
  
  // BTTS ayarlaması
  if (league.bttsBias !== 0) {
    const currentIsBttsYes = adjusted.btts === 'Yes';
    const biasTowardsBtts = league.bttsBias > 0;
    
    if (currentIsBttsYes === biasTowardsBtts) {
      adjusted.bttsConfidence = Math.min(80, adjusted.bttsConfidence + Math.abs(league.bttsBias));
    } else {
      adjusted.bttsConfidence = Math.max(45, adjusted.bttsConfidence - Math.abs(league.bttsBias) / 2);
    }
  }
  
  return adjusted;
}

/**
 * Lig bazlı gol beklentisi hesapla
 */
export function calculateLeagueAdjustedGoalExpectancy(
  homeGoalsScored: number,
  homeGoalsConceded: number,
  awayGoalsScored: number,
  awayGoalsConceded: number,
  league: LeagueProfile
): {
  homeExpected: number;
  awayExpected: number;
  totalExpected: number;
  adjustmentReason: string;
} {
  // Temel hesaplama
  let homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  let awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  
  // Ev sahibi avantajı uygula
  homeExpected += league.homeGoalAdvantage;
  awayExpected -= league.homeGoalAdvantage * 0.5;  // Deplasmandan azalt
  
  // Lig ortalamasına doğru regresyon
  const leagueAvgPerTeam = league.avgGoalsPerMatch / 2;
  const regressionFactor = 0.2;  // %20 lig ortalamasına çek
  
  homeExpected = homeExpected * (1 - regressionFactor) + leagueAvgPerTeam * regressionFactor;
  awayExpected = awayExpected * (1 - regressionFactor) + leagueAvgPerTeam * regressionFactor;
  
  // Min/Max sınırları
  homeExpected = Math.max(0.5, Math.min(3.5, homeExpected));
  awayExpected = Math.max(0.3, Math.min(3.0, awayExpected));
  
  const totalExpected = homeExpected + awayExpected;
  
  let adjustmentReason = `Lig ortalaması: ${league.avgGoalsPerMatch} gol/maç. `;
  adjustmentReason += `Ev avantajı: +${league.homeGoalAdvantage} gol. `;
  
  if (league.overUnderBias > 3) {
    adjustmentReason += `Bu lig Over eğilimli (bias: +${league.overUnderBias}). `;
  } else if (league.overUnderBias < -3) {
    adjustmentReason += `Bu lig Under eğilimli (bias: ${league.overUnderBias}). `;
  }
  
  return {
    homeExpected: parseFloat(homeExpected.toFixed(2)),
    awayExpected: parseFloat(awayExpected.toFixed(2)),
    totalExpected: parseFloat(totalExpected.toFixed(2)),
    adjustmentReason,
  };
}

/**
 * Lig bazlı xG güvenilirliği
 */
export function getXGReliability(league: LeagueProfile): {
  multiplier: number;
  reliability: number;
  note: string;
} {
  return {
    multiplier: league.xgMultiplier,
    reliability: league.xgReliability,
    note: league.xgMultiplier > 1.0 
      ? 'Bu ligde takımlar xG\'nin üstünde skor yapıyor (ofansif futbol)'
      : league.xgMultiplier < 0.95
      ? 'Bu ligde takımlar xG\'nin altında skor yapıyor (defansif futbol)'
      : 'xG güvenilir bir gösterge',
  };
}

