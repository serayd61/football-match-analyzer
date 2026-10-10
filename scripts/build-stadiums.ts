/**
 * Stadium registry generator — SEO denetimi 2026-10-10 (SportsEvent JSON-LD).
 *
 *   node --import tsx scripts/build-stadiums.ts
 *
 * Google's Event rich result requires `location` (venue name + postal address),
 * which the engine feed does not carry. This script joins the teams that
 * actually appear in `engine_predictions` (FotMob ids / names) with the venue
 * and address football-data.org publishes per competition, and writes
 * `src/lib/site/stadiums.json` keyed by FotMob team id. Re-run at the start of
 * each season (promotions change the team set); unmatched teams are printed —
 * add an alias below or a hand entry in `lib/site/stadiums.ts`.
 *
 * Needs FOOTBALL_DATA_API_KEY, NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local. football-data's free tier allows
 * 10 requests/minute, so the 10 competition calls are spaced 6.5 s apart.
 * Süper Lig (TSL) is not on the free tier — those teams live in the hand table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SITE_LEAGUES, resolveLeague } from '../src/lib/site/leagues';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'src/lib/site/stadiums.json');
const SEASON_START = '2026-07-01';

const env: Record<string, string> = {};
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const need = (k: string) => { if (!env[k]) throw new Error(`${k} missing in .env.local`); return env[k]; };

/** FotMob name → football-data name, where normalisation alone is not enough. */
const ALIASES: Record<string, string> = {
  'Wolverhampton Wanderers': 'Wolverhampton Wanderers FC',
  'Brighton & Hove Albion': 'Brighton & Hove Albion FC',
  'Sheffield Wednesday': 'Sheffield Wednesday FC',
  'West Bromwich Albion': 'West Bromwich Albion FC',
  'Queens Park Rangers': 'Queens Park Rangers FC',
  'Internazionale': 'FC Internazionale Milano',
  'Inter': 'FC Internazionale Milano',
  'AC Milan': 'AC Milan',
  'Milan': 'AC Milan',
  'Roma': 'AS Roma',
  'Lazio': 'SS Lazio',
  'Napoli': 'SSC Napoli',
  'Hellas Verona': 'Hellas Verona FC',
  'Atletico Madrid': 'Club Atlético de Madrid',
  'Atlético Madrid': 'Club Atlético de Madrid',
  'Athletic Club': 'Athletic Club',
  'Real Sociedad': 'Real Sociedad de Fútbol',
  'Celta Vigo': 'RC Celta de Vigo',
  'Rayo Vallecano': 'Rayo Vallecano de Madrid',
  'Real Betis': 'Real Betis Balompié',
  'Deportivo Alaves': 'Deportivo Alavés',
  'Deportivo Alavés': 'Deportivo Alavés',
  'Bayern München': 'FC Bayern München',
  'Borussia Dortmund': 'Borussia Dortmund',
  'Borussia Mönchengladbach': "Borussia Mönchengladbach",
  'Bayer Leverkusen': 'Bayer 04 Leverkusen',
  'Mainz': '1. FSV Mainz 05',
  '1. FC Köln': '1. FC Köln',
  'Köln': '1. FC Köln',
  'Union Berlin': '1. FC Union Berlin',
  'Heidenheim': '1. FC Heidenheim 1846',
  'St. Pauli': 'FC St. Pauli 1910',
  'Hamburger SV': 'Hamburger SV',
  'Paris Saint-Germain': 'Paris Saint-Germain FC',
  'Marseille': 'Olympique de Marseille',
  'Lyon': 'Olympique Lyonnais',
  'Monaco': 'AS Monaco FC',
  'Lille': 'Lille OSC',
  'Nice': 'OGC Nice',
  'Lens': 'Racing Club de Lens',
  'Rennes': 'Stade Rennais FC 1901',
  'Brest': 'Stade Brestois 29',
  'Strasbourg': 'RC Strasbourg Alsace',
  'Le Havre': 'Le Havre AC',
  'Nantes': 'FC Nantes',
  'Toulouse': 'Toulouse FC',
  'Auxerre': 'AJ Auxerre',
  'Angers': 'Angers SCO',
  'Lorient': 'FC Lorient',
  'Metz': 'FC Metz',
  'Paris FC': 'Paris FC',
  'PSV': 'PSV',
  'Ajax': 'AFC Ajax',
  'Feyenoord': 'Feyenoord Rotterdam',
  'AZ': 'AZ',
  'Twente': 'FC Twente \'65',
  'Utrecht': 'FC Utrecht',
  'Go Ahead Eagles': 'Go Ahead Eagles',
  'NEC': 'NEC',
  'Sparta Rotterdam': 'Sparta Rotterdam',
  'Fortuna Sittard': 'Fortuna Sittard',
  'Heerenveen': 'SC Heerenveen',
  'Groningen': 'FC Groningen',
  'Benfica': 'Sport Lisboa e Benfica',
  'Porto': 'FC Porto',
  'Sporting CP': 'Sporting Clube de Portugal',
  'Braga': 'Sporting Clube de Braga',
  'Vitória de Guimarães': 'Vitória SC',
  'Vitoria de Guimaraes': 'Vitória SC',
  'Atletico Mineiro': 'CA Mineiro',
  'Atlético Mineiro': 'CA Mineiro',
  'Athletico Paranaense': 'CA Paranaense',
  'Atlético-MG': 'CA Mineiro',
  'Bragantino': 'RB Bragantino',
  'Red Bull Bragantino': 'RB Bragantino',
  'Vasco da Gama': 'CR Vasco da Gama',
  'Botafogo': 'Botafogo FR',
  'Flamengo': 'CR Flamengo',
  'Fluminense': 'Fluminense FC',
  'Palmeiras': 'SE Palmeiras',
  'Corinthians': 'SC Corinthians Paulista',
  'São Paulo': 'São Paulo FC',
  'Santos': 'Santos FC',
  'Grêmio': 'Grêmio FBPA',
  'Internacional': 'SC Internacional',
  'Cruzeiro': 'Cruzeiro EC',
  'Bahia': 'EC Bahia',
  'Fortaleza': 'Fortaleza EC',
  'Vitória': 'EC Vitória',
  'Ceará': 'Ceará SC',
  'Sport Recife': 'SC Recife',
  'Sport': 'SC Recife',
  'Juventude': 'EC Juventude',
  'Mirassol': 'Mirassol FC',
  'Remo': 'Clube do Remo',
  'AZ Alkmaar': 'AZ',
  'NEC Nijmegen': 'NEC',
  'PSV Eindhoven': 'PSV',
  'Deportivo A Coruña': 'RC Deportivo La Coruña',
  'Racing Santander': 'Real Racing Club de Santander',
  'Estoril': 'GD Estoril Praia',
  'Como': 'Como 1907',
};

