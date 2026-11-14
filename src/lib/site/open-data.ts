import type { SitePrediction } from './predictions';
import type { PublicMatch } from './match-public';
import { SITE_LEAGUES } from './leagues';
import { matchSlug } from '@/lib/seo';
import { SITE_URL } from '@/lib/seo';

// ============================================================================
// Open data (SEO Faz 2.1, 2026-10-17)
// ----------------------------------------------------------------------------
// The settled prediction record as flat CSV/JSON files: for every finished
// match in a covered league, the model's pre-match 1X2 probabilities, goal
// expectations, the pick and the final score. Understat and StatsBomb open-data
// attract academic and blog links precisely because the numbers can be taken
// away and checked; this is the same play for a *prediction* model.
//
// Honesty rules (identical to the public pages):
//   • settled matches with a final score ONLY — an upcoming prediction never
//     leaves the members' area (match-public.ts gate), so toOpenDataRow()
//     returns null for anything unsettled;
//   • no row is filtered by outcome: losers are in the file;
//   • the figures are the stored pre-match values of the official model
//     version — never revised after kick-off.
//
// Pure helpers only (no server-only import) so the formatting is unit-tested;
// the database read lives in open-data-data.ts.
// ============================================================================

export const OPEN_DATA_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export const OPEN_DATA_LICENSE_NAME = 'CC BY 4.0';
/** Concept DOI on Zenodo: always resolves to the latest archived release. */
export const OPEN_DATA_DOI = '10.5281/zenodo.24216824';
export const OPEN_DATA_DOI_URL = `https://doi.org/${OPEN_DATA_DOI}`;
/** Daily mirror; its commit history shows each day's additions. */
export const OPEN_DATA_GITHUB = 'https://github.com/serayd61/football-predictions-open-data';
/** Earliest engine row — the dataset epoch. */
export const OPEN_DATA_SINCE = '2026-06-01';

export type OpenDataExt = 'csv' | 'json';
export const OPEN_DATA_EXTS: readonly OpenDataExt[] = ['csv', 'json'];
export const OPEN_DATA_ALL = 'all';

/** File names that exist: "all" plus one per covered league (by slug). */
export function openDataNames(): string[] {
  return [OPEN_DATA_ALL, ...SITE_LEAGUES.map((l) => l.slug)];
}

/** "premier-league.csv" → { name, ext }; null for anything else (→ 404). */
export function parseOpenDataFile(file: string): { name: string; ext: OpenDataExt } | null {
  const m = /^([a-z0-9-]+)\.(csv|json)$/.exec(file);
  if (!m) return null;
  const name = m[1];
  if (!openDataNames().includes(name)) return null;
  return { name, ext: m[2] as OpenDataExt };
}

/** Locale-free path of one file, e.g. "/data/all.csv". */
export function openDataPath(name: string, ext: OpenDataExt): string {
  return `/data/${name}.${ext}`;
}

export interface OpenDataRow {
  fixture_id: number;
  kickoff_utc: string;
  league: string;
  league_slug: string;
  country: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  /** final result from the score: 1 / X / 2 */
  result: '1' | 'X' | '2';
  p_home: number;
  p_draw: number;
  p_away: number;
  lambda_home: number | null;
  lambda_away: number | null;
  /** pre-match pick (argmax of 1X2) or empty when the model made none */
  pick: '1' | 'X' | '2' | '';
  /** 1 when the pick came in, 0 when not, empty without a pick */
  pick_correct: 1 | 0 | '';
  model_version: string;
  match_url: string;
}

export const OPEN_DATA_COLUMNS: ReadonlyArray<keyof OpenDataRow> = [
  'fixture_id', 'kickoff_utc', 'league', 'league_slug', 'country', 'home_team', 'away_team', 'home_score', 'away_score', 'result',
  'p_home', 'p_draw', 'p_away', 'lambda_home', 'lambda_away', 'pick', 'pick_correct', 'model_version', 'match_url',
];

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/**
 * One settled covered match as an open-data row, or null when it must not be
 * published (unsettled, no final score, no league, no model figures).
 */
export function toOpenDataRow(p: SitePrediction): OpenDataRow | null {
  if (!p.settled || p.homeScore == null || p.awayScore == null) return null;
  if (!p.league || !p.hasModel) return null;
  if (!(p.pHome > 0 || p.pDraw > 0 || p.pAway > 0)) return null;
  const result: '1' | 'X' | '2' = p.homeScore > p.awayScore ? '1' : p.homeScore === p.awayScore ? 'X' : '2';
  const pick = p.pick ?? '';
  return {
    fixture_id: p.fixtureId,
    kickoff_utc: new Date(p.kickoff).toISOString(),
    league: p.league.name,
    league_slug: p.league.slug,
    country: p.league.country,
    home_team: p.homeName,
    away_team: p.awayName,
    home_score: p.homeScore,
    away_score: p.awayScore,
    result,
    p_home: r4(p.pHome),
    p_draw: r4(p.pDraw),
    p_away: r4(p.pAway),
    lambda_home: p.lambdaHome == null ? null : r4(p.lambdaHome),
    lambda_away: p.lambdaAway == null ? null : r4(p.lambdaAway),
    pick,
    pick_correct: pick ? (pick === result ? 1 : 0) : '',
    model_version: p.modelVersion ?? '',
    match_url: `${SITE_URL}/en/matches/${matchSlug(p.homeName, p.awayName, p.fixtureId)}`,
  };
}

