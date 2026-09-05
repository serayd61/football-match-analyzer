import { resolveLeague } from './leagues';
import { feedStatus } from './status';
import type { SitePrediction } from './predictions';

// Pure merge of the schedule feed into a day's predictions (unit-tested).

export interface FeedRow {
  id: number; homeTeam: string; awayTeam: string; homeTeamId: number; awayTeamId: number;
  homeTeamLogo: string; awayTeamLogo: string; league: string; leagueId: number; leagueLogo: string;
  leagueCountry: string; date: string; status: string; homeScore?: number; awayScore?: number;
}

export type Catalog = Map<number, { ccode: string; name: string }>;

const crest = (id: number | null) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null);

export function fixtureRow(f: FeedRow, catalog: Catalog): SitePrediction {
  const cat = catalog.get(Number(f.leagueId));
  const league = resolveLeague(f.league, f.leagueId, f.leagueCountry || cat?.ccode);
  return {
    fixtureId: f.id, league, leagueName: league?.name || f.league, leagueId: f.leagueId, covered: !!league,
    homeId: f.homeTeamId, homeName: f.homeTeam, awayId: f.awayTeamId, awayName: f.awayTeam,
    homeCrest: crest(f.homeTeamId), awayCrest: crest(f.awayTeamId), kickoff: f.date,
    pHome: 0, pDraw: 0, pAway: 0, lambdaHome: null, lambdaAway: null, pick: null, confidence: null, confidenceRaw: null,
    doubleChance: null, overUnder: null, btts: null, rationale: null,
    settled: false, homeScore: f.homeScore ?? null, awayScore: f.awayScore ?? null, result: null,
    outcome: 'pending', modelVersion: null, updatedAt: null, hasModel: false,
    status: feedStatus(f.status), modelStatus: 'pending', publishedAfterKickoff: false,
  };
}

/**
 *  - a rated, unsettled row gets the feed's live state and running score,
 *  - unrated feed fixtures inside the day window are appended as pending,
 *  - cancelled feed fixtures without a model row are dropped.
 */
export function mergeFeed(predictions: SitePrediction[], feed: FeedRow[], catalog: Catalog, window: { from: number; to: number }): SitePrediction[] {
  const byId = new Map(feed.map((f) => [f.id, f]));
  const merged = predictions.map((p) => {
    const f = byId.get(p.fixtureId);
    if (!f || p.settled) return p;
    const status = feedStatus(f.status);
    const score = status === 'live' || status === 'finished';
    return {
      ...p,
      status,
      homeScore: score ? f.homeScore ?? p.homeScore : p.homeScore,
      awayScore: score ? f.awayScore ?? p.awayScore : p.awayScore,
    };
  });
  const known = new Set(predictions.map((p) => p.fixtureId));
  const extra = feed
    .filter((f) => !known.has(f.id) && f.status !== 'CANC')
    .filter((f) => { const t = new Date(f.date).getTime(); return t >= window.from && t < window.to; })
    .map((f) => fixtureRow(f, catalog));
  return [...merged, ...extra].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}
