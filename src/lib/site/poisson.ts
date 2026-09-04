// Score-matrix derivations from the model's expected goals (λ home / λ away).
// The engine stores λ and the headline probabilities; everything else on the
// match page (O/U lines, exact scores, handicap) is derived here at render
// time with an independent Poisson. The Dixon-Coles low-score correction is
// not re-applied (ρ is not persisted per match), so 0-0/1-1 cells can differ
// slightly from the engine's own 1X2 figures — the page says so.

const MAX_GOALS = 8;

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export interface ScoreMatrix {
  /** m[h][a] = P(home scores h, away scores a) */
  m: number[][];
  lambdaHome: number;
  lambdaAway: number;
}

export function scoreMatrix(lambdaHome: number, lambdaAway: number): ScoreMatrix {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(lambdaHome, k));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(lambdaAway, k));
  const m = ph.map((h) => pa.map((a) => h * a));
  // Renormalise the truncated grid so cells sum to 1.
  const total = m.flat().reduce((s, x) => s + x, 0);
  for (const row of m) for (let j = 0; j < row.length; j++) row[j] /= total;
  return { m, lambdaHome, lambdaAway };
}

export function outcomeProbs(sm: ScoreMatrix) {
  let home = 0, draw = 0, away = 0;
  sm.m.forEach((row, h) => row.forEach((p, a) => { if (h > a) home += p; else if (h === a) draw += p; else away += p; }));
  return { home, draw, away };
}

export function overProb(sm: ScoreMatrix, line: number): number {
  let over = 0;
  sm.m.forEach((row, h) => row.forEach((p, a) => { if (h + a > line) over += p; }));
  return over;
}

export function bttsProb(sm: ScoreMatrix): number {
  let yes = 0;
  sm.m.forEach((row, h) => row.forEach((p, a) => { if (h > 0 && a > 0) yes += p; }));
  return yes;
}

export function topScores(sm: ScoreMatrix, n = 5): Array<{ home: number; away: number; p: number }> {
  const cells: Array<{ home: number; away: number; p: number }> = [];
  sm.m.forEach((row, h) => row.forEach((p, a) => cells.push({ home: h, away: a, p })));
  return cells.sort((x, y) => y.p - x.p).slice(0, n);
}

export interface HandicapLine {
  /** line applied to the HOME side, e.g. -0.5 means home must win */
  line: number;
  pHomeCover: number;
  pPush: number;
  pAwayCover: number;
}

/** Asian handicap on whole/half lines from -2 to +2 (home perspective). */
export function handicapTable(sm: ScoreMatrix): HandicapLine[] {
  const lines = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
  return lines.map((line) => {
    let cover = 0, push = 0, lose = 0;
    sm.m.forEach((row, h) => row.forEach((p, a) => {
      const d = h + line - a;
      if (d > 0) cover += p; else if (d === 0) push += p; else lose += p;
    }));
    return { line, pHomeCover: cover, pPush: push, pAwayCover: lose };
  });
}

/**
 * The line that brings the two sides closest to even after removing pushes.
 * This is the model's "fair" handicap — informative, not a bet suggestion.
 */
export function fairHandicap(sm: ScoreMatrix): HandicapLine {
  const table = handicapTable(sm);
  return table.reduce((best, cur) => {
    const bal = (l: HandicapLine) => Math.abs(l.pHomeCover - l.pAwayCover);
    return bal(cur) < bal(best) ? cur : best;
  });
}
