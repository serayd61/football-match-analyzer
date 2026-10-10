import { matchSlug, parseFixtureId } from '@/lib/seo';
import type { SitePrediction, MatchStatus } from './predictions';
import type { SiteLeague } from './leagues';

// ============================================================================
// Herkese açık maç sayfaları (SEO, 2026-10-10)
// ----------------------------------------------------------------------------
// /[locale]/matches/{ev}-vs-{deplasman}-{fixtureId} rotası üyelik istemez.
// Bu dosya SAF yardımcılar içerir (server-only değil) ki testler de çalışsın:
//   - URL üretimi ve kanonik slug denetimi,
//   - SitePrediction → PublicMatch indirgemesi: model olasılıkları, seçim,
//     güven, lambda, gol pazarları, gerekçe ve seçim sonucu (won/lost) BURADAN
//     GEÇMEZ. Üyelere özel veri public HTML'e sızmasın diye tek kapı burasıdır.
// Veri sorguları match-public-data.ts içinde (server-only).
// ============================================================================

export interface PublicMatch {
  fixtureId: number;
  slug: string;
  league: SiteLeague | null;
  leagueName: string;
  leagueId: number | null;
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeCrest: string | null;
  awayCrest: string | null;
  kickoff: string;
  status: MatchStatus;
  settled: boolean;
  homeScore: number | null;
  awayScore: number | null;
  /** engine row's updated_at — "data last updated" on the page and sitemap lastmod */
  updatedAt: string | null;
}

/** Fields of SitePrediction that must never reach a public page (test-checked). */
export const PREMIUM_FIELDS = [
  'pHome', 'pDraw', 'pAway', 'lambdaHome', 'lambdaAway', 'pick', 'confidence', 'confidenceRaw',
  'doubleChance', 'overUnder', 'btts', 'rationale', 'outcome', 'result', 'modelVersion', 'hasModel', 'modelStatus', 'publishedAfterKickoff',
] as const;

export function publicMatchView(p: SitePrediction): PublicMatch {
  return {
    fixtureId: p.fixtureId,
    slug: matchSlug(p.homeName, p.awayName, p.fixtureId),
    league: p.league,
    leagueName: p.leagueName,
    leagueId: p.leagueId,
    homeId: p.homeId,
    homeName: p.homeName,
    awayId: p.awayId,
    awayName: p.awayName,
    homeCrest: p.homeCrest,
    awayCrest: p.awayCrest,
    kickoff: p.kickoff,
    status: p.status,
    settled: p.settled,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    updatedAt: p.updatedAt,
  };
}

/** Locale-free path of a public match page, e.g. "/matches/arsenal-vs-chelsea-4193188". */
export function matchPath(m: { homeName: string; awayName: string; fixtureId: number }): string {
  return `/matches/${matchSlug(m.homeName, m.awayName, m.fixtureId)}`;
}

/** Fixture id carried by a /matches slug (trailing number), or null. */
export function fixtureIdFromSlug(slug: string): number | null {
  const id = parseFixtureId(slug);
  return id != null && Number.isInteger(id) && id > 0 ? id : null;
}

/** True when the requested slug is exactly the canonical one (else the page redirects). */
export function isCanonicalSlug(slug: string, m: { homeName: string; awayName: string; fixtureId: number }): boolean {
  return slug === matchSlug(m.homeName, m.awayName, m.fixtureId);
}

/** Last five results from one team's point of view, newest first (W/D/L). */
export function formLetters(teamId: number, rows: Array<{ homeId: number | null; awayId: number | null; homeScore: number | null; awayScore: number | null }>): Array<'W' | 'D' | 'L'> {
  const out: Array<'W' | 'D' | 'L'> = [];
  for (const r of rows) {
    if (r.homeScore == null || r.awayScore == null) continue;
    if (r.homeId !== teamId && r.awayId !== teamId) continue; // not this team's match
    const home = r.homeId === teamId;
    const gf = home ? r.homeScore : r.awayScore;
    const ga = home ? r.awayScore : r.homeScore;
    out.push(gf > ga ? 'W' : gf === ga ? 'D' : 'L');
  }
  return out;
}

/** Head-to-head tally from settled meetings. */
export function h2hTally(homeId: number, rows: Array<{ homeId: number | null; awayId: number | null; homeScore: number | null; awayScore: number | null }>): { n: number; homeWins: number; draws: number; awayWins: number } {
  const t = { n: 0, homeWins: 0, draws: 0, awayWins: 0 };
  for (const r of rows) {
    if (r.homeScore == null || r.awayScore == null) continue;
    t.n++;
    const teamIsHome = r.homeId === homeId;
    const gf = teamIsHome ? r.homeScore : r.awayScore;
    const ga = teamIsHome ? r.awayScore : r.homeScore;
    if (gf > ga) t.homeWins++; else if (gf === ga) t.draws++; else t.awayWins++;
  }
  return t;
}
