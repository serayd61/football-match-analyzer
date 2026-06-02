// ============================================================================
// FREE API LIVE FOOTBALL DATA (RapidAPI, Creativesdev) — FotMob tabanlı
// Birincil canlı/fikstür/sonuç kaynağı. Sportmonks'un yerini aldı.
// ============================================================================

const HOST = 'free-api-live-football-data.p.rapidapi.com';
const BASE = `https://${HOST}`;
const KEY = process.env.FOOTBALL_API_KEY || '';

const FOTMOB_TEAM_LOGO = (id: number | string) =>
  `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;
const FOTMOB_LEAGUE_LOGO = (id: number | string) =>
  `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${id}.png`;

async function ffFetch(path: string): Promise<any | null> {
  if (!KEY) {
    console.error('[free-football] FOOTBALL_API_KEY missing');
    return null;
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error(`[free-football] ${path} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (json?.status && json.status !== 'success') {
      console.error(`[free-football] ${path} status=${json.status}`);
      return null;
    }
    return json?.response ?? null;
  } catch (e: any) {
    console.error(`[free-football] ${path} failed:`, e?.message);
    return null;
  }
}

// YYYY-MM-DD veya Date -> YYYYMMDD
export function toDateParam(d: string | Date): string {
  const iso = typeof d === 'string' ? d : d.toISOString();
  return iso.split('T')[0].replace(/-/g, '');
}

// ---- Lig allowlist (popular-leagues'ten dinamik, env ile genişletilebilir) ----
export interface LeagueMeta { id: number; name: string; ccode: string; logo: string }
let _leagueCache: { at: number; map: Map<number, LeagueMeta> } | null = null;
const LEAGUE_TTL = 6 * 60 * 60 * 1000; // 6 saat

export async function getPopularLeagues(): Promise<Map<number, LeagueMeta>> {
  if (_leagueCache && Date.now() - _leagueCache.at < LEAGUE_TTL) return _leagueCache.map;
  const resp = await ffFetch('/football-popular-leagues');
  const map = new Map<number, LeagueMeta>();
  for (const l of resp?.popular || []) {
    map.set(l.id, { id: l.id, name: l.localizedName || l.name, ccode: l.ccode || '', logo: l.logo || FOTMOB_LEAGUE_LOGO(l.id) });
  }
  // env ile ekstra lig ID'leri (isim bilinmiyorsa generic)
  const extra = (process.env.FOOTBALL_LEAGUE_IDS || '')
    .split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
  for (const id of extra) {
    if (!map.has(id)) map.set(id, { id, name: `League ${id}`, ccode: '', logo: FOTMOB_LEAGUE_LOGO(id) });
  }
  if (map.size) _leagueCache = { at: Date.now(), map };
  return map;
}

// ---- Normalize edilmiş maç ----
export interface FFMatch {
  id: number;
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  leagueCountry: string;
  homeId: number;
  homeName: string;
  homeLogo: string;
  awayId: number;
  awayName: string;
  awayLogo: string;
  homeScore: number | null;
  awayScore: number | null;
  utcTime: string;
  finished: boolean;
  started: boolean;
  cancelled: boolean;
}

function normalize(m: any, leagues: Map<number, LeagueMeta>): FFMatch {
  const lid = m.leagueId;
  const lm = leagues.get(lid);
  const st = m.status || {};
  return {
    id: m.id,
    leagueId: lid,
    leagueName: lm?.name || `League ${lid}`,
    leagueLogo: lm?.logo || FOTMOB_LEAGUE_LOGO(lid),
    leagueCountry: lm?.ccode || '',
    homeId: m.home?.id,
    homeName: m.home?.longName || m.home?.name || 'Unknown',
    homeLogo: FOTMOB_TEAM_LOGO(m.home?.id),
    awayId: m.away?.id,
    awayName: m.away?.longName || m.away?.name || 'Unknown',
    awayLogo: FOTMOB_TEAM_LOGO(m.away?.id),
    homeScore: typeof m.home?.score === 'number' ? m.home.score : null,
    awayScore: typeof m.away?.score === 'number' ? m.away.score : null,
    utcTime: st.utcTime || m.timeTS ? new Date(st.utcTime || m.timeTS).toISOString() : '',
    finished: !!st.finished,
    started: !!st.started,
    cancelled: !!st.cancelled,
  };
}

/**
 * Belirli bir günün maçları (yalnızca allowlist'teki ligler).
 * date: 'YYYY-MM-DD' | 'YYYYMMDD' | Date
 */
export async function getMatchesByDate(date: string | Date): Promise<FFMatch[]> {
  const param = /^\d{8}$/.test(String(date)) ? String(date) : toDateParam(date);
  const [resp, leagues] = await Promise.all([
    ffFetch(`/football-get-matches-by-date?date=${param}`),
    getPopularLeagues(),
  ]);
  const matches = resp?.matches || [];
  return matches
    .filter((m: any) => leagues.has(m.leagueId))
    .map((m: any) => normalize(m, leagues));
}

/** Tek bir maçı tarih + id ile bul (settle için). */
export async function getMatchById(fixtureId: number, matchDate: string | Date): Promise<FFMatch | null> {
  const list = await getMatchesByDate(matchDate);
  return list.find(m => m.id === Number(fixtureId)) || null;
}

/** Şu an canlı olan maçlar (allowlist'te). */
export async function getLiveMatches(): Promise<FFMatch[]> {
  const [resp, leagues] = await Promise.all([
    ffFetch('/football-current-live'),
    getPopularLeagues(),
  ]);
  const live = resp?.live || [];
  return live
    .filter((m: any) => leagues.has(m.leagueId))
    .map((m: any) => normalize(m, leagues));
}