// football-data area codes (a mix of ISO 3166-1 alpha-3 and FIFA codes) → ISO alpha-2 for schema.org addressCountry.
const ISO2: Record<string, string> = {
  ENG: 'GB', SCO: 'GB', WAL: 'GB', NIR: 'GB', GBR: 'GB', ESP: 'ES', ITA: 'IT', GER: 'DE', DEU: 'DE', FRA: 'FR', NED: 'NL', NLD: 'NL',
  POR: 'PT', PRT: 'PT', BRA: 'BR', BEL: 'BE', AUT: 'AT', SUI: 'CH', CHE: 'CH', CZE: 'CZ', DEN: 'DK', DNK: 'DK', NOR: 'NO', SWE: 'SE',
  TUR: 'TR', GRE: 'GR', GRC: 'GR', UKR: 'UA', CRO: 'HR', HRV: 'HR', SRB: 'RS', CYP: 'CY', KAZ: 'KZ', AZE: 'AZ', SVK: 'SK', SVN: 'SI',
  POL: 'PL', HUN: 'HU', ROU: 'RO', BUL: 'BG', BGR: 'BG', IRL: 'IE', ISR: 'IL', MCO: 'MC', MON: 'MC', SCT: 'GB',
};

/** football-data addresses carry literal "null" tokens and the odd HTML tag. */
function cleanAddress(s: string | null | undefined): string {
  return (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\bnull\b/g, ' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '');
}

const NOISE = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ss', 'ssc', 'us', 'sv', 'vfb', 'vfl', 'tsg', 'fsv', 'bsc', 'sa', 'cd', 'ud', 'rcd', 'rc', 'ca', 'sl', 'cp', 'ec', 'se', 'cr', 'sd', 'ogc', 'fk', 'club', 'de', 'del', 'the', '1', '04', '05', '09', '1846', '1899', '1910', '1901', '29', '65', 'fbpa', 'fr', 'sco', 'osc', 'uc', 'ud']);
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[&]/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').filter((t) => t && !NOISE.has(t)).join(' ');
}

