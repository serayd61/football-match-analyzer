import type { SitePrediction } from './predictions';
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
