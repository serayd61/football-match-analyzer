// src/types/coupon.ts

export type CouponStatus = 'PENDING' | 'WON' | 'LOST' | 'PARTIAL' | 'CANCELLED';
export type BetType = 'MATCH_RESULT' | 'OVER_UNDER_25' | 'OVER_UNDER_35' | 'BTTS' | 'DOUBLE_CHANCE';
export type PickResult = 'PENDING' | 'WON' | 'LOST' | 'VOID';

export interface CouponPick {
  id?: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: Date | string;
  betType: BetType;
  selection: string;
  odds: number;
  result?: PickResult;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface Coupon {
  id: string;
  userId: string;
  picks: CouponPick[];
  totalOdds: number;
  status: CouponStatus;
  pointsEarned: number;
  isPublic: boolean;
  title?: string;
  description?: string;
  createdAt: Date | string;
  settledAt?: Date | string | null;
  user?: {
    id: string;
    name: string;
    image?: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage?: string;
  totalPoints: number;
  totalCoupons: number;
  wonCoupons: number;
  winRate: number;
}

// Puan hesaplama sabitleri
export const POINTS_MULTIPLIER = {
  SINGLE: 10,      // Tekli bahis
  DOUBLE: 15,      // 2'li kombine
  TREBLE: 25,      // 3'lü kombine
  ACCUMULATOR: 50, // 4+ kombine
} as const;

// Bet type labels
export const BET_TYPE_LABELS: Record<BetType, string> = {
  MATCH_RESULT: 'Maç Sonucu (1X2)',
  OVER_UNDER_25: 'Alt/Üst 2.5',
  OVER_UNDER_35: 'Alt/Üst 3.5',
  BTTS: 'Karşılıklı Gol',
  DOUBLE_CHANCE: 'Çifte Şans',
};

// Selection labels
export const SELECTION_LABELS: Record<string, string> = {
  '1': 'Ev Sahibi',
  'X': 'Beraberlik',
  '2': 'Deplasman',
  'Over': 'Üst',
  'Under': 'Alt',
  'Yes': 'Var',
  'No': 'Yok',
  '1X': 'Ev Sahibi veya Beraberlik',
  '12': 'Ev Sahibi veya Deplasman',
  'X2': 'Beraberlik veya Deplasman',
};

// Puan hesaplama fonksiyonu
export function calculatePoints(totalOdds: number, pickCount: number): number {
  let multiplier = POINTS_MULTIPLIER.SINGLE;
  
  if (pickCount === 2) {
    multiplier = POINTS_MULTIPLIER.DOUBLE;
  } else if (pickCount === 3) {
    multiplier = POINTS_MULTIPLIER.TREBLE;
  } else if (pickCount >= 4) {
    multiplier = POINTS_MULTIPLIER.ACCUMULATOR;
  }
  
  return Math.round(totalOdds * multiplier * 10) / 10;
}

// Bahis sonucu kontrol fonksiyonu
export function checkPickResult(
  pick: CouponPick,
  homeScore: number,
  awayScore: number
): PickResult {
  const totalGoals = homeScore + awayScore;
  
  switch (pick.betType) {
    case 'MATCH_RESULT':
      if (pick.selection === '1' && homeScore > awayScore) return 'WON';
      if (pick.selection === 'X' && homeScore === awayScore) return 'WON';
      if (pick.selection === '2' && homeScore < awayScore) return 'WON';
      return 'LOST';
      
    case 'OVER_UNDER_25':
      if (pick.selection === 'Over' && totalGoals > 2.5) return 'WON';
      if (pick.selection === 'Under' && totalGoals < 2.5) return 'WON';
      return 'LOST';
      
    case 'OVER_UNDER_35':
      if (pick.selection === 'Over' && totalGoals > 3.5) return 'WON';
      if (pick.selection === 'Under' && totalGoals < 3.5) return 'WON';
      return 'LOST';
      
    case 'BTTS':
      const bttsResult = homeScore > 0 && awayScore > 0;
      if (pick.selection === 'Yes' && bttsResult) return 'WON';
      if (pick.selection === 'No' && !bttsResult) return 'WON';
      return 'LOST';
      
    case 'DOUBLE_CHANCE':
      if (pick.selection === '1X' && homeScore >= awayScore) return 'WON';
      if (pick.selection === '12' && homeScore !== awayScore) return 'WON';
      if (pick.selection === 'X2' && homeScore <= awayScore) return 'WON';
      return 'LOST';
      
    default:
      return 'PENDING';
  }
}

