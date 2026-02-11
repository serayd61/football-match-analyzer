// ============================================================================
// SURVIVAL AGENT - Similarity Matcher
// Yeni maçla geçmiş maçlar arasında benzerlik skoru hesaplar
// ============================================================================

import type { SettledMatch } from './historical-engine';

export interface SimilarMatch {
  match: SettledMatch;
  similarityScore: number;
  reasons: string[];
}

export interface MatchFingerprint {
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  homeFormPoints?: number;  // Son 10 maç form puanı
  awayFormPoints?: number;
  expectedGoals?: number;
}

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

export function findSimilarMatches(
  fingerprint: MatchFingerprint,
  settledMatches: SettledMatch[],
  maxResults = 50
): SimilarMatch[] {
  const scored: SimilarMatch[] = [];

  for (const match of settledMatches) {
    const { score, reasons } = calculateSimilarity(fingerprint, match);
    if (score > 0.1) {
      scored.push({ match, similarityScore: score, reasons });
    }
  }

  // En yüksek benzerlik skoruna göre sırala
  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  return scored.slice(0, maxResults);
}

function calculateSimilarity(
  fp: MatchFingerprint,
  match: SettledMatch
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Lig eşleşmesi (en önemli faktör)
  if (match.league === fp.league) {
    score += 0.35;
    reasons.push('Aynı lig');
  } else {
    // Farklı lig = düşük benzerlik ama yine de odds/form benzerliği geçerli
    score += 0.05;
  }

  // 2. Aynı takımlar (H2H bonusu)
  const isH2H = (match.home_team === fp.homeTeam && match.away_team === fp.awayTeam) ||
                (match.home_team === fp.awayTeam && match.away_team === fp.homeTeam);
  if (isH2H) {
    score += 0.30;
    reasons.push('H2H maçı');
  }

  // 3. Odds benzerliği
  if (fp.homeOdds && match.analysis) {
    const matchOdds = extractOddsFromAnalysis(match.analysis);
    if (matchOdds.home) {
      const oddsDiff = Math.abs(fp.homeOdds - matchOdds.home);
      if (oddsDiff < 0.15) {
        score += 0.20;
        reasons.push('Çok benzer odds');
      } else if (oddsDiff < 0.30) {
        score += 0.15;
        reasons.push('Benzer odds');
      } else if (oddsDiff < 0.50) {
        score += 0.08;
      }
    }
  }

  // 4. Form benzerliği (confidence aralığı)
  if (match.overall_confidence) {
    const confDiff = fp.homeFormPoints
      ? Math.abs((fp.homeFormPoints / 30 * 100) - match.overall_confidence)
      : 999;
    if (confDiff < 5) {
      score += 0.10;
      reasons.push('Benzer güven profili');
    } else if (confDiff < 15) {
      score += 0.05;
    }
  }

  // 5. Yakınlık bonusu (son maçlara daha fazla ağırlık)
  if (match.match_date) {
    const daysDiff = daysBetween(match.match_date, new Date().toISOString());
    if (daysDiff < 30) {
      score += 0.05;
      reasons.push('Son 30 gün');
    } else if (daysDiff < 90) {
      score += 0.02;
    }
  }

  return { score: Math.min(score, 1.0), reasons };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractOddsFromAnalysis(analysis: any): { home: number; draw: number; away: number } {
  try {
    // analysis.sources.agents.odds altındaki odds verisi
    const odds = analysis?.sources?.agents?.odds ||
                 analysis?.sources?.agents?.stats?.odds ||
                 analysis?.odds;

    if (!odds) return { home: 0, draw: 0, away: 0 };

    // Farklı veri yapılarını destekle
    const home = odds?.matchWinner?.home || odds?.home || 0;
    const draw = odds?.matchWinner?.draw || odds?.draw || 0;
    const away = odds?.matchWinner?.away || odds?.away || 0;

    return {
      home: typeof home === 'number' ? home : parseFloat(home) || 0,
      draw: typeof draw === 'number' ? draw : parseFloat(draw) || 0,
      away: typeof away === 'number' ? away : parseFloat(away) || 0,
    };
  } catch {
    return { home: 0, draw: 0, away: 0 };
  }
}

function daysBetween(date1: string, date2: string): number {
  try {
    const d1 = new Date(date1).getTime();
    const d2 = new Date(date2).getTime();
    return Math.abs(Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
  } catch {
    return 999;
  }
}
