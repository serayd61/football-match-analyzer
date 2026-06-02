// ============================================================================
// API-FOOTBALL PROVIDER (RapidAPI api-football-v1)
// Sportmonks yerine birincil veri kaynağı. DataProvider arayüzünü uygular.
// ============================================================================

import {
  DataProvider, FixtureData, TeamStats, MatchData, Injury,
  H2HData, OddsData, RefereeData, LineupData, XGData,
} from './types';

const HOST = 'api-football-v1.p.rapidapi.com';
const BASE = `https://${HOST}/v3`;
const KEY = process.env.FOOTBALL_API_KEY || '';

// Hangi ligler taransın (queue-daily fixtures filtresi). Env ile override edilebilir.
// API-Football lig ID'leri (v3).
const DEFAULT_LEAGUE_IDS = [
  39,   // Premier League (ENG)
  140,  // La Liga (ESP)
  135,  // Serie A (ITA)
  78,   // Bundesliga (GER)
  61,   // Ligue 1 (FRA)
  88,   // Eredivisie (NED)
  94,   // Primeira Liga (POR)
  40,   // Championship (ENG)
  203,  // Süper Lig (TUR)
  2,    // UEFA Champions League
  3,    // UEFA Europa League
  848,  // UEFA Conference League
  71,   // Brasileirão Serie A
  253,  // MLS (USA)
  144,  // Jupiler Pro League (BEL)
  179,  // Scottish Premiership
  197,  // Super League (GRE)
];

export function getEnabledLeagueIds(): number[] {
  const raw = process.env.FOOTBALL_LEAGUE_IDS;
  if (raw) {
    const ids = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n));
    if (ids.length) return ids;
  }
  return DEFAULT_LEAGUE_IDS;
}

/** Avrupa sezonu: Temmuz+ ise yıl, değilse yıl-1 (örn. 2026-06 -> 2025). */
function currentSeason(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  return now.getUTCMonth() + 1 >= 7 ? y : y - 1;
}

function mapStatus(short: string): FixtureData['status'] {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live';
  if (['PST', 'CANC', 'ABD', 'SUSP', 'AWD', 'WO'].includes(short)) return 'postponed';
  return 'scheduled';
}

async function afFetch(path: string, params: Record<string, string | number>): Promise<any[] | null> {
  if (!KEY) {
    console.error('[api-football] FOOTBALL_API_KEY missing');
    return null;
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('timezone', 'UTC');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': HOST },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error(`[api-football] ${path} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (json?.errors && Object.keys(json.errors).length) {
      console.error('[api-football] API error', JSON.stringify(json.errors).slice(0, 200));
    }
    return Array.isArray(json?.response) ? json.response : [];
  } catch (e: any) {
    console.error(`[api-football] ${path} fetch failed:`, e?.message);
    return null;
  }
}

// Aynı istek içinde tekrar tekrar çekmemek için kısa ömürlü recent-matches cache'i
const recentCache = new Map<string, { at: number; raw: any[] }>();
const RECENT_TTL = 60_000;

async function getRawRecent(teamId: number, last = 20): Promise<any[]> {
  const key = `${teamId}:${last}`;
  const hit = recentCache.get(key);
  if (hit && Date.now() - hit.at < RECENT_TTL) return hit.raw;
  const raw = (await afFetch('/fixtures', { team: teamId, last })) || [];
  // sadece bitmiş maçları al
  const finished = raw.filter((f: any) => ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short));
  recentCache.set(key, { at: Date.now(), raw: finished });
  return finished;
}

function toMatchData(f: any, teamId: number): MatchData {
  const homeId = f.teams?.home?.id;
  const isHome = homeId === teamId;
  const hg = f.goals?.home ?? 0;
  const ag = f.goals?.away ?? 0;
  const teamScore = isHome ? hg : ag;
  const oppScore = isHome ? ag : hg;
  const result: 'W' | 'D' | 'L' = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
  return {
    date: (f.fixture?.date || '').split('T')[0],
    opponent: (isHome ? f.teams?.away?.name : f.teams?.home?.name) || '',
    isHome,
    teamScore,
    opponentScore: oppScore,
    result,
    totalGoals: hg + ag,
    btts: hg > 0 && ag > 0,
  };
}

export class ApiFootballProvider implements DataProvider {
  name = 'API-Football';
  priority = 1; // birincil

