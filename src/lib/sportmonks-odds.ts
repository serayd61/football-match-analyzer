// src/lib/sportmonks-odds.ts
// Sportmonks Historical Odds Fetcher

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_TOKEN;

interface OddsHistory {
  opening: number;
  current: number;
  movement: 'dropping' | 'rising' | 'stable';
  changePercent: number;
}

interface MatchOddsHistory {
  homeWin: OddsHistory;
  draw: OddsHistory;
  awayWin: OddsHistory;
  over25: OddsHistory;
  under25: OddsHistory;
  bttsYes: OddsHistory;
  bttsNo: OddsHistory;
}

// Oran değişim yönünü hesapla
function calculateMovement(opening: number, current: number): 'dropping' | 'rising' | 'stable' {
  const changePercent = ((current - opening) / opening) * 100;
  if (changePercent <= -5) return 'dropping';  // %5+ düştü - SHARP MONEY
  if (changePercent >= 5) return 'rising';      // %5+ yükseldi
  return 'stable';
}

// Sportmonks'tan historical odds çek
export async function fetchHistoricalOdds(fixtureId: number): Promise<MatchOddsHistory | null> {
  try {
    // Pre-match odds with history
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/odds/pre-match/fixtures/${fixtureId}?api_token=${SPORTMONKS_TOKEN}&include=market;bookmaker`,
      { next: { revalidate: 300 } } // 5 dk cache
    );

    if (!response.ok) {
      console.error('Sportmonks odds API error:', response.status);
      return null;
    }

    const data = await response.json();
    const odds = data.data || [];

    // Market ID'leri (Sportmonks standart)
    // 1 = Match Winner (1X2)
    // 12 = Over/Under 2.5
    // 28 = Both Teams to Score

    let homeWinOpening = 0, homeWinCurrent = 0;
    let drawOpening = 0, drawCurrent = 0;
    let awayWinOpening = 0, awayWinCurrent = 0;
    let over25Opening = 0, over25Current = 0;
    let under25Opening = 0, under25Current = 0;
    let bttsYesOpening = 0, bttsYesCurrent = 0;
    let bttsNoOpening = 0, bttsNoCurrent = 0;

    // Oranları parse et
    for (const odd of odds) {
      const marketId = odd.market_id;
      const label = odd.label;
      const value = parseFloat(odd.value) || 0;
      const isOriginal = odd.original === true; // Açılış oranı mı?

      // Match Winner (1X2)
      if (marketId === 1) {
        if (label === '1' || label === 'Home') {
          if (isOriginal) homeWinOpening = value;
          else homeWinCurrent = value;
        } else if (label === 'X' || label === 'Draw') {
          if (isOriginal) drawOpening = value;
          else drawCurrent = value;
        } else if (label === '2' || label === 'Away') {
          if (isOriginal) awayWinOpening = value;
          else awayWinCurrent = value;
        }
      }

      // Over/Under 2.5
      if (marketId === 12 && odd.name?.includes('2.5')) {
        if (label === 'Over') {
          if (isOriginal) over25Opening = value;
          else over25Current = value;
        } else if (label === 'Under') {
          if (isOriginal) under25Opening = value;
          else under25Current = value;
        }
      }

      // BTTS
      if (marketId === 28) {
        if (label === 'Yes') {
          if (isOriginal) bttsYesOpening = value;
          else bttsYesCurrent = value;
        } else if (label === 'No') {
          if (isOriginal) bttsNoOpening = value;
          else bttsNoCurrent = value;
        }
      }
    }

    // Eğer açılış oranı yoksa, current'ı kullan
    if (!homeWinOpening) homeWinOpening = homeWinCurrent;
    if (!drawOpening) drawOpening = drawCurrent;
    if (!awayWinOpening) awayWinOpening = awayWinCurrent;
    if (!over25Opening) over25Opening = over25Current;
    if (!under25Opening) under25Opening = under25Current;
    if (!bttsYesOpening) bttsYesOpening = bttsYesCurrent;
    if (!bttsNoOpening) bttsNoOpening = bttsNoCurrent;

    return {
      homeWin: {
        opening: homeWinOpening,
        current: homeWinCurrent || homeWinOpening,
        movement: calculateMovement(homeWinOpening, homeWinCurrent || homeWinOpening),
        changePercent: homeWinOpening ? Math.round(((homeWinCurrent - homeWinOpening) / homeWinOpening) * 100) : 0,
      },
      draw: {
        opening: drawOpening,
        current: drawCurrent || drawOpening,
        movement: calculateMovement(drawOpening, drawCurrent || drawOpening),
        changePercent: drawOpening ? Math.round(((drawCurrent - drawOpening) / drawOpening) * 100) : 0,
      },
      awayWin: {
        opening: awayWinOpening,
        current: awayWinCurrent || awayWinOpening,
        movement: calculateMovement(awayWinOpening, awayWinCurrent || awayWinOpening),
        changePercent: awayWinOpening ? Math.round(((awayWinCurrent - awayWinOpening) / awayWinOpening) * 100) : 0,
      },
      over25: {
        opening: over25Opening,
        current: over25Current || over25Opening,
        movement: calculateMovement(over25Opening, over25Current || over25Opening),
        changePercent: over25Opening ? Math.round(((over25Current - over25Opening) / over25Opening) * 100) : 0,
      },
      under25: {
        opening: under25Opening,
        current: under25Current || under25Opening,
        movement: calculateMovement(under25Opening, under25Current || under25Opening),
        changePercent: under25Opening ? Math.round(((under25Current - under25Opening) / under25Opening) * 100) : 0,
      },
      bttsYes: {
        opening: bttsYesOpening,
        current: bttsYesCurrent || bttsYesOpening,
        movement: calculateMovement(bttsYesOpening, bttsYesCurrent || bttsYesOpening),
        changePercent: bttsYesOpening ? Math.round(((bttsYesCurrent - bttsYesOpening) / bttsYesOpening) * 100) : 0,
      },
      bttsNo: {
        opening: bttsNoOpening,
        current: bttsNoCurrent || bttsNoOpening,
        movement: calculateMovement(bttsNoOpening, bttsNoCurrent || bttsNoOpening),
        changePercent: bttsNoOpening ? Math.round(((bttsNoCurrent - bttsNoOpening) / bttsNoOpening) * 100) : 0,
      },
    };
  } catch (error) {
    console.error('Failed to fetch historical odds:', error);
    return null;
  }
}

// Sharp money analizi
export function analyzeSharpMoney(oddsHistory: MatchOddsHistory): {
  direction: 'home' | 'away' | 'draw' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  const movements = {
    home: oddsHistory.homeWin,
    draw: oddsHistory.draw,
    away: oddsHistory.awayWin,
  };

  // En çok düşen oranı bul (sharp money)
  let maxDrop = 0;
  let sharpDirection: 'home' | 'away' | 'draw' | 'none' = 'none';

  for (const [key, data] of Object.entries(movements)) {
    if (data.movement === 'dropping' && Math.abs(data.changePercent) > maxDrop) {
      maxDrop = Math.abs(data.changePercent);
      sharpDirection = key as 'home' | 'away' | 'draw';
    }
  }

  if (maxDrop >= 10) {
    return {
      direction: sharpDirection,
      confidence: 'high',
      reasoning: `🔥 SHARP MONEY ALERT! ${sharpDirection.toUpperCase()} oranı %${maxDrop} düştü. Profesyoneller bu tarafa oynuyor!`,
    };
  } else if (maxDrop >= 5) {
    return {
      direction: sharpDirection,
      confidence: 'medium',
      reasoning: `📊 ${sharpDirection.toUpperCase()} oranı %${maxDrop} düştü. Dikkat edilmeli.`,
    };
  }

  return {
    direction: 'none',
    confidence: 'low',
    reasoning: '📊 Oran hareketi normal. Belirgin sharp money yok.',
  };
}