interface FdTeam { id: number; name: string; shortName: string; tla: string; venue: string | null; address: string | null; area: { name: string; code: string } }

async function fdTeams(): Promise<FdTeam[]> {
  const key = need('FOOTBALL_DATA_API_KEY');
  const codes = [...new Set(SITE_LEAGUES.map((l) => l.fdCode))].filter((c) => c !== 'TSL');
  const out: FdTeam[] = [];
  for (let i = 0; i < codes.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 6500));
    const res = await fetch(`https://api.football-data.org/v4/competitions/${codes[i]}/teams`, { headers: { 'X-Auth-Token': key } });
    if (!res.ok) { console.error(`football-data ${codes[i]}: HTTP ${res.status}`); continue; }
    const j = (await res.json()) as { teams: FdTeam[] };
    console.error(`${codes[i]}: ${j.teams.length} teams`);
    out.push(...j.teams);
  }
  return out;
}

interface FmTeam { id: number; name: string; league: string }

async function fotmobTeams(): Promise<FmTeam[]> {
  const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: cat } = await db.from('league_catalog').select('league_id, name, ccode').limit(5000);
  const catalog = new Map((cat ?? []).map((r: any) => [Number(r.league_id), r as { name: string; ccode: string }]));
  const teams = new Map<number, FmTeam>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('engine_predictions').select('league_id, league_name, home_id, home_name, away_id, away_name').gte('kickoff', SEASON_START).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data as any[]) {
      const league = resolveLeague(r.league_name, r.league_id, catalog.get(Number(r.league_id))?.ccode);
      if (!league || !r.home_id || !r.away_id) continue;
      teams.set(Number(r.home_id), { id: Number(r.home_id), name: r.home_name, league: league.slug });
      teams.set(Number(r.away_id), { id: Number(r.away_id), name: r.away_name, league: league.slug });
    }
    if (!data || data.length < 1000) break;
  }
  return [...teams.values()];
}

async function main() {
  const [fm, fd] = await Promise.all([fotmobTeams(), fdTeams()]);
  const byName = new Map<string, FdTeam>();
  const byNorm = new Map<string, FdTeam>();
  for (const t of fd) {
    byName.set(t.name, t);
    byNorm.set(norm(t.name), t);
    byNorm.set(norm(t.shortName), t);
  }
  const teams: Record<string, { team: string; venue: string; address: string; country: string; fd: number }> = {};
  const unmatched: FmTeam[] = [];
  for (const t of fm.sort((a, b) => a.league.localeCompare(b.league) || a.name.localeCompare(b.name))) {
    const hit = byName.get(ALIASES[t.name] ?? '') ?? byNorm.get(norm(t.name));
    if (!hit) { unmatched.push(t); continue; }
    if (!hit.venue) { console.error(`no venue on football-data for ${t.name}`); continue; }
    teams[t.id] = { team: t.name, venue: hit.venue, address: cleanAddress(hit.address), country: ISO2[hit.area.code] ?? hit.area.name, fd: hit.id };
  }
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'football-data.org v4 /competitions/{code}/teams', teams }, null, 2) + '\n');
  console.error(`wrote ${Object.keys(teams).length} venues → ${OUT}`);
  if (unmatched.length) console.error('UNMATCHED (add an alias or a hand entry):\n' + unmatched.map((t) => `  ${t.league}  ${t.id}  ${t.name}`).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
