// src/lib/heurist/sportmonks-odds.ts
// Historical Odds & Sharp Money Detection

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_TOKEN;

// ==================== TYPES ====================

export interface OddsHistory {
  opening: number;
  current: number;
  movement: 'dropping' | 'rising' | 'stable';
  changePercent: number;
}

export interface MatchOddsHistory {
  homeWin: OddsHistory;
  draw: OddsHistory;
  awayWin: OddsHistory;
  over25: OddsHistory;
  under25: OddsHistory;
  bttsYes: OddsHistory;
  bttsNo: OddsHistory;
}

export interface SharpMoneyResult {
  direction: 'home' | 'away' | 'draw' | 'over' | 'under' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reasoning: {
    tr: string;
    en: string;
    de: string;
  };
}

export interface BettingVolumeResult {
  market: 'home' | 'away' | 'draw' | 'over' | 'under' | 'btts_yes' | 'btts_no' | 'none';
  volumeIncrease: number; // Normalden % kaç fazla bahis yapılmış
  confidence: 'high' | 'medium' | 'low';
  reasoning: {
    tr: string;
    en: string;
    de: string;
  };
  indicators: {
    oddsDropSpeed: number; // Oran düşüş hızı (%/saat tahmini)
    movementStrength: number; // Hareket gücü (0-100)
    isUnusual: boolean; // Normalden farklı mı?
  };
}

// ==================== HELPERS ====================

function calculateMovement(opening: number, current: number): 'dropping' | 'rising' | 'stable' {
  if (!opening || !current) return 'stable';
  const changePercent = ((current - opening) / opening) * 100;
  if (changePercent <= -5) return 'dropping';  // %5+ düştü - SHARP MONEY
  if (changePercent >= 5) return 'rising';      // %5+ yükseldi
  return 'stable';
}

function createOddsHistory(opening: number, current: number): OddsHistory {
  const actualOpening = opening || current || 2.0;
  const actualCurrent = current || opening || 2.0;
  return {
    opening: actualOpening,
    current: actualCurrent,
    movement: calculateMovement(actualOpening, actualCurrent),
    changePercent: actualOpening ? Math.round(((actualCurrent - actualOpening) / actualOpening) * 100) : 0,
  };
}

// ==================== FETCH HISTORICAL ODDS ====================

