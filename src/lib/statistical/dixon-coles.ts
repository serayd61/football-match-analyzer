// ============================================================================
// DIXON-COLES STATISTICAL ENGINE
// Gerçek matematiksel maç olasılığı motoru (LLM tahmini DEĞİL).
//
// Model:
//   λ (ev sahibi beklenen gol) = exp(attack[home] + defense[away] + homeAdv)
//   μ (deplasman beklenen gol)  = exp(attack[away] + defense[home])
//   Goller Poisson dağılır; düşük skorlar için Dixon-Coles (1997) τ düzeltmesi.
//   Zaman ağırlığı: yeni maçlar exp(-ξ·t) ile daha ağır sayılır.
//   Parametreler maksimum olabilirlik (Adam optimizer + sayısal gradyan) ile fit edilir.
//
// Çıktı: tam skor matrisi → 1X2, Üst/Alt, KG Var/Yok, en olası skor.
// ============================================================================

export interface MatchRow {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  date: string | Date;
}

export interface DCParams {
  attack: Record<string, number>;
  defense: Record<string, number>;
  homeAdv: number;
  rho: number;
}

export interface MarketProbabilities {
  expectedGoals: { home: number; away: number };
  matchResult: { home: number; draw: number; away: number };
  overUnder: Record<string, { over: number; under: number }>;
  btts: { yes: number; no: number };
  correctScore: { score: string; prob: number }[];
  mostLikelyScore: string;
  scoreMatrix: number[][];
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export class DixonColesModel {
  private teams: string[] = [];
  private params: DCParams = { attack: {}, defense: {}, homeAdv: 0.25, rho: -0.1 };
  private fitted = false;

  private rates(home: string, away: string, p: DCParams): { lambda: number; mu: number } {
    const lambda = Math.exp((p.attack[home] ?? 0) + (p.defense[away] ?? 0) + p.homeAdv);
    const mu = Math.exp((p.attack[away] ?? 0) + (p.defense[home] ?? 0));
    return { lambda, mu };
  }

  private negLogLik(matches: MatchRow[], weights: number[], p: DCParams): number {
    let nll = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const { lambda, mu } = this.rates(m.homeTeam, m.awayTeam, p);
      const t = tau(m.homeGoals, m.awayGoals, lambda, mu, p.rho);
      const pHome = poissonPmf(m.homeGoals, lambda);
      const pAway = poissonPmf(m.awayGoals, mu);
      const prob = Math.max(t * pHome * pAway, 1e-12);
      nll -= weights[i] * Math.log(prob);
    }
    return nll;
  }

  private timeWeights(matches: MatchRow[], xi: number): number[] {
    const dates = matches.map((m) => new Date(m.date).getTime());
    const tMax = Math.max(...dates);
    const DAY = 86400000;
    return dates.map((d) => Math.exp((-xi * (tMax - d)) / DAY));
  }

  private fromVector(v: number[]): DCParams {
    const n = this.teams.length;
    const attack: Record<string, number> = {};
    const defense: Record<string, number> = {};
    const rawAttack = v.slice(0, n);
    const meanA = rawAttack.reduce((a, b) => a + b, 0) / n;
    this.teams.forEach((t, i) => (attack[t] = rawAttack[i] - meanA));
    this.teams.forEach((t, i) => (defense[t] = v[n + i]));
    return {
      attack,
      defense,
      homeAdv: v[2 * n],
      rho: Math.max(-0.99, Math.min(0.99, v[2 * n + 1])),
    };
  }

