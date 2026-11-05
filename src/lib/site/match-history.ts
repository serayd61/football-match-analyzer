// ============================================================================
// Maç geçmişi — saf katman (feed-1.1, 2026-11-03)
// ----------------------------------------------------------------------------
// Herkese açık maç sayfasının form + H2H kaynağı iki arşivden birleşir:
//   - feed_matches: günlük akış arşivi, TÜM ligler (CL/EL dahil), Eylül 2026'dan;
//   - engine_predictions: motorun puanladığı maçlar, Temmuz 2026'dan.
// İkisi de HistoryRow'a indirgenir, fixture id ile tekilleştirilir, yeniden
// eskiye sıralanır. Model sayısı (olasılık, seçim, güven) BURADAN GEÇMEZ.
// Ayrıca motor satırı olmayan akış maçı için PublicMatch üretir ("açık maç").
// Sunucu sorguları match-history-data.ts içinde; burası testlenebilir saf kod.
// ============================================================================
import type { SitePrediction } from './predictions';
import type { MatchStatus } from './status';
import type { SiteLeague } from './leagues';
import { resolveLeague } from './leagues';
import type { PublicMatch } from './match-public';
import { matchSlug } from '@/lib/seo';

export interface HistoryRow {
  fixtureId: number;
  league: SiteLeague | null;
  leagueName: string;
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string;
}

/** feed_matches satırı (select ile gelen alt küme). */
export interface FeedMatchRecord {
  fixture_id: number;
  league_id: number;
  league_name: string;
  league_ccode: string;
  home_id: number;
  home_name: string;
  away_id: number;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  kickoff: string;
  status: string;
  updated_at: string | null;
}

export function fromFeedRow(r: FeedMatchRecord): HistoryRow {
  return {
    fixtureId: Number(r.fixture_id),
    league: resolveLeague(r.league_name, r.league_id, r.league_ccode),
    leagueName: r.league_name || '',
    homeId: Number(r.home_id), homeName: r.home_name,
    awayId: Number(r.away_id), awayName: r.away_name,
    homeScore: r.home_score, awayScore: r.away_score,
    kickoff: r.kickoff,
  };
}

export function fromEngineRow(p: SitePrediction): HistoryRow {
  return {
    fixtureId: p.fixtureId, league: p.league, leagueName: p.leagueName,
    homeId: p.homeId, homeName: p.homeName, awayId: p.awayId, awayName: p.awayName,
    homeScore: p.homeScore, awayScore: p.awayScore, kickoff: p.kickoff,
  };
}

/** Skorlu satırları birleştirir: fixture id tekil (ilk liste öncelikli), yeniden eskiye, en çok `limit`. */
export function mergeHistory(primary: HistoryRow[], secondary: HistoryRow[], limit: number): HistoryRow[] {
  const seen = new Set<number>();
  const out: HistoryRow[] = [];
  for (const r of [...primary, ...secondary]) {
    if (r.homeScore == null || r.awayScore == null) continue;
    if (seen.has(r.fixtureId)) continue;
    seen.add(r.fixtureId);
    out.push(r);
  }
  out.sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
  return out.slice(0, Math.max(0, limit));
}

const CREST = (id: number) => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

export function feedStatusToMatchStatus(s: string): MatchStatus {
  switch (s) {
    case 'finished': return 'finished';
    case 'live': return 'live';
    case 'cancelled': return 'cancelled';
    case 'scheduled': return 'scheduled';
    default: return 'unknown';
  }
}

/**
 * Motor satırı olmayan akış maçının herkese açık görünümü: fikstür olguları,
 * skor (bitmişse), lig çözümü. verdict daima null, openMatch true — sayfa
 * "tahmin yok, açık maç" rozetini bundan türetir.
 */
export function feedPublicMatch(r: FeedMatchRecord): PublicMatch {
  const status = feedStatusToMatchStatus(r.status);
  const settled = status === 'finished';
  return {
    fixtureId: Number(r.fixture_id),
    slug: matchSlug(r.home_name, r.away_name, r.fixture_id),
    league: resolveLeague(r.league_name, r.league_id, r.league_ccode),
    leagueName: r.league_name || '',
    leagueId: Number(r.league_id),
    homeId: Number(r.home_id), homeName: r.home_name,
    awayId: Number(r.away_id), awayName: r.away_name,
    homeCrest: CREST(Number(r.home_id)), awayCrest: CREST(Number(r.away_id)),
    kickoff: r.kickoff,
    status,
    settled,
    homeScore: settled ? r.home_score : null,
    awayScore: settled ? r.away_score : null,
    updatedAt: r.updated_at,
    verdict: null,
    openMatch: true,
    lean: null,
  };
}
