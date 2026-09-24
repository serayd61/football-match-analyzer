// ============================================================================
// TAKIM KARNESİ (saf) — "bu takımın maçlarında biz ne yaptık"
// ----------------------------------------------------------------------------
// Neden (24 Eyl, kullanıcı): karneyi takıma indir — "X takımı: 3 tuttu 2 yattı".
// Örnek küçük (180 günde takım başına 15–25 maç); yüzde yerine kayıt ("5/7") ve
// ≥MIN_TEAM_N eşiği. Kaynak engine_predictions sonuçlanmış satırları: 1X2
// `correct`, Ü/A `ou_correct`, KG `btts_correct` (Faz 1 skorlama, 7 Eyl).
// ============================================================================
export interface TeamRecordRow { home_id: number | null; away_id: number | null; pick: string | null; correct: boolean | null; ou_pick: string | null; ou_correct: boolean | null; btts_pick: string | null; btts_correct: boolean | null; home_score: number | null; away_score: number | null; kickoff: string }
export interface Cell { n: number; won: number }
export interface TeamRecord {
  n: number;
  x12: Cell;         // takımın maçlarında 1X2 seçimimiz
  toWin: Cell;       // "bu takım kazanır" dediğimiz maçlar
  ou25: Cell;        // Üst/Alt seçimimiz (ou_pick ne olursa olsun)
  over: Cell;        // yalnız Üst dediğimiz maçlar
  btts: Cell;        // KG Var dediğimiz maçlar
  last: Array<{ kickoff: string; won: boolean | null }>; // 1X2, en yeni önce (şerit için)
}
export const MIN_TEAM_N = 5;
export type TeamVerdict = 'strong' | 'mid' | 'weak' | 'thin';

const cell = (): Cell => ({ n: 0, won: 0 });
const hit = (c: Cell, won: boolean | null | undefined) => { if (won == null) return; c.n++; if (won) c.won++; };

export function teamRecord(rows: TeamRecordRow[], teamId: number): TeamRecord {
  const r: TeamRecord = { n: 0, x12: cell(), toWin: cell(), ou25: cell(), over: cell(), btts: cell(), last: [] };
  const sorted = [...rows].filter((x) => Number(x.home_id) === teamId || Number(x.away_id) === teamId).sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  for (const x of sorted) {
    if (x.home_score == null || x.away_score == null) continue;
    r.n++;
    hit(r.x12, x.correct);
    const side = Number(x.home_id) === teamId ? '1' : '2';
    if (x.pick === side) hit(r.toWin, x.correct);
    hit(r.ou25, x.ou_correct);
    if (x.ou_pick === 'over') hit(r.over, x.ou_correct);
    if (x.btts_pick === 'yes') hit(r.btts, x.btts_correct);
    if (r.last.length < 10) r.last.push({ kickoff: x.kickoff, won: x.correct ?? null });
  }
  return r;
}

/** Hüküm: 1X2 hücresi ≥MIN_TEAM_N ise isabete göre (≥%65 güçlü, <%45 zayıf). */
export function teamVerdict(c: Cell, strong = 0.65, weak = 0.45): TeamVerdict {
  if (c.n < MIN_TEAM_N) return 'thin';
  const a = c.won / c.n;
  return a >= strong ? 'strong' : a < weak ? 'weak' : 'mid';
}
export const fmtCell = (c: Cell) => `${c.won}/${c.n}`;
