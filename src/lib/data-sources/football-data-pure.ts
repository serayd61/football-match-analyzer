// ============================================================================
// football-data.org yedek skor kaynağı — SAF kısım (test edilebilir)
// ----------------------------------------------------------------------------
// Neden (2026-10-18): abone akış (Free API Live Football Data) ~11:20 UTC'den
// itibaren tüm uçlarda 502 verdi; site bütün gün "bugün maç yok" gösterdi,
// sonuçlanma (settle-engine) durdu, API-Football günlük kotası da doluydu.
// football-data.org ücretsiz katmanı 12 büyük turnuvayı canlı skorla verir
// (10 istek/dk) — kesintide yalnız bu ligler için skor/durum tamamlanır.
// Kimlikler farklı → lig kodu + UTC gün + takım adı/saat eşlemesi
// (api-football-pure.matchFixtures ile aynı kural).
// ============================================================================
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { teamSim, type MapCandidate } from './api-football-pure';

/** Ücretsiz katmanda skor verilen turnuva kodları (football-data.org, 2026-10). */
export const FD_FREE_CODES = new Set(['PL', 'ELC', 'PD', 'SA', 'BL1', 'FL1', 'DED', 'PPL', 'CL', 'BSA', 'EC', 'WC']);

export interface FdMatch {
  id: number;
  code: string;          // competition.code (PL, PD, …)
  utcDate: string;
  status: string;        // SCHEDULED|TIMED|IN_PLAY|PAUSED|FINISHED|SUSPENDED|POSTPONED|CANCELLED|AWARDED
  home: string;
  away: string;
  /** kısa adlar (Lyon, Nice) — bizim adlarımıza daha yakın; eşlemede önce denenir */
  homeShort: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface FdOverlay {
  fdId: number;
  finished: boolean;
  started: boolean;
  cancelled: boolean;
  homeScore: number | null;
  awayScore: number | null;
  score: number;         // eşleşme güveni (0..1)
}

/** /v4/matches ham yanıtı → sade satırlar. */
export function parseFdMatches(json: any): FdMatch[] {
  const list: any[] = Array.isArray(json?.matches) ? json.matches : [];
  const n = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return list.map((m) => ({
    id: Number(m?.id),
    code: String(m?.competition?.code || ''),
    utcDate: String(m?.utcDate || ''),
    status: String(m?.status || ''),
    home: String(m?.homeTeam?.name || m?.homeTeam?.shortName || ''),
    away: String(m?.awayTeam?.name || m?.awayTeam?.shortName || ''),
    homeShort: String(m?.homeTeam?.shortName || m?.homeTeam?.name || ''),
    awayShort: String(m?.awayTeam?.shortName || m?.awayTeam?.name || ''),
    homeScore: n(m?.score?.fullTime?.home),
    awayScore: n(m?.score?.fullTime?.away),
  })).filter((m) => m.id && m.code && m.home && m.away);
}

/** FotMob lig id → football-data kodu (yalnız ücretsiz katmanda skor verilenler). */
export function fdCodeForLeagueId(leagueId: number | null | undefined): string | null {
  if (leagueId == null) return null;
  const lg = SITE_LEAGUES.find((l) => l.ids.includes(Number(leagueId)));
  return lg && FD_FREE_CODES.has(lg.fdCode) ? lg.fdCode : null;
}

export function fdStatusFlags(status: string): { finished: boolean; started: boolean; cancelled: boolean } {
  const finished = status === 'FINISHED' || status === 'AWARDED';
  const live = status === 'IN_PLAY' || status === 'PAUSED';
  const cancelled = status === 'POSTPONED' || status === 'CANCELLED' || status === 'SUSPENDED';
  return { finished, started: finished || live, cancelled };
}

export interface OverlayRow { id: number; kickoff: string; home: string; away: string; leagueId: number | null }

/**
 * Bizim satırlarımızı (fixture id + lig + saat + adlar) football-data maçlarıyla
 * eşler. Lig kodu başına ayrı havuz: aynı adlı takımlar (ör. kadın/gençlik) ve
 * yanlış lig eşleşmesi önlenir. Eşleşmeyen satır haritada yer almaz.
 */
export function overlayFd(rows: OverlayRow[], fd: FdMatch[]): Map<number, FdOverlay> {
  const out = new Map<number, FdOverlay>();
  const byCode = new Map<string, FdMatch[]>();
  for (const m of fd) byCode.set(m.code, [...(byCode.get(m.code) ?? []), m]);
  const ours = new Map<string, MapCandidate[]>();
  for (const r of rows) {
    const code = fdCodeForLeagueId(r.leagueId);
    if (!code || !byCode.has(code)) continue;
    ours.set(code, [...(ours.get(code) ?? []), { fixtureId: r.id, kickoff: r.kickoff, home: r.home, away: r.away }]);
  }
  for (const [code, cands] of ours) {
    const theirs = byCode.get(code)!;
    const used = new Set<number>();
    // Takım adı benzerliği: kısa ad (Celta) ve tam ad (RC Celta de Vigo) içinden en iyisi;
    // ±3 saatten uzak kickoff cezalı. Eşik 0,5 ve ikinci adaya ≥0,15 fark (api-football ile aynı).
    for (const o of cands) {
      const scored = theirs.filter((t) => !used.has(t.id)).map((t) => {
        const dt = Math.abs(Date.parse(t.utcDate) - Date.parse(o.kickoff)) / 3600_000;
        const h = Math.max(teamSim(o.home, t.home), teamSim(o.home, t.homeShort));
        const a = Math.max(teamSim(o.away, t.away), teamSim(o.away, t.awayShort));
        return { t, s: (h + a) / 2 - (dt > 3 ? 0.3 : 0) };
      }).sort((x, y) => y.s - x.s);
      const best = scored[0], second = scored[1];
      if (!best || best.s < 0.5 || (second && best.s - second.s < 0.15)) continue;
      used.add(best.t.id);
      const m = best.t;
      out.set(o.fixtureId, { fdId: m.id, ...fdStatusFlags(m.status), homeScore: m.homeScore, awayScore: m.awayScore, score: Math.round(best.s * 100) / 100 });
    }
  }
  return out;
}