/** RFC 4180: quote when the value holds a comma, quote, CR or LF; double inner quotes. */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Whole file: header row + one line per match, CRLF, UTF-8 (no BOM — pandas/R default). */
export function toCsv(rows: OpenDataRow[]): string {
  const lines = [OPEN_DATA_COLUMNS.join(',')];
  for (const r of rows) lines.push(OPEN_DATA_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export interface OpenDataMeta {
  /** file name without extension ("all" or a league slug) */
  name: string;
  generated_at: string;
  rows: number;
  first_kickoff_utc: string | null;
  last_kickoff_utc: string | null;
}

export function openDataMeta(name: string, rows: OpenDataRow[], now = new Date()): OpenDataMeta {
  return {
    name,
    generated_at: now.toISOString(),
    rows: rows.length,
    first_kickoff_utc: rows.length ? rows[0].kickoff_utc : null,
    last_kickoff_utc: rows.length ? rows[rows.length - 1].kickoff_utc : null,
  };
}

/** JSON envelope: provenance first, then the rows in kick-off order. */
export function toJson(rows: OpenDataRow[], meta: OpenDataMeta): string {
  return JSON.stringify({
    dataset: 'footballanalytics.pro open data — settled model predictions',
    license: OPEN_DATA_LICENSE,
    attribution: `Football Analytics (${SITE_URL})`,
    documentation: `${SITE_URL}/en/data`,
    columns: OPEN_DATA_COLUMNS,
    ...meta,
    data: rows,
  });
}

/** Row count per league slug (download table on /data). */
export function countByLeague(rows: OpenDataRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.league_slug] = (out[r.league_slug] ?? 0) + 1;
  return out;
}

// ============================================================================
// Picks before kick-off (2026-11-14)
// ----------------------------------------------------------------------------
// /data/upcoming.{csv|json}: the model's 1X2 pick for every covered match that
// has not kicked off yet, with the time the pick was written. The settled files
// above prove what happened; this feed (and the append-only ledger the GitHub
// mirror builds from it, whose commit times are not ours to set) proves the pick
// was public BEFORE the match.
//
// The row is built from PublicMatch, i.e. after the match-public.ts gate: it can
// only carry what the public match page already shows — the direction (`lean`),
// never probabilities, confidence, goal markets or the model version.
// ============================================================================

export const OPEN_DATA_UPCOMING = 'upcoming';
/** Append-only ledger of this feed in the GitHub mirror. */
export const OPEN_DATA_LEDGER = `${OPEN_DATA_GITHUB}/blob/main/data/picks/ledger.csv`;
export const OPEN_DATA_LEDGER_HISTORY = `${OPEN_DATA_GITHUB}/commits/main/data/picks/ledger.csv`;

/** "upcoming.csv" → 'csv'; null for anything else. */
export function parseUpcomingFile(file: string): OpenDataExt | null {
  const m = /^upcoming\.(csv|json)$/.exec(file);
  return m ? (m[1] as OpenDataExt) : null;
}

export interface UpcomingPickRow {
  fixture_id: number;
  kickoff_utc: string;
  league: string;
  league_slug: string;
  country: string;
  home_team: string;
  away_team: string;
  /** the model's pre-match 1X2 pick: 1 home, X draw, 2 away */
  pick: '1' | 'X' | '2';
  /** when the engine last wrote this pick (always before kick-off) */
  pick_written_utc: string;
  match_url: string;
}

export const UPCOMING_COLUMNS: ReadonlyArray<keyof UpcomingPickRow> = [
  'fixture_id', 'kickoff_utc', 'league', 'league_slug', 'country', 'home_team', 'away_team', 'pick', 'pick_written_utc', 'match_url',
];

/**
 * One not-yet-started covered match as a public pick row, or null when there is
 * nothing to publish: no public lean, no league, already kicked off, or no
 * write time strictly before kick-off (a pick we cannot time is not evidence).
 */
export function toUpcomingPickRow(m: PublicMatch, now = new Date()): UpcomingPickRow | null {
  if (!m.lean || !m.league || m.settled) return null;
  const ko = Date.parse(m.kickoff);
  const written = m.updatedAt ? Date.parse(m.updatedAt) : NaN;
  if (!Number.isFinite(ko) || !Number.isFinite(written)) return null;
  if (ko <= now.getTime() || written >= ko) return null;
  return {
    fixture_id: m.fixtureId,
    kickoff_utc: new Date(ko).toISOString(),
    league: m.league.name,
    league_slug: m.league.slug,
    country: m.league.country,
    home_team: m.homeName,
    away_team: m.awayName,
    pick: m.lean,
    pick_written_utc: new Date(written).toISOString(),
    match_url: `${SITE_URL}/en/matches/${m.slug}`,
  };
}

/** Rows for the feed, kick-off order (then fixture id, so the file is stable between reads). */
export function upcomingPickRows(matches: PublicMatch[], now = new Date()): UpcomingPickRow[] {
  const out: UpcomingPickRow[] = [];
  const seen = new Set<number>();
  for (const m of matches) {
    const r = toUpcomingPickRow(m, now);
    if (!r || seen.has(r.fixture_id)) continue;
    seen.add(r.fixture_id);
    out.push(r);
  }
  return out.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc) || a.fixture_id - b.fixture_id);
}

export function upcomingToCsv(rows: UpcomingPickRow[]): string {
  const lines = [UPCOMING_COLUMNS.join(',')];
  for (const r of rows) lines.push(UPCOMING_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function upcomingToJson(rows: UpcomingPickRow[], now = new Date()): string {
  return JSON.stringify({
    dataset: 'footballanalytics.pro open data — model picks before kick-off',
    license: OPEN_DATA_LICENSE,
    attribution: `Football Analytics (${SITE_URL})`,
    documentation: `${SITE_URL}/en/data`,
    ledger: OPEN_DATA_LEDGER,
    columns: UPCOMING_COLUMNS,
    name: OPEN_DATA_UPCOMING,
    generated_at: now.toISOString(),
    rows: rows.length,
    data: rows,
  });
}