  async getFixture(fixtureId: number): Promise<FixtureData | null> {
    const resp = await afFetch('/fixtures', { id: fixtureId });
    const f = resp?.[0];
    if (!f) return null;
    return {
      fixtureId: f.fixture?.id,
      homeTeam: { id: f.teams?.home?.id, name: f.teams?.home?.name },
      awayTeam: { id: f.teams?.away?.id, name: f.teams?.away?.name },
      league: { id: f.league?.id, name: f.league?.name },
      date: f.fixture?.date || new Date().toISOString(),
      status: mapStatus(f.fixture?.status?.short || ''),
      score: f.goals ? { home: f.goals.home ?? 0, away: f.goals.away ?? 0 } : undefined,
      venue: f.fixture?.venue?.name,
    };
  }

  async getFixturesByDate(date: string, leagueId?: number): Promise<FixtureData[]> {
    const params: Record<string, string | number> = { date };
    if (leagueId) {
      params.league = leagueId;
      params.season = currentSeason();
    }
    const resp = (await afFetch('/fixtures', params)) || [];
    const allowed = leagueId ? null : new Set(getEnabledLeagueIds());
    return resp
      .filter((f: any) => (allowed ? allowed.has(f.league?.id) : true))
      .map((f: any) => ({
        fixtureId: f.fixture?.id,
        homeTeam: { id: f.teams?.home?.id, name: f.teams?.home?.name },
        awayTeam: { id: f.teams?.away?.id, name: f.teams?.away?.name },
        league: { id: f.league?.id, name: f.league?.name },
        date: f.fixture?.date || '',
        status: mapStatus(f.fixture?.status?.short || ''),
        score: f.goals ? { home: f.goals.home ?? 0, away: f.goals.away ?? 0 } : undefined,
        venue: f.fixture?.venue?.name,
      }));
  }

  async getTeamStats(teamId: number): Promise<TeamStats | null> {
    const matches = await getRawRecent(teamId, 20);
    if (!matches.length) return null;
    const md = matches.map(f => toMatchData(f, teamId));

    const n = md.length;
    const goalsScored = md.reduce((s, m) => s + m.teamScore, 0);
    const goalsConceded = md.reduce((s, m) => s + m.opponentScore, 0);
    const home = md.filter(m => m.isHome);
    const away = md.filter(m => !m.isHome);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const last5 = md.slice(0, 5);
    const recentForm = last5.map(m => m.result).join('');
    const formPoints = last5.reduce((s, m) => s + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0);

    return {
      teamId,
      teamName: '',
      recentForm,
      formPoints,
      goalsScored,
      goalsConceded,
      avgGoalsScored: +(goalsScored / n).toFixed(2),
      avgGoalsConceded: +(goalsConceded / n).toFixed(2),
      homeAvgGoalsScored: +avg(home.map(m => m.teamScore)).toFixed(2),
      homeAvgGoalsConceded: +avg(home.map(m => m.opponentScore)).toFixed(2),
      awayAvgGoalsScored: +avg(away.map(m => m.teamScore)).toFixed(2),
      awayAvgGoalsConceded: +avg(away.map(m => m.opponentScore)).toFixed(2),
      homeWins: home.filter(m => m.result === 'W').length,
      homeDraws: home.filter(m => m.result === 'D').length,
      homeLosses: home.filter(m => m.result === 'L').length,
      awayWins: away.filter(m => m.result === 'W').length,
      awayDraws: away.filter(m => m.result === 'D').length,
      awayLosses: away.filter(m => m.result === 'L').length,
      bttsPercentage: Math.round((md.filter(m => m.btts).length / n) * 100),
      over25Percentage: Math.round((md.filter(m => m.totalGoals > 2.5).length / n) * 100),
      under25Percentage: Math.round((md.filter(m => m.totalGoals <= 2.5).length / n) * 100),
      cleanSheets: md.filter(m => m.opponentScore === 0).length,
      failedToScore: md.filter(m => m.teamScore === 0).length,
    };
  }

  async getTeamRecentMatches(teamId: number, limit = 10): Promise<MatchData[]> {
    const matches = await getRawRecent(teamId, Math.max(limit, 10));
    return matches.slice(0, limit).map(f => toMatchData(f, teamId));
  }

