// API-Football — saf yardımcılar (ağ yok, 'server-only' yok; testlenebilir).
// Ana istemci: ./api-football.ts
const BET_MATCH_WINNER = 1, BET_OVER_UNDER = 5, BET_BTTS = 8;
export const AF_BOOKMAKERS = { bet365: 8, pinnacle: 4, bwin: 6, unibet: 16 } as const;

/** Site slug → API-Football lig id (v3). */
export const AF_LEAGUE: Record<string, number> = {
  'premier-league': 39, championship: 40, 'la-liga': 140, 'serie-a': 135, bundesliga: 78, 'ligue-1': 61,
  eredivisie: 88, 'liga-portugal': 94, 'champions-league': 2, brasileirao: 71, 'super-lig': 203,
};
/** Takvim yılı sezonu olan ligler (Brezilya); diğerleri Ağustos–Mayıs (başlangıç yılı). */
const CALENDAR_SEASON = new Set(['brasileirao']);

export function afSeasonFor(slug: string, kickoffIso: string): number {
  const d = new Date(kickoffIso);
  if (CALENDAR_SEASON.has(slug)) return d.getUTCFullYear();
  return d.getUTCMonth() + 1 >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export interface AfFixture { id: number; dateUtc: string; home: string; away: string; homeId: number; awayId: number; status: string }

export interface AfOdds {
  bookmaker: string;
  home: number | null; draw: number | null; away: number | null;
  over25: number | null; under25: number | null;
  bttsYes: number | null; bttsNo: number | null;
}

const num = (v: any): number | null => { const n = typeof v === 'string' ? parseFloat(v) : Number(v); return Number.isFinite(n) && n > 1 && n < 1000 ? n : null; };

/** Ham /odds yanıtından tercih sırasına göre bahisçi seç ve pazarları çöz (saf). */
export function parseAfOdds(response: any[], prefer: number[] = [AF_BOOKMAKERS.bet365, AF_BOOKMAKERS.pinnacle, AF_BOOKMAKERS.bwin, AF_BOOKMAKERS.unibet]): AfOdds | null {
  const books: any[] = (response?.[0]?.bookmakers || []) as any[];
  if (!books.length) return null;
  const order = [...prefer.map((id) => books.find((b) => Number(b.id) === id)).filter(Boolean), ...books];
  for (const b of order) {
    const bets: any[] = b.bets || [];
    const find = (id: number) => bets.find((x) => Number(x.id) === id);
    const val = (bet: any, name: string) => num(bet?.values?.find((v: any) => String(v.value).toLowerCase() === name.toLowerCase())?.odd);
    const mw = find(BET_MATCH_WINNER), ou = find(BET_OVER_UNDER), bt = find(BET_BTTS);
    const out: AfOdds = {
      bookmaker: String(b.name || b.id),
      home: val(mw, 'Home'), draw: val(mw, 'Draw'), away: val(mw, 'Away'),
      over25: val(ou, 'Over 2.5'), under25: val(ou, 'Under 2.5'),
      bttsYes: val(bt, 'Yes'), bttsNo: val(bt, 'No'),
    };
    if (out.over25 || out.bttsYes || out.home) return out;
  }
  return null;
}

// ---- Takım adı eşleme (saf) -------------------------------------------------
const STOP = new Set(['fc', 'cf', 'sc', 'ac', 'afc', 'club', 'de', 'fk', 'sk', 'cd', 'ud', 'as', 'us', 'ss', 'ssc', 'the', 'team', 'calcio', 'football', 'stade', 'real', 'sporting', 'athletic', 'atletico', 'ii', '1']);
export function normTeam(s: string): string[] {
  const base = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ı/g, 'i').replace(/[^a-z0-9 ]+/g, ' ');
  return base.split(/\s+/).filter((t) => t && !STOP.has(t) && !/^\d{2,4}$/.test(t));
}
export function teamSim(a: string, b: string): number {
  const A = new Set(normTeam(a)), B = new Set(normTeam(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  // kısmi kök eşleşmesi (Gladbach ~ Monchengladbach, Inter ~ Internazionale)
  if (!inter) for (const x of A) for (const y of B) if (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x) || x.includes(y) || y.includes(x))) inter += 0.8;
  return inter / Math.max(A.size, B.size);
}

export interface MapCandidate { fixtureId: number; kickoff: string; home: string; away: string }
/** FotMob maçlarını aynı lig+gün API-Football fikstürlerine eşle; belirsiz olanı atla. */
export function matchFixtures(ours: MapCandidate[], theirs: AfFixture[], minScore = 0.5): Array<{ fixtureId: number; afId: number; score: number }> {
  const out: Array<{ fixtureId: number; afId: number; score: number }> = [];
  const used = new Set<number>();
  for (const o of ours) {
    const scored = theirs.filter((t) => !used.has(t.id)).map((t) => {
      const dt = Math.abs(Date.parse(t.dateUtc) - Date.parse(o.kickoff)) / 3600_000;
      const s = (teamSim(o.home, t.home) + teamSim(o.away, t.away)) / 2 - (dt > 3 ? 0.3 : 0);
      return { t, s };
    }).sort((a, b) => b.s - a.s);
    const best = scored[0], second = scored[1];
    if (best && best.s >= minScore && (!second || best.s - second.s >= 0.15)) { used.add(best.t.id); out.push({ fixtureId: o.fixtureId, afId: best.t.id, score: Math.round(best.s * 100) / 100 }); }
  }
  return out;
}