export async function fetchHistoricalOdds(fixtureId: number): Promise<MatchOddsHistory | null> {
  if (!SPORTMONKS_TOKEN || !fixtureId) {
    console.log('⚠️ No token or fixtureId for historical odds');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/odds/pre-match/fixtures/${fixtureId}?api_token=${SPORTMONKS_TOKEN}&include=market;bookmaker`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      console.error('Sportmonks odds API error:', response.status);
      return null;
    }

    const data = await response.json();
    const odds = data.data || [];

    // Değişkenler
    let homeWinOpening = 0, homeWinCurrent = 0;
    let drawOpening = 0, drawCurrent = 0;
    let awayWinOpening = 0, awayWinCurrent = 0;
    let over25Opening = 0, over25Current = 0;
    let under25Opening = 0, under25Current = 0;
    let bttsYesOpening = 0, bttsYesCurrent = 0;
    let bttsNoOpening = 0, bttsNoCurrent = 0;

    for (const odd of odds) {
      const marketId = odd.market_id;
      const label = odd.label?.toString() || '';
      const value = parseFloat(odd.value) || 0;
      const isOriginal = odd.original === true;

      // Match Winner (1X2) - Market ID: 1
      if (marketId === 1) {
        if (label === '1' || label.toLowerCase() === 'home') {
          if (isOriginal) homeWinOpening = value;
          else homeWinCurrent = Math.max(homeWinCurrent, value);
        } else if (label === 'X' || label.toLowerCase() === 'draw') {
          if (isOriginal) drawOpening = value;
          else drawCurrent = Math.max(drawCurrent, value);
        } else if (label === '2' || label.toLowerCase() === 'away') {
          if (isOriginal) awayWinOpening = value;
          else awayWinCurrent = Math.max(awayWinCurrent, value);
        }
      }

      // Over/Under 2.5 - Market ID: 12
      if (marketId === 12 || marketId === 18) {
        const total = odd.total || odd.name || '';
        if (total.toString().includes('2.5')) {
          if (label.toLowerCase() === 'over') {
            if (isOriginal) over25Opening = value;
            else over25Current = Math.max(over25Current, value);
          } else if (label.toLowerCase() === 'under') {
            if (isOriginal) under25Opening = value;
            else under25Current = Math.max(under25Current, value);
          }
        }
      }

      // BTTS - Market ID: 28
      if (marketId === 28 || marketId === 29) {
        if (label.toLowerCase() === 'yes') {
          if (isOriginal) bttsYesOpening = value;
          else bttsYesCurrent = Math.max(bttsYesCurrent, value);
        } else if (label.toLowerCase() === 'no') {
          if (isOriginal) bttsNoOpening = value;
          else bttsNoCurrent = Math.max(bttsNoCurrent, value);
        }
      }
    }

    console.log(`📊 Historical Odds: Home ${homeWinOpening}→${homeWinCurrent}, Over ${over25Opening}→${over25Current}`);

    return {
      homeWin: createOddsHistory(homeWinOpening, homeWinCurrent),
      draw: createOddsHistory(drawOpening, drawCurrent),
      awayWin: createOddsHistory(awayWinOpening, awayWinCurrent),
      over25: createOddsHistory(over25Opening, over25Current),
      under25: createOddsHistory(under25Opening, under25Current),
      bttsYes: createOddsHistory(bttsYesOpening, bttsYesCurrent),
      bttsNo: createOddsHistory(bttsNoOpening, bttsNoCurrent),
    };
  } catch (error) {
    console.error('Failed to fetch historical odds:', error);
    return null;
  }
}

// ==================== SHARP MONEY ANALYSIS ====================

export function analyzeSharpMoney(oddsHistory: MatchOddsHistory): SharpMoneyResult {
  const allMovements = [
    { key: 'home', data: oddsHistory.homeWin, label: { tr: 'Ev Galibiyeti', en: 'Home Win', de: 'Heimsieg' } },
    { key: 'draw', data: oddsHistory.draw, label: { tr: 'Beraberlik', en: 'Draw', de: 'Unentschieden' } },
    { key: 'away', data: oddsHistory.awayWin, label: { tr: 'Deplasman', en: 'Away Win', de: 'Auswärtssieg' } },
    { key: 'over', data: oddsHistory.over25, label: { tr: 'Üst 2.5', en: 'Over 2.5', de: 'Über 2.5' } },
    { key: 'under', data: oddsHistory.under25, label: { tr: 'Alt 2.5', en: 'Under 2.5', de: 'Unter 2.5' } },
  ];

  // En çok düşen oranı bul
  let maxDrop = 0;
  let sharpDirection: any = 'none';
  let sharpLabel = { tr: '', en: '', de: '' };

  for (const item of allMovements) {
    if (item.data.movement === 'dropping' && Math.abs(item.data.changePercent) > maxDrop) {
      maxDrop = Math.abs(item.data.changePercent);
      sharpDirection = item.key;
      sharpLabel = item.label;
    }
  }

  if (maxDrop >= 10) {
    return {
      direction: sharpDirection,
      confidence: 'high',
      reasoning: {
        tr: `🔥 SHARP MONEY ALERT! ${sharpLabel.tr} oranı %${maxDrop} DÜŞTÜ! Profesyoneller bu tarafa oynuyor!`,
        en: `🔥 SHARP MONEY ALERT! ${sharpLabel.en} odds DROPPED ${maxDrop}%! Pros are betting this way!`,
        de: `🔥 SHARP MONEY ALARM! ${sharpLabel.de} Quote um ${maxDrop}% GEFALLEN! Profis setzen hierauf!`,
      },
    };
  } else if (maxDrop >= 5) {
    return {
      direction: sharpDirection,
      confidence: 'medium',
      reasoning: {
        tr: `📊 ${sharpLabel.tr} oranı %${maxDrop} düştü. Dikkat edilmeli.`,
        en: `📊 ${sharpLabel.en} odds dropped ${maxDrop}%. Worth noting.`,
        de: `📊 ${sharpLabel.de} Quote um ${maxDrop}% gefallen. Beachtenswert.`,
      },
    };
  }

  return {
    direction: 'none',
    confidence: 'low',
    reasoning: {
      tr: '📊 Oran hareketi normal. Belirgin sharp money yok.',
      en: '📊 Normal odds movement. No significant sharp money.',
      de: '📊 Normale Quotenbewegung. Kein signifikantes Sharp Money.',
    },
  };
}

// ==================== REAL VALUE DETECTION ====================

export interface RealValueResult {
  isValue: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: {
    tr: string;
    en: string;
    de: string;
  };
  emoji: string;
}

export function isRealValue(
  formValue: number,
  oddsMovement: 'dropping' | 'rising' | 'stable'
): RealValueResult {
  
  // ✅ Form +5% value gösteriyor VE oran düşüyorsa = GERÇEK VALUE
  if (formValue >= 5 && oddsMovement === 'dropping') {
    return {
      isValue: true,
      confidence: 'high',
      reason: {
        tr: `✅ GERÇEK VALUE! Form +${formValue}% gösteriyor VE sharp money aynı yöne!`,
        en: `✅ REAL VALUE! Form shows +${formValue}% AND sharp money confirms!`,
        de: `✅ ECHTE VALUE! Form zeigt +${formValue}% UND Sharp Money bestätigt!`,
      },
      emoji: '🔥',
    };
  }

  // ⚠️ Form value gösteriyor AMA oran yükseliyorsa = DİKKAT
  if (formValue >= 5 && oddsMovement === 'rising') {
    return {
      isValue: false,
      confidence: 'low',
      reason: {
        tr: `⚠️ DİKKAT! Form +${formValue}% gösteriyor AMA oran yükseliyor. Bahisçi bir şey biliyor!`,
        en: `⚠️ CAUTION! Form shows +${formValue}% BUT odds rising. Bookies know something!`,
        de: `⚠️ VORSICHT! Form zeigt +${formValue}% ABER Quote steigt. Buchmacher wissen etwas!`,
      },
      emoji: '⚠️',
    };
  }

  // 🟡 Form value gösteriyor, oran stabil = ORTA VALUE
  if (formValue >= 5 && oddsMovement === 'stable') {
    return {
      isValue: true,
      confidence: 'medium',
      reason: {
        tr: `🟡 ORTA VALUE. Form +${formValue}% gösteriyor, oran stabil.`,
        en: `🟡 MEDIUM VALUE. Form shows +${formValue}%, odds stable.`,
        de: `🟡 MITTLERE VALUE. Form zeigt +${formValue}%, Quote stabil.`,
      },
      emoji: '🟡',
    };
  }

  // 📊 Düşük value
  if (formValue > 0 && formValue < 5) {
    return {
      isValue: false,
      confidence: 'low',
      reason: {
        tr: `📊 Düşük value (+${formValue}%). Risk/ödül oranı düşük.`,
        en: `📊 Low value (+${formValue}%). Risk/reward not great.`,
        de: `📊 Geringe Value (+${formValue}%). Risiko/Ertrag nicht optimal.`,
      },
      emoji: '📊',
    };
  }

  // ❌ Value yok
  return {
    isValue: false,
    confidence: 'low',
    reason: {
      tr: '❌ Value yok. Piyasa doğru fiyatlamış.',
      en: '❌ No value. Market priced correctly.',
      de: '❌ Keine Value. Markt korrekt bepreist.',
    },
    emoji: '❌',
  };
}

// ==================== BETTING VOLUME ANALYSIS ====================
// Oran hareketlerinden bahis hacmini tahmin eder
// Örnek: "Normalden %7 fazla bahis yapılmış" gibi bilgi verir

export function analyzeBettingVolume(oddsHistory: MatchOddsHistory): BettingVolumeResult {
  const allMarkets = [
    { 
      key: 'home' as const, 
      data: oddsHistory.homeWin, 
      label: { tr: 'Ev Galibiyeti', en: 'Home Win', de: 'Heimsieg' } 
    },
    { 
      key: 'away' as const, 
      data: oddsHistory.awayWin, 
      label: { tr: 'Deplasman', en: 'Away Win', de: 'Auswärtssieg' } 
    },
    { 
      key: 'draw' as const, 
      data: oddsHistory.draw, 
      label: { tr: 'Beraberlik', en: 'Draw', de: 'Unentschieden' } 
    },
    { 
      key: 'over' as const, 
      data: oddsHistory.over25, 
      label: { tr: 'Üst 2.5', en: 'Over 2.5', de: 'Über 2.5' } 
    },
    { 
      key: 'under' as const, 
      data: oddsHistory.under25, 
      label: { tr: 'Alt 2.5', en: 'Under 2.5', de: 'Unter 2.5' } 
    },
    { 
      key: 'btts_yes' as const, 
      data: oddsHistory.bttsYes, 
      label: { tr: 'BTTS Evet', en: 'BTTS Yes', de: 'BTTS Ja' } 
    },
    { 
      key: 'btts_no' as const, 
      data: oddsHistory.bttsNo, 
      label: { tr: 'BTTS Hayır', en: 'BTTS No', de: 'BTTS Nein' } 
    },
  ];

  // Her market için bahis hacmi skoru hesapla
  const volumeScores = allMarkets.map(market => {
    const { data } = market;
    
    // Oran düşüş yüzdesi = bahis hacmi göstergesi
    // %10 düşüş ≈ %20-30 fazla bahis hacmi (tahmini)
    // %5 düşüş ≈ %10-15 fazla bahis hacmi (tahmini)
    let volumeIncrease = 0;
    let oddsDropSpeed = 0;
    let movementStrength = 0;
    let isUnusual = false;

    if (data.movement === 'dropping') {
      // Oran düşüşü ne kadar büyükse, bahis hacmi o kadar fazla
      const dropPercent = Math.abs(data.changePercent);
      
      // Oran düşüş hızı tahmini (saatlik % düşüş)
      // Genellikle oranlar 24-48 saat içinde açılır ve değişir
      // %10 düşüş 24 saatte = %0.42/saat
      oddsDropSpeed = dropPercent / 24; // Basit tahmin
      
      // Bahis hacmi artışı tahmini
      // Oran düşüşü ile bahis hacmi arasında doğrusal olmayan ilişki var
      // %5 düşüş ≈ %10-15 fazla bahis
      // %10 düşüş ≈ %25-35 fazla bahis
      // %15+ düşüş ≈ %50+ fazla bahis (çok yüksek hacim)
      if (dropPercent >= 15) {
        volumeIncrease = 50 + (dropPercent - 15) * 2; // %15+ için ekstra
      } else if (dropPercent >= 10) {
        volumeIncrease = 25 + (dropPercent - 10) * 2.5; // %10-15 arası
      } else if (dropPercent >= 5) {
        volumeIncrease = 10 + (dropPercent - 5) * 3; // %5-10 arası
      } else {
        volumeIncrease = dropPercent * 2; // %0-5 arası
      }

      // Hareket gücü (0-100)
      movementStrength = Math.min(100, dropPercent * 5);
      
      // Normalden farklı mı? (%7+ düşüş = unusual)
      isUnusual = dropPercent >= 7;
    } else if (data.movement === 'rising') {
      // Oran yükseliyorsa, o tarafa az bahis yapılıyor demektir
      volumeIncrease = -Math.abs(data.changePercent) * 1.5; // Negatif = az bahis
      movementStrength = Math.abs(data.changePercent) * 3;
      isUnusual = Math.abs(data.changePercent) >= 7;
    }

    return {
      market: market.key,
      volumeIncrease: Math.round(volumeIncrease),
      oddsDropSpeed: Math.round(oddsDropSpeed * 100) / 100,
      movementStrength: Math.round(movementStrength),
      isUnusual,
      label: market.label,
      changePercent: data.changePercent,
    };
  });

  // En yüksek bahis hacmi olan market'i bul
  const topVolume = volumeScores.reduce((max, current) => 
    current.volumeIncrease > max.volumeIncrease ? current : max
  );

  // Eğer hiçbir market'te anlamlı hacim yoksa
  if (topVolume.volumeIncrease < 5) {
    return {
      market: 'none',
      volumeIncrease: 0,
      confidence: 'low',
      reasoning: {
        tr: '📊 Bahis hacmi normal seviyede. Belirgin bir artış yok.',
        en: '📊 Betting volume is normal. No significant increase.',
        de: '📊 Wettvolumen ist normal. Kein signifikanter Anstieg.',
      },
      indicators: {
        oddsDropSpeed: 0,
        movementStrength: 0,
        isUnusual: false,
      },
    };
  }

  // Confidence belirleme
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (topVolume.volumeIncrease >= 20 && topVolume.isUnusual) {
    confidence = 'high';
  } else if (topVolume.volumeIncrease >= 10) {
    confidence = 'medium';
  }

  // Reasoning oluştur
  const volumeText = topVolume.volumeIncrease > 0 
    ? `normalden %${topVolume.volumeIncrease} fazla` 
    : `normalden %${Math.abs(topVolume.volumeIncrease)} az`;

  return {
    market: topVolume.market,
    volumeIncrease: topVolume.volumeIncrease,
    confidence,
    reasoning: {
      tr: `🔥 ${topVolume.label.tr} market'ine ${volumeText} bahis yapılmış! Oran %${Math.abs(topVolume.changePercent)} ${topVolume.changePercent < 0 ? 'düştü' : 'yükseldi'}. Bu, profesyonel bahisçilerin veya büyük bahis hacminin işareti olabilir.`,
      en: `🔥 ${topVolume.label.en} market has ${volumeText} betting volume! Odds ${topVolume.changePercent < 0 ? 'dropped' : 'rose'} ${Math.abs(topVolume.changePercent)}%. This could indicate professional bettors or large betting volume.`,
      de: `🔥 ${topVolume.label.de} Markt hat ${volumeText} Wettvolumen! Quote ${topVolume.changePercent < 0 ? 'fiel' : 'stieg'} um ${Math.abs(topVolume.changePercent)}%. Dies könnte auf professionelle Wettende oder großes Wettvolumen hindeuten.`,
    },
    indicators: {
      oddsDropSpeed: topVolume.oddsDropSpeed,
      movementStrength: topVolume.movementStrength,
      isUnusual: topVolume.isUnusual,
    },
  };
}
