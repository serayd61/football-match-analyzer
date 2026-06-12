// ============================================================================
// BLEND BACKTEST — DC-tek vs PİYASA-tek vs DC+PİYASA harman (w taraması).
// Walk-forward, data-leakage'sız, GERÇEK bahisçi oranıyla (football-data.co.uk).
//
// AMAÇ: "Piyasa oranını çıpa olarak kullanmak isabeti ve kalibrasyonu
// iyileştiriyor mu?" sorusunu out-of-sample kanıtla ve optimal w'yi bul.
//
// Kullanım:
//   npm run backtest:blend -- E0           (Premier League, son 2 sezon)
//   npm run backtest:blend -- SP1 3        (La Liga, son 3 sezon)
//
// API key GEREKMEZ. İnternet erişimi yeterli.
// ============================================================================

import { DixonColesModel } from '../src/lib/statistical/dixon-coles';
import { blendWithMarket } from '../src/lib/odds/blend';
import { marketMatchResult } from '../src/lib/odds/devig';
import { loadSeasons, OddsMatchRow, FDCO_DIVS } from '../src/lib/odds/football-data-csv';

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

interface Tally {
  n: number;
  mrCorrect: number;
  mrLogLoss: number;
  ouCorrect: number;
  ouN: number;
  ouLogLoss: number;
}

function emptyTally(): Tally {
  return { n: 0, mrCorrect: 0, mrLogLoss: 0, ouCorrect: 0, ouN: 0, ouLogLoss: 0 };
}

function argmaxMR(p: { home: number; draw: number; away: number }): 'home' | 'draw' | 'away' {
  return p.home >= p.draw && p.home >= p.away ? 'home' : p.draw >= p.away ? 'draw' : 'away';
}

function accumMR(t: Tally, p: { home: number; draw: number; away: number }, actual: 'home' | 'draw' | 'away') {
  if (argmaxMR(p) === actual) t.mrCorrect++;
  t.mrLogLoss -= Math.log(Math.max(p[actual], 1e-12));
  t.n++;
}

function accumOU(t: Tally, over: number, actualOver: boolean) {
  if ((over > 0.5) === actualOver) t.ouCorrect++;
  const p = actualOver ? over : 1 - over;
  t.ouLogLoss -= Math.log(Math.max(p, 1e-12));
  t.ouN++;
}