  fit(matches: MatchRow[], opts: { xi?: number; iters?: number; lr?: number } = {}): DCParams {
    const xi = opts.xi ?? 0.0018;
    const iters = opts.iters ?? 250;
    const lr = opts.lr ?? 0.05;

    const set = new Set<string>();
    matches.forEach((m) => {
      set.add(m.homeTeam);
      set.add(m.awayTeam);
    });
    this.teams = [...set];
    const n = this.teams.length;

    const weights = this.timeWeights(matches, xi);

    let v = new Array(2 * n + 2).fill(0);
    v[2 * n] = 0.25;
    v[2 * n + 1] = -0.1;

    const m = new Array(v.length).fill(0);
    const vv = new Array(v.length).fill(0);
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const h = 1e-5;

    for (let step = 1; step <= iters; step++) {
      const base = this.negLogLik(matches, weights, this.fromVector(v));
      const grad = new Array(v.length).fill(0);
      for (let j = 0; j < v.length; j++) {
        const vp = v.slice();
        vp[j] += h;
        const fp = this.negLogLik(matches, weights, this.fromVector(vp));
        grad[j] = (fp - base) / h;
      }
      for (let j = 0; j < v.length; j++) {
        m[j] = b1 * m[j] + (1 - b1) * grad[j];
        vv[j] = b2 * vv[j] + (1 - b2) * grad[j] * grad[j];
        const mHat = m[j] / (1 - Math.pow(b1, step));
        const vHat = vv[j] / (1 - Math.pow(b2, step));
        v[j] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
      }
    }

    this.params = this.fromVector(v);
    this.fitted = true;
    return this.params;
  }

  /** Önceden hesaplanmış parametreleri yükle (cache'ten — fit etmeden predict için) */
  loadParams(params: DCParams): void {
    this.params = params;
    this.teams = Object.keys(params.attack);
    this.fitted = true;
  }

  predict(home: string, away: string, maxGoals = 10): MarketProbabilities {
    if (!this.fitted) throw new Error('Model fit edilmedi. Önce fit() veya loadParams() çağır.');
    const p = this.params;
    const { lambda, mu } = this.rates(home, away, p);

    const matrix: number[][] = [];
    let total = 0;
    for (let x = 0; x <= maxGoals; x++) {
      matrix[x] = [];
      for (let y = 0; y <= maxGoals; y++) {
        const prob = tau(x, y, lambda, mu, p.rho) * poissonPmf(x, lambda) * poissonPmf(y, mu);
        matrix[x][y] = Math.max(prob, 0);
        total += matrix[x][y];
      }
    }
    for (let x = 0; x <= maxGoals; x++)
      for (let y = 0; y <= maxGoals; y++) matrix[x][y] /= total;

    let home_w = 0, draw = 0, away_w = 0, bttsYes = 0;
    const ouLines = [0.5, 1.5, 2.5, 3.5];
    const overUnder: Record<string, { over: number; under: number }> = {};
    ouLines.forEach((l) => (overUnder[l.toString()] = { over: 0, under: 0 }));
    const scores: { score: string; prob: number }[] = [];

    for (let x = 0; x <= maxGoals; x++) {
      for (let y = 0; y <= maxGoals; y++) {
        const pr = matrix[x][y];
        if (x > y) home_w += pr;
        else if (x === y) draw += pr;
        else away_w += pr;
        if (x >= 1 && y >= 1) bttsYes += pr;
        ouLines.forEach((l) => {
          if (x + y > l) overUnder[l.toString()].over += pr;
          else overUnder[l.toString()].under += pr;
        });
        scores.push({ score: `${x}-${y}`, prob: pr });
      }
    }

    scores.sort((a, b) => b.prob - a.prob);

    return {
      expectedGoals: { home: lambda, away: mu },
      matchResult: { home: home_w, draw, away: away_w },
      overUnder,
      btts: { yes: bttsYes, no: 1 - bttsYes },
      correctScore: scores.slice(0, 8),
      mostLikelyScore: scores[0].score,
      scoreMatrix: matrix,
    };
  }

  getParams(): DCParams {
    return this.params;
  }

  static fairOdds(prob: number): number {
    return prob > 0 ? +(1 / prob).toFixed(2) : Infinity;
  }
}
