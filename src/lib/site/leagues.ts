// Leagues the Dixon-Coles model is fitted on (see lib/model-coverage.ts).
// Public URLs use stable slugs; rows are matched by `name|ccode` (feed league
// ids are seasonal, so "Premier League" alone is ambiguous — ENG vs RUS vs UKR).
// League names are proper nouns and are not translated.

export interface SiteLeague {
  slug: string;
  name: string;
  ccode: string;
  /** football-data.org competition code (model params key) */
  fdCode: string;
  /** canonical FotMob ids (fallback when the catalog cannot resolve a name) */
  ids: number[];
  country: string;
}

export const SITE_LEAGUES: SiteLeague[] = [
  { slug: 'premier-league', name: 'Premier League', ccode: 'ENG', fdCode: 'PL', ids: [47], country: 'England' },
  { slug: 'championship', name: 'Championship', ccode: 'ENG', fdCode: 'ELC', ids: [48], country: 'England' },
  { slug: 'la-liga', name: 'LaLiga', ccode: 'ESP', fdCode: 'PD', ids: [87], country: 'Spain' },
  { slug: 'serie-a', name: 'Serie A', ccode: 'ITA', fdCode: 'SA', ids: [55], country: 'Italy' },
  { slug: 'bundesliga', name: 'Bundesliga', ccode: 'GER', fdCode: 'BL1', ids: [54], country: 'Germany' },
  { slug: 'ligue-1', name: 'Ligue 1', ccode: 'FRA', fdCode: 'FL1', ids: [53], country: 'France' },
  { slug: 'eredivisie', name: 'Eredivisie', ccode: 'NED', fdCode: 'DED', ids: [57], country: 'Netherlands' },
  { slug: 'liga-portugal', name: 'Liga Portugal', ccode: 'POR', fdCode: 'PPL', ids: [61], country: 'Portugal' },
  { slug: 'champions-league', name: 'Champions League', ccode: 'INT', fdCode: 'CL', ids: [42], country: 'Europe' },
  { slug: 'brasileirao', name: 'Brasileirão', ccode: 'BRA', fdCode: 'BSA', ids: [268], country: 'Brazil' },
];

const NAME_ALIASES: Record<string, string> = {
  'Brazilian Serie A': 'Brasileirão',
  'Brasileirao': 'Brasileirão',
  'Campeonato Brasileiro Série A': 'Brasileirão',
  'Primera División': 'LaLiga',
  'La Liga': 'LaLiga',
  'UEFA Champions League': 'Champions League',
  'EFL Championship': 'Championship',
  'Primeira Liga': 'Liga Portugal',
};

const BY_SLUG = new Map(SITE_LEAGUES.map((l) => [l.slug, l]));
const BY_ID = new Map<number, SiteLeague>();
const BY_KEY = new Map<string, SiteLeague>();
for (const l of SITE_LEAGUES) {
  for (const id of l.ids) BY_ID.set(id, l);
  BY_KEY.set(`${l.name}|${l.ccode}`, l);
}

export function leagueBySlug(slug: string): SiteLeague | null {
  return BY_SLUG.get(slug) || null;
}

/**
 * Resolve an engine row to a covered league, or null when the match is
 * outside model coverage. `ccode` comes from the league catalog lookup.
 */
export function resolveLeague(leagueName: string | null | undefined, leagueId: number | null | undefined, ccode?: string | null): SiteLeague | null {
  if (leagueId != null && BY_ID.has(Number(leagueId))) return BY_ID.get(Number(leagueId))!;
  const raw = (leagueName || '').trim();
  const name = NAME_ALIASES[raw] || raw;
  const cc = (ccode || '').trim().toUpperCase();
  if (name && cc) {
    const hit = BY_KEY.get(`${name}|${cc}`);
    if (hit) return hit;
  }
  return null;
}
