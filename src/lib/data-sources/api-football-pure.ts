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

// ---- Maç bağlamı: eksikler + kadro (saf) --------------------------------------
// /injuries?fixture= ve /fixtures/lineups?fixture= yanıtlarını sadeleştirir ve
// hangi takımın "home"/"away" olduğunu bizim takım adlarımızla eşler (API-Football
// takım kimlikleri bizde yok). Zamanlama: eksikler ≤48 s kala, 6 s'de bir; kadro
// ~75 dk kala, bir kez (alındıktan sonra değişmez).

export type AfSide = 'home' | 'away';
export interface AfInjury { side: AfSide; team: string; player: string; type: string; reason: string | null }
export interface AfLineupPlayer { name: string; number: number | null; pos: string | null }
export interface AfLineup { side: AfSide; team: string; formation: string | null; coach: string | null; startXI: AfLineupPlayer[]; bench: AfLineupPlayer[] }

export const INJURIES_WINDOW_MS = 48 * 3600_000;
export const INJURIES_TTL_MS = 6 * 3600_000;
export const LINEUPS_BEFORE_MS = 75 * 60_000;
export const LINEUPS_AFTER_MS = 4 * 3600_000;

/** API-Football takım adını ev/deplasman tarafına eşle; belirsizse verilen sıra (0 ev, 1 dep). */
export function sideFor(name: string, home: string, away: string, index: number): AfSide {
  const h = teamSim(name, home), a = teamSim(name, away);
  if (h > a && h >= 0.5) return 'home';
  if (a > h && a >= 0.5) return 'away';
  return index === 0 ? 'home' : 'away';
}

export function parseAfInjuries(response: any[], home: string, away: string): AfInjury[] {
  const teams: string[] = [];
  const out: AfInjury[] = [];
  for (const r of response || []) {
    const team = String(r?.team?.name || '').trim(), player = String(r?.player?.name || '').trim();
    if (!team || !player) continue;
    if (!teams.includes(team)) teams.push(team);
    out.push({ side: sideFor(team, home, away, teams.indexOf(team)), team, player, type: String(r?.player?.type || 'Missing Fixture'), reason: r?.player?.reason ? String(r.player.reason) : null });
  }
  return out;
}

const player = (p: any): AfLineupPlayer => ({ name: String(p?.player?.name || ''), number: Number.isFinite(Number(p?.player?.number)) ? Number(p.player.number) : null, pos: p?.player?.pos ? String(p.player.pos) : null });

/** Kadro açıklanmadıysa (boş yanıt / 11 eksik) null. */
export function parseAfLineups(response: any[], home: string, away: string): AfLineup[] | null {
  const rows = (response || []).map((t: any, i: number): AfLineup => ({
    side: sideFor(String(t?.team?.name || ''), home, away, i), team: String(t?.team?.name || ''),
    formation: t?.formation ? String(t.formation) : null, coach: t?.coach?.name ? String(t.coach.name) : null,
    startXI: (t?.startXI || []).map(player).filter((p: AfLineupPlayer) => p.name), bench: (t?.substitutes || []).map(player).filter((p: AfLineupPlayer) => p.name),
  }));
  if (rows.length < 2 || rows.some((r) => r.startXI.length < 11)) return null;
  return rows;
}

/** Eksikler tazelensin mi: başlamaya ≤48 s ve başlamadan önce; son alım ≥6 s önce. */
export function injuriesDue(kickoffIso: string, nowMs: number, lastAtIso: string | null): boolean {
  const k = Date.parse(kickoffIso);
  if (!Number.isFinite(k) || nowMs > k || k - nowMs > INJURIES_WINDOW_MS) return false;
  return !lastAtIso || nowMs - Date.parse(lastAtIso) >= INJURIES_TTL_MS;
}

/** Kadro alınsın mı: ~75 dk kala ile +4 s arası ve elde kadro yok. */
export function lineupsDue(kickoffIso: string, nowMs: number, haveLineups: boolean): boolean {
  if (haveLineups) return false;
  const k = Date.parse(kickoffIso);
  return Number.isFinite(k) && k - nowMs <= LINEUPS_BEFORE_MS && nowMs - k <= LINEUPS_AFTER_MS;
}