  async getTeamInjuries(teamId: number): Promise<Injury[]> {
    const resp = await afFetch('/injuries', { team: teamId, season: currentSeason() });
    if (!resp) return [];
    return resp.slice(0, 30).map((i: any) => ({
      playerName: i.player?.name || 'Unknown',
      reason: i.player?.reason || i.player?.type || 'Unknown',
    }));
  }

  async getHeadToHead(homeTeamId: number, awayTeamId: number): Promise<H2HData | null> {
    const resp = await afFetch('/fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}`, last: 10 });
    if (!resp || !resp.length) return null;
    const finished = resp.filter((f: any) => ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short));
    if (!finished.length) return null;

    let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, bttsCount = 0, over25 = 0;
    const recentMatches: MatchData[] = finished.map((f: any) => {
      const hg = f.goals?.home ?? 0;
      const ag = f.goals?.away ?? 0;
      const homeIsHomeTeam = f.teams?.home?.id === homeTeamId;
      const homeTeamGoals = homeIsHomeTeam ? hg : ag;
      const awayTeamGoals = homeIsHomeTeam ? ag : hg;
      if (homeTeamGoals > awayTeamGoals) homeWins++;
      else if (homeTeamGoals < awayTeamGoals) awayWins++;
      else draws++;
      totalGoals += hg + ag;
      if (hg > 0 && ag > 0) bttsCount++;
      if (hg + ag > 2.5) over25++;
      const result: 'W' | 'D' | 'L' = homeTeamGoals > awayTeamGoals ? 'W' : homeTeamGoals < awayTeamGoals ? 'L' : 'D';
      return {
        date: (f.fixture?.date || '').split('T')[0],
        opponent: '',
        isHome: homeIsHomeTeam,
        teamScore: homeTeamGoals,
        opponentScore: awayTeamGoals,
        result,
        totalGoals: hg + ag,
        btts: hg > 0 && ag > 0,
      };
    });
    const total = finished.length;
    return {
      totalMatches: total,
      homeWins,
      awayWins,
      draws,
      avgGoals: +(totalGoals / total).toFixed(2),
      over25Percentage: Math.round((over25 / total) * 100),
      bttsPercentage: Math.round((bttsCount / total) * 100),
      recentMatches,
    };
  }

  async getPreMatchOdds(fixtureId: number): Promise<OddsData | null> {
    const resp = await afFetch('/odds', { fixture: fixtureId, bookmaker: 8 }); // Bet365
    const book = resp?.[0]?.bookmakers?.[0];
    if (!book) return null;
    const bets: any[] = book.bets || [];
    const findBet = (id: number) => bets.find(b => b.id === id);
    const val = (bet: any, name: string) => {
      const v = bet?.values?.find((x: any) => String(x.value).toLowerCase() === name.toLowerCase());
      return v ? parseFloat(v.odd) : undefined;
    };

    const mw = findBet(1);   // Match Winner
    const ou = findBet(5);   // Goals Over/Under
    const btts = findBet(8); // Both Teams To Score

    if (!mw && !ou && !btts) return null;
    return {
      matchWinner: {
        home: val(mw, 'Home') || 2.0,
        draw: val(mw, 'Draw') || 3.0,
        away: val(mw, 'Away') || 2.5,
      },
      overUnder25: {
        over: val(ou, 'Over 2.5') || 1.9,
        under: val(ou, 'Under 2.5') || 1.9,
      },
      btts: {
        yes: val(btts, 'Yes') || 1.8,
        no: val(btts, 'No') || 2.0,
      },
    };
  }

  // API-Football temel planda hakem istatistiği vermiyor → null (opsiyonel veri)
  async getReferee(_fixtureId: number): Promise<RefereeData | null> {
    return null;
  }

  async getLineup(fixtureId: number): Promise<LineupData | null> {
    const resp = await afFetch('/fixtures/lineups', { fixture: fixtureId });
    if (!resp || resp.length < 2) return null;
    const mapSide = (side: any) => ({
      formation: side?.formation || '4-3-3',
      players: (side?.startXI || []).map((p: any) => ({
        name: p.player?.name || 'Unknown',
        position: p.player?.pos || 'MID',
      })),
    });
    return { home: mapSide(resp[0]), away: mapSide(resp[1]) };
  }

  // xG temel planda yok → null (sistem null'a dayanıklı)
  async getTeamXG(_teamId: number): Promise<XGData | null> {
    return null;
  }
}
