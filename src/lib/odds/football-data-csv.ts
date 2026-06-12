// ============================================================================
// FOOTBALL-DATA.CO.UK CSV YÜKLEYİCİ — backtest için sonuç + bahisçi oranı.
//
// football-data.co.uk ücretsiz tarihsel CSV sağlar: maç sonucu VE kapanışa
// yakın bahisçi oranları (Pinnacle/Bet365/ortalama). API key gerekmez.
// Bu, blend'in (DC + piyasa) işe yaradığını GERÇEK oranla ispatlamamızı sağlar.
//
//   URL: https://www.football-data.co.uk/mmz4281/{SEASON}/{DIV}.csv
//   SEASON: '2324' (2023-24), DIV: E0=PL, SP1=LaLiga, I1=SerieA, D1=Bundesliga,
//           F1=Ligue1, ...
//
// Oran tercihi: Pinnacle (en keskin) → Bet365 → piyasa ortalaması.
// ============================================================================

import type { MatchRow } from '@/lib/statistical/dixon-coles';
import type { MatchOdds } from './blend';

export interface OddsMatchRow extends MatchRow {
  odds: MatchOdds;
}

/** Görünür lig adı → football-data.co.uk div kodu (backtest kapsamı). */
export const FDCO_DIVS: Record<string, string> = {
  PL: 'E0',
  ELC: 'E1',
  PD: 'SP1',
  SA: 'I1',
  BL1: 'D1',
  FL1: 'F1',
  DED: 'N1',
  PPL: 'P1',
};

function pickNum(rec: Record<string, string>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== '') {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 1) return n;
    }
  }
  return undefined;
}

/** DD/MM/YYYY veya DD/MM/YY → ISO Date. */
function parseDate(s: string): string {
  const [d, m, y] = s.split('/');
  if (!d || !m || !y) return s;
  const year = y.length === 2 ? (parseInt(y, 10) > 50 ? `19${y}` : `20${y}`) : y;
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Tek satır CSV (tırnak içermeyen football-data formatı) → alanlar. */
function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim());
}

/** Ham CSV metnini OddsMatchRow[]'a parse eder. */
export function parseFootballDataCsv(csv: string): OddsMatchRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);

  const rows: OddsMatchRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length < header.length - 5) continue; // bozuk satır
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => (rec[h] = cells[idx] ?? ''));

    const home = rec['HomeTeam'];
    const away = rec['AwayTeam'];
    const hg = parseInt(rec['FTHG'], 10);
    const ag = parseInt(rec['FTAG'], 10);
    if (!home || !away || !Number.isFinite(hg) || !Number.isFinite(ag)) continue;

    // 1X2 — Pinnacle (PSCH=closing) → Pinnacle open → Bet365 → ortalama
    const mrHome = pickNum(rec, ['PSCH', 'PSH', 'B365H', 'AvgH', 'BbAvH']);
    const mrDraw = pickNum(rec, ['PSCD', 'PSD', 'B365D', 'AvgD', 'BbAvD']);
    const mrAway = pickNum(rec, ['PSCA', 'PSA', 'B365A', 'AvgA', 'BbAvA']);

    // Üst/Alt 2.5
    const over = pickNum(rec, ['P>2.5', 'B365>2.5', 'Avg>2.5', 'BbAv>2.5']);
    const under = pickNum(rec, ['P<2.5', 'B365<2.5', 'Avg<2.5', 'BbAv<2.5']);

    const odds: MatchOdds = {};
    if (mrHome && mrDraw && mrAway) odds.matchResult = { home: mrHome, draw: mrDraw, away: mrAway };
    if (over && under) odds.overUnder = { '2.5': { over, under } };

    rows.push({
      homeTeam: home,
      awayTeam: away,
      homeGoals: hg,
      awayGoals: ag,
      date: parseDate(rec['Date']),
      odds,
    });
  }
  return rows;
}

/** Tek sezon CSV'sini indirip parse eder. season örn. '2324'. */
export async function fetchSeasonCsv(div: string, season: string): Promise<OddsMatchRow[]> {
  const url = `https://www.football-data.co.uk/mmz4281/${season}/${div}.csv`;
  const res = await fetch(url, { cache: 'no-store' as RequestCache });
  if (!res.ok) throw new Error(`football-data.co.uk ${res.status} — ${div}/${season}`);
  const csv = await res.text();
  return parseFootballDataCsv(csv);
}

/** sezon başlangıç yılından football-data.co.uk season kodu: 2023 → '2324'. */
export function seasonCode(startYear: number): string {
  const a = String(startYear).slice(2);
  const b = String((startYear + 1) % 100).padStart(2, '0');
  return `${a}${b}`;
}

/** Birden çok sezonu (kronolojik) yükler. */
export async function loadSeasons(div: string, startYears: number[]): Promise<OddsMatchRow[]> {
  const all: OddsMatchRow[] = [];
  for (const y of startYears) {
    const rows = await fetchSeasonCsv(div, seasonCode(y));
    all.push(...rows);
  }
  // kronolojik sırala
  return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
