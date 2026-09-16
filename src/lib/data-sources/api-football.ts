// ============================================================================
// API-Football (api-sports, doğrudan) — Üst/Alt 2,5 ve KG oranı + fikstür eşleme
// ----------------------------------------------------------------------------
// Neden: abone olunan FotMob akışı Üst/Alt oranı vermiyor (2026-09-14 tarama);
// Üst seçimleri adil oranla kaydediliyor, ROI ve oran bandı ölçülemiyordu.
// API-Football RapidAPI'de artık yok; doğrudan v3.football.api-sports.io,
// anahtar API_FOOTBALL_KEY (Vercel). Pro plan 7.500 çağrı/gün; bütçe:
// eşleme ≤ 11 lig × 3 gün, oran ≤ 60 maç × 6 faz ≈ 400/gün.
// Kimlikler FotMob'dan farklı → af_fixture_map (lig + UTC gün + takım adı).
// ============================================================================
import 'server-only';

const HOST = 'https://v3.football.api-sports.io';
export { AF_LEAGUE, AF_BOOKMAKERS, afSeasonFor, parseAfOdds, normTeam, teamSim, matchFixtures, parseAfInjuries, parseAfLineups, injuriesDue, lineupsDue, afToMatchOdds } from './api-football-pure';
export type { AfFixture, AfOdds, MapCandidate, AfInjury, AfLineup, AfLineupPlayer, AfSide, AfMatchOdds } from './api-football-pure';
import { parseAfOdds, parseAfInjuries, parseAfLineups, type AfFixture, type AfOdds, type AfInjury, type AfLineup } from './api-football-pure';

export function hasApiFootballKey(): boolean { return !!(process.env.API_FOOTBALL_KEY || '').trim(); }

async function afFetch<T = any>(path: string): Promise<{ ok: true; data: T; remaining: string | null } | { ok: false; error: string }> {
  const key = (process.env.API_FOOTBALL_KEY || '').trim();
  if (!key) return { ok: false, error: 'API_FOOTBALL_KEY yok' };
  try {
    const r = await fetch(`${HOST}${path}`, { headers: { 'x-apisports-key': key }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const j: any = await r.json().catch(() => ({}));
    const errs = j?.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors).length) ? JSON.stringify(j.errors) : null;
    if (!r.ok || errs) return { ok: false, error: errs || `http ${r.status}` };
    return { ok: true, data: j?.response as T, remaining: r.headers.get('x-ratelimit-requests-remaining') };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 120) }; }
}

export async function afStatus() {
  const r = await afFetch<any>('/status');
  if (!r.ok) return r;
  const s = r.data || {};
  return { ok: true as const, plan: s.subscription?.plan, active: s.subscription?.active, end: s.subscription?.end, requests: s.requests, remaining: r.remaining };
}

/** Bir lig + UTC gün için fikstürler (tek çağrı). */
export async function afFixtures(leagueId: number, season: number, ymd: string): Promise<{ ok: true; rows: AfFixture[] } | { ok: false; error: string }> {
  const r = await afFetch<any[]>(`/fixtures?league=${leagueId}&season=${season}&date=${ymd}&timezone=UTC`);
  if (!r.ok) return r;
  return { ok: true, rows: (r.data || []).map((f: any) => ({
    id: Number(f.fixture?.id), dateUtc: String(f.fixture?.date || ''), status: String(f.fixture?.status?.short || ''),
    home: String(f.teams?.home?.name || ''), away: String(f.teams?.away?.name || ''), homeId: Number(f.teams?.home?.id), awayId: Number(f.teams?.away?.id),
  })) };
}

/** Bir API-Football fikstürü için maç öncesi oranlar (tek çağrı, tüm bahisçiler). */
export async function afOdds(afFixtureId: number): Promise<{ ok: true; odds: AfOdds | null } | { ok: false; error: string }> {
  const r = await afFetch<any[]>(`/odds?fixture=${afFixtureId}`);
  if (!r.ok) return r;
  return { ok: true, odds: parseAfOdds(r.data || []) };
}


/** Bir fikstürün eksikleri (sakatlık/ceza; iki takım, tek çağrı). Taraf bizim takım adlarımızla eşlenir. */
export async function afInjuries(afFixtureId: number, home: string, away: string): Promise<{ ok: true; rows: AfInjury[] } | { ok: false; error: string }> {
  const r = await afFetch<any[]>(`/injuries?fixture=${afFixtureId}`);
  if (!r.ok) return r;
  return { ok: true, rows: parseAfInjuries(r.data || [], home, away) };
}

/** Açıklanan kadro (~1 saat kala); henüz yoksa lineups: null. */
export async function afLineups(afFixtureId: number, home: string, away: string): Promise<{ ok: true; lineups: AfLineup[] | null } | { ok: false; error: string }> {
  const r = await afFetch<any[]>(`/fixtures/lineups?fixture=${afFixtureId}`);
  if (!r.ok) return r;
  return { ok: true, lineups: parseAfLineups(r.data || [], home, away) };
}
