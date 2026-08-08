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

// ---- Lig isim/logo haritası (popular + all-leagues birleşik, cache'li) ----
export interface LeagueMeta { id: number; name: string; ccode: string; logo: string }
let _leagueCache: { at: number; map: Map<number, LeagueMeta> } | null = null;
const LEAGUE_TTL = 6 * 60 * 60 * 1000; // 6 saat

export async function getLeagueMap(): Promise<Map<number, LeagueMeta>> {
  if (_leagueCache && Date.now() - _leagueCache.at < LEAGUE_TTL) return _leagueCache.map;
  const [popular, all] = await Promise.all([
    ffFetch('/football-popular-leagues'),
    ffFetch('/football-get-all-leagues'),
  ]);
  const map = new Map<number, LeagueMeta>();
  const add = (l: any) => {
    if (!l?.id || map.has(l.id)) return;
    map.set(l.id, {
      id: l.id,
      name: l.localizedName || l.name || `League ${l.id}`,
      ccode: l.ccode || '',
      logo: l.logo || FOTMOB_LEAGUE_LOGO(l.id),
    });
  };
  for (const l of popular?.popular || []) add(l);
  for (const l of all?.leagues || []) add(l);
  if (map.size) _leagueCache = { at: Date.now(), map };
  return map;
}

// Opsiyonel kısıtlama: FOOTBALL_LEAGUE_IDS set ise yalnızca o ligler; değilse TÜM ligler.
function getAllowedIds(): Set<number> | null {
  const raw = process.env.FOOTBALL_LEAGUE_IDS;
  if (!raw) return null; // null = filtre yok (tüm ligler)
  const ids = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
  return ids.length ? new Set(ids) : null;
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

// Lig haritasında bulunmayan turnuva id'leri için elle düzeltme
// (popular/all-leagues listeleri büyük turnuvaların sezonluk id'lerini
// içermiyor → "League 894789" gibi çirkin adlar çıkıyordu).
// Adlar tek kaynaktan: src/lib/league-names.ts (client kartlarıyla ortak).
import { LEAGUE_NAME_FIX } from '@/lib/league-names';
import { getCatalogMap, feedLeagueCatalog } from '@/lib/league-catalog';
const LEAGUE_CCODE_FIX: Record<number, string> = {
  77: 'INT',
  894789: 'INT',
};

// Canlı harita + kalıcı katalog birleşimi. Feed maçlarda SEZONLUK lig id'si
// taşıyor; popular/all-leagues haritası neredeyse hiç eşleşmiyor (2026-08-08
// ölçümü: 561 maçta 4 çözüm). Katalog (Supabase league_catalog), league-detail
// cron'unun çözdüğü id'leri kalıcı tutar; harita taze çekildiğinde katalog da
// beslenir (fire-and-forget).
async function getMergedLeagueMap(): Promise<Map<number, LeagueMeta>> {
  const [live, catalog] = await Promise.all([getLeagueMap(), getCatalogMap()]);
  const merged = new Map(live);
  for (const [id, e] of catalog) {
    if (!merged.has(id)) {
      merged.set(id, { id, name: e.name, ccode: e.ccode, logo: e.logo || FOTMOB_LEAGUE_LOGO(id) });
    }
  }
  if (live.size) {
    feedLeagueCatalog(Array.from(live.values()));
  }
  return merged;
}

/**
 * Bir maçın detayından LİG bilgisi (ad + ülke kodu) çıkarır. Sezonluk lig
 * id'leri league-detail endpoint'inde çözülemiyor (status=failed, 2026-08-08
 * ölçümü: 60/60 başarısız) — ama match-detail yanıtının general bloğu
 * leagueName + countryCode taşır. league-catalog cron'u çözümsüz ligler için
 * o ligden örnek bir maçla bunu çağırır.
 */
export async function getMatchLeagueInfo(
  eventId: number
): Promise<{ name: string; ccode: string; parentLeagueId: number | null } | null> {
  const r = await ffFetch(`/football-get-match-detail?eventid=${eventId}`);
  // Doğrulanmış şema (2026-08-08): { detail: { leagueId, leagueName,
  // parentLeagueId, countryCode, ... } } — alanlar detail'in doğrudan üstünde.
  const gen = r?.detail || r?.general || r;
  const name = gen?.leagueName || gen?.parentLeagueName || '';
  const ccode = gen?.countryCode || gen?.ccode || '';
  if (!name || /^League \d+$/.test(String(name).trim())) {
    // Şema teşhisi: parse ıskalarsa ham yanıtın başını logla (bir kez yeter)
    if (r) console.warn(`[free-football] match-detail parse miss ev=${eventId} shape=${JSON.stringify(r).slice(0, 500)}`);
    return null;
  }
  return {
    name: String(name).trim(),
    ccode: String(ccode || '').trim(),
    parentLeagueId: Number.isFinite(Number(gen?.parentLeagueId)) ? Number(gen.parentLeagueId) : null,
  };
}

/**
 * Tek ligin detayı (id → ad + ülke kodu) — KANONİK id'lerde çalışır; sezonluk
 * id'lerde API failed döner (o durumda getMatchLeagueInfo kullanılır).
 * Çözülemezse null (asla "League X" yazılmaz).
 */
export async function getLeagueDetail(
  leagueId: number
): Promise<{ id: number; name: string; ccode: string; logo: string; raw?: any } | null> {
  const r = await ffFetch(`/football-get-league-detail?leagueid=${leagueId}`);
  const det = r?.details || r?.league || r;
  const name = det?.name || det?.leagueName || det?.localizedName || '';
  const ccode = det?.country || det?.ccode || det?.countryCode || '';
  if (!name || /^League \d+$/.test(String(name).trim())) return null;
  return {
    id: leagueId,
    name: String(name).trim(),
    ccode: String(ccode || '').trim(),
    logo: FOTMOB_LEAGUE_LOGO(leagueId),
    raw: det,
  };
}

function normalize(m: any, leagues: Map<number, LeagueMeta>): FFMatch {
  const lid = m.leagueId;
  const lm = leagues.get(lid);
  const st = m.status || {};
  return {
    id: m.id,
    leagueId: lid,
    leagueName: LEAGUE_NAME_FIX[lid] || lm?.name || `League ${lid}`,
    leagueLogo: lm?.logo || FOTMOB_LEAGUE_LOGO(lid),
    leagueCountry: LEAGUE_CCODE_FIX[lid] || lm?.ccode || '',
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
    getMergedLeagueMap(),
  ]);
  const matches = resp?.matches || [];
  const allowed = getAllowedIds();
  return matches
    .filter((m: any) => (allowed ? allowed.has(m.leagueId) : true))
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
    getMergedLeagueMap(),
  ]);
  const live = resp?.live || [];
  const allowed = getAllowedIds();
  return live
    .filter((m: any) => (allowed ? allowed.has(m.leagueId) : true))
    .map((m: any) => normalize(m, leagues));
}