async function main() {
  const div = (process.argv[2] || 'E0').toUpperCase();
  const nSeasons = Math.max(1, parseInt(process.argv[3] || '2', 10));

  const validDivs = Object.values(FDCO_DIVS);
  if (!validDivs.includes(div)) {
    console.error(`❌ Geçersiz div: ${div}. Geçerli: ${validDivs.join(', ')}`);
    console.error(`   (lig kodu eşlemesi: ${Object.entries(FDCO_DIVS).map(([k, v]) => `${k}=${v}`).join(', ')})`);
    process.exit(1);
  }

  // Hangi sezonlar? football-data.co.uk güncel sezon devam ederken kısmi veri verir.
  const thisYear = new Date().getFullYear();
  const seasonStart = new Date().getMonth() + 1 >= 7 ? thisYear : thisYear - 1;
  const startYears = Array.from({ length: nSeasons }, (_, i) => seasonStart - (nSeasons - 1) + i);

  console.log(`\n⚽ BLEND Backtest — ${div}  (sezonlar: ${startYears.map((y) => `${y}/${y + 1}`).join(', ')})`);
  console.log('📥 football-data.co.uk CSV indiriliyor (oranlar dahil)...\n');

  const matches: OddsMatchRow[] = await loadSeasons(div, startYears);
  const withOdds = matches.filter((m) => m.odds.matchResult);
  console.log(`✅ ${matches.length} maç (${withOdds.length} tanesinde 1X2 oranı var)`);

  const W_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9, 1.0];
  const blendTallies = new Map<number, Tally>();
  W_GRID.forEach((w) => blendTallies.set(w, emptyTally()));
  const dcOnly = emptyTally();
  const mktOnly = emptyTally();

  const minTrain = 60;
  const refitEvery = Math.max(1, parseInt(process.env.BT_REFIT || '5', 10));
  const iters = parseInt(process.env.BT_ITERS || '100', 10);

  let model: DixonColesModel | null = null;
  let lastFitCount = -1;
  let marginSum = 0;
  let marginN = 0;

  const t0 = Date.now();
  for (let i = minTrain; i < matches.length; i++) {
    const m = matches[i];
    if (!m.odds.matchResult) continue; // oransız maçı atla (adil kıyas)

    // Refit (yalnızca geçmiş maçlarla — leakage yok)
    if (!model || i - lastFitCount >= refitEvery) {
      const train = matches.slice(0, i);
      const seen = new Set<string>();
      train.forEach((t) => { seen.add(t.homeTeam); seen.add(t.awayTeam); });
      model = new DixonColesModel();
      model.fit(train, { xi: 0.0025, iters, lr: 0.08 });
      lastFitCount = i;
    }

    const seen = new Set<string>();
    matches.slice(0, i).forEach((t) => { seen.add(t.homeTeam); seen.add(t.awayTeam); });
    if (!seen.has(m.homeTeam) || !seen.has(m.awayTeam)) continue;

    const dc = model.predict(m.homeTeam, m.awayTeam);

    const actualMR: 'home' | 'draw' | 'away' =
      m.homeGoals > m.awayGoals ? 'home' : m.homeGoals === m.awayGoals ? 'draw' : 'away';
    const actualOver = m.homeGoals + m.awayGoals > 2.5;

    // DC-tek
    accumMR(dcOnly, dc.matchResult, actualMR);
    accumOU(dcOnly, dc.overUnder['2.5'].over, actualOver);

    // Piyasa-tek (de-vig)
    const o = m.odds.matchResult!;
    const mkt = marketMatchResult(o.home, o.draw, o.away);
    accumMR(mktOnly, mkt, actualMR);
    marginSum += 1 / o.home + 1 / o.draw + 1 / o.away - 1;
    marginN++;
    if (m.odds.overUnder?.['2.5']) {
      const ou = m.odds.overUnder['2.5'];
      const impOver = (1 / ou.over) / (1 / ou.over + 1 / ou.under);
      accumOU(mktOnly, impOver, actualOver);
    }

    // Blend (her w)
    for (const w of W_GRID) {
      const b = blendWithMarket(dc, m.odds, { marketWeight: w });
      const t = blendTallies.get(w)!;
      accumMR(t, b.matchResult, actualMR);
      accumOU(t, b.overUnder['2.5'].over, actualOver);
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const N = dcOnly.n;
  if (N === 0) {
    console.error('❌ Test edilecek maç yok (oran/veri eksik).');
    process.exit(1);
  }

  const row = (label: string, t: Tally) =>
    `│ ${label.padEnd(14)}│ ${pct(t.mrCorrect / t.n).padStart(7)} │ ${(t.mrLogLoss / t.n).toFixed(4).padStart(8)} │ ${pct(t.ouCorrect / Math.max(t.ouN, 1)).padStart(7)} │ ${(t.ouLogLoss / Math.max(t.ouN, 1)).toFixed(4).padStart(8)} │`;

  console.log(`\nTest edilen maç: ${N}   |   Ort. bahisçi marjı: ${pct(marginSum / Math.max(marginN, 1))}   |   ⏱️ ${secs}s\n`);
  console.log('┌───────────────┬─────────┬──────────┬─────────┬──────────┐');
  console.log('│ Strateji      │ 1X2 acc │ 1X2 LL   │ O/U acc │ O/U LL   │');
  console.log('├───────────────┼─────────┼──────────┼─────────┼──────────┤');
  console.log(row('DC-tek (w=0)', dcOnly));
  console.log(row('Piyasa-tek', mktOnly));
  console.log('├───────────────┼─────────┼──────────┼─────────┼──────────┤');
  for (const w of W_GRID) {
    if (w === 0 || w === 1) continue;
    console.log(row(`blend w=${w}`, blendTallies.get(w)!));
  }
  console.log('└───────────────┴─────────┴──────────┴─────────┴──────────┘');
  console.log('ℹ️  Daha DÜŞÜK log-loss (LL) = daha iyi kalibrasyon. Asıl metrik LL.');

  // En iyi w'yi 1X2 log-loss'a göre seç
  let bestW = 0, bestLL = Infinity;
  for (const w of W_GRID) {
    const t = blendTallies.get(w)!;
    const ll = t.mrLogLoss / t.n;
    if (ll < bestLL) { bestLL = ll; bestW = w; }
  }
  const dcLL = dcOnly.mrLogLoss / dcOnly.n;
  const improve = ((dcLL - bestLL) / dcLL) * 100;
  console.log(`\n🏆 En iyi piyasa ağırlığı: w=${bestW}  (1X2 log-loss ${bestLL.toFixed(4)}, DC-tek'e göre %${improve.toFixed(1)} iyileşme)`);
  console.log(`   → src/lib/odds/blend.ts DEFAULT_MARKET_WEIGHT için öneri: ${bestW}`);
}

main().catch((e) => {
  console.error('❌ Blend backtest hatası:', e?.stack || e?.message || e);
  process.exit(1);
});
