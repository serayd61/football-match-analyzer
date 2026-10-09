import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeague, evaluateLeague, isProposalEligibleName, bucketOf, hideDecision, strongMarkets, COVERAGE_GATE } from '@/lib/coverage/rules';

const row = (o: Partial<Parameters<typeof aggregateLeague>[0][number]>) => ({ p_over25: null, p_btts_yes: null, home_score: 1, away_score: 1, correct: null, ll_1x2: null, kickoff: '2026-09-01T12:00:00Z', ...o });

test('aggregateLeague counts threshold legs and their hits; unscored rows are skipped', () => {
  const s = aggregateLeague([
    row({ p_over25: 0.70, home_score: 2, away_score: 1, correct: true, ll_1x2: 0.5 }),   // Üst ✓, KG ✓ değil (eşik altı)
    row({ p_over25: 0.66, home_score: 1, away_score: 0, correct: false, ll_1x2: 1.0 }),  // Üst ✗
    row({ p_btts_yes: 0.61, home_score: 1, away_score: 1 }),                             // KG ✓
    row({ p_btts_yes: 0.90, home_score: null }),                                          // skorsuz → atla
  ], 180);
  assert.equal(s.n, 3);
  assert.deepEqual(s.ouHi, { n: 2, won: 1 });
  assert.deepEqual(s.bttsHi, { n: 1, won: 1 });
  assert.deepEqual(s.x12, { n: 2, won: 1, ll: 0.75 });
});

const stats = (ou: [number, number], bt: [number, number], n = 100) => ({ n, x12: { n, won: 50, ll: 1 }, ouHi: { n: ou[1], won: ou[0] }, bttsHi: { n: bt[1], won: bt[0] }, lastKickoff: null, windowDays: 180 });

test('observe league is proposed for promotion only above the gate with enough legs', () => {
  assert.equal(evaluateLeague('observe', stats([30, 40], [20, 40]))?.type, 'promote');      // Üst 75%
  assert.equal(evaluateLeague('observe', stats([20, 40], [25, 40]))?.type, 'promote');      // KG 62.5%
  assert.equal(evaluateLeague('observe', stats([30, 39], [20, 39])), null);                 // n < 40
  assert.equal(evaluateLeague('observe', stats([25, 40], [24, 40])), null);                 // 62.5% Üst < 65, KG 60% < 62
});

test('whitelist league is proposed for demotion when a goal market falls below the floor; excluded strong league becomes a watch candidate', () => {
  assert.equal(evaluateLeague('whitelist', stats([21, 40], [30, 40]))?.type, 'demote');     // Üst 52.5% < 55
  assert.equal(evaluateLeague('whitelist', stats([26, 40], [30, 40])), null);               // 65% / 75%
  const w = evaluateLeague('excluded', stats([30, 40], [26, 40], COVERAGE_GATE.watchMinN));
  assert.equal(w?.type, 'watch'); assert.equal(w?.to, 'observe');
  assert.equal(evaluateLeague('excluded', stats([30, 40], [10, 40], COVERAGE_GATE.watchMinN)), null); // tek pazar yetmez
  assert.equal(evaluateLeague('excluded', stats([30, 40], [26, 40], COVERAGE_GATE.watchMinN - 1)), null);
});

test('friendlies, women, youth, reserve and lower amateur tiers are never proposal-eligible', () => {
  for (const n of ['Club Friendlies', 'Frauen-Bundesliga', 'Ajax (W)', 'Premier League 2', 'U21 Premier League', 'MLS Next Pro', '3. Divisjon Avd. 2', 'Ettan Soedra', 'Regionalliga North', 'Serie A (W)']) {
    assert.equal(isProposalEligibleName(n), false, n);
  }
  for (const n of ['Eliteserien', 'Superettan', 'Major League Soccer', 'Süper Lig', '1. Divisjon']) assert.equal(isProposalEligibleName(n), true, n);
});

test('bucketOf labels and aggregateLeague fills per-market buckets', () => {
  assert.equal(bucketOf('x12', 0.83), '≥80'); assert.equal(bucketOf('x12', 0.5), '50–60'); assert.equal(bucketOf('ou25', 0.9), '≥85');
  assert.equal(bucketOf('under25', 0.6), null); assert.equal(bucketOf('under25', 0.76), '≥75');
  const s = aggregateLeague([
    row({ p_home: 0.85, p_draw: 0.1, p_away: 0.05, p_over25: 0.9, p_btts_yes: 0.3, home_score: 3, away_score: 0 }),
    row({ p_home: 0.2, p_draw: 0.2, p_away: 0.6, p_over25: 0.2, p_btts_yes: 0.85, home_score: 1, away_score: 1 }),
  ], 180);
  assert.deepEqual(s.buckets!.x12['≥80'], { n: 1, won: 1 });
  assert.deepEqual(s.buckets!.x12['60–70'], { n: 1, won: 0 });
  assert.deepEqual(s.buckets!.ou25['≥85'], { n: 1, won: 1 });
  assert.deepEqual(s.buckets!.under25['≥75'], { n: 1, won: 1 });   // 1-0.2 = 0.8 → Alt ✓ (1-1)
  assert.deepEqual(s.buckets!.btts['≥80'], { n: 1, won: 1 });
});

test('hideDecision: excluded league with worse-than-random 1X2 log-loss is hidden at n>=20; hidden league returns when LL < 1.05', () => {
  const st = (n: number, ll: number | null) => ({ n, x12: { n, won: 0, ll }, ouHi: { n: 0, won: 0 }, bttsHi: { n: 0, won: 0 }, lastKickoff: null, windowDays: 180 });
  assert.equal(hideDecision('excluded', st(21, 1.12)), 'hide');
  assert.equal(hideDecision('excluded', st(19, 1.5)), null);      // örnek küçük
  assert.equal(hideDecision('excluded', st(50, 1.05)), null);
  assert.equal(hideDecision('hidden', st(50, 1.07)), null);       // histerezis
  assert.equal(hideDecision('hidden', st(50, 1.04)), 'unhide');
  assert.equal(hideDecision('whitelist', st(50, 1.5)), null);     // beyaz liste kuralı ayrı (demote)
  assert.equal(hideDecision('excluded', st(50, null)), null);
});

test('strongMarkets: top buckets combined, n>=15 and acc>=70%; a strong market blocks hiding and lifts it', () => {
  const b = { x12: { '70–80': { n: 4, won: 2 }, '≥80': { n: 8, won: 2 } }, ou25: { '75–85': { n: 16, won: 9 }, '≥85': { n: 10, won: 7 } }, under25: {}, btts: { '70–80': { n: 17, won: 11 }, '≥80': { n: 7, won: 6 } } };
  assert.deepEqual(strongMarkets(b), [{ market: 'btts', from: 0.7, n: 24, won: 17 }]);   // Isthmian: Üst 16/26 = 62% → değil, KG 17/24 = 71% → güçlü
  assert.deepEqual(strongMarkets(undefined), []);
  const st = (status: any, strong: any[]) => hideDecision(status, { n: 63, x12: { n: 63, won: 25, ll: 1.2989 }, ouHi: { n: 0, won: 0 }, bttsHi: { n: 0, won: 0 }, strong, lastKickoff: null, windowDays: 180 });
  assert.equal(st('excluded', strongMarkets(b)), null);
  assert.equal(st('hidden', strongMarkets(b)), 'unhide');
  assert.equal(st('excluded', []), 'hide');
});

// ---- Piyasa farkı karnesi (2026-10-09) --------------------------------------
import { bandFor, sumEdge, BAND } from '@/lib/coverage/rules';

test('aggregateLeague fills edge buckets from the chosen side vs devigged market; rows without odds are skipped', () => {
  const mk = (pHome: number, pDraw: number, pAway: number, pOver: number | null, pBttsYes: number | null) => ({ pHome, pDraw, pAway, pOver, pBttsYes });
  const s = aggregateLeague([
    // 1X2 ev %65 vs piyasa %61 → +4 → '0…+5', tuttu; Üst %50 vs %60 → seçim Üst, −10 → '≤−5', yattı (1 gol); KG %46 → KG Yok %54 vs piyasa KG Yok %42 → +12 → '>+10', tuttu
    row({ p_home: 0.65, p_draw: 0.23, p_away: 0.12, p_over25: 0.50, p_btts_yes: 0.46, home_score: 1, away_score: 0, market: mk(0.61, 0.22, 0.17, 0.60, 0.58) }),
    // 1X2 ev %52 vs %31 → +21 → '>+10', yattı (1-2); Üst %62 vs %58 → +4 → '0…+5', tuttu; KG %62 vs %64 → −2 → '−5…0', tuttu
    row({ p_home: 0.52, p_draw: 0.24, p_away: 0.24, p_over25: 0.62, p_btts_yes: 0.62, home_score: 1, away_score: 2, market: mk(0.31, 0.27, 0.42, 0.58, 0.64) }),
    // oran yok → fark kovasına girmez, seviye kovasına girer
    row({ p_home: 0.70, p_draw: 0.18, p_away: 0.12, p_over25: 0.70, p_btts_yes: 0.60, home_score: 2, away_score: 1, market: null }),
    // Üst oranı var, 1X2/KG yok
    row({ p_home: 0.40, p_draw: 0.30, p_away: 0.30, p_over25: 0.69, p_btts_yes: 0.70, home_score: 2, away_score: 2, market: mk(null as any, null as any, null as any, 0.65, null) }),
  ], 180);
  assert.equal(s.n, 4);
  assert.equal(s.oddsN, 3);
  assert.deepEqual(s.edge!.x12, { '0…+5': { n: 1, won: 1 }, '>+10': { n: 1, won: 0 } });
  assert.deepEqual(s.edge!.ou25, { '≤−5': { n: 1, won: 0 }, '0…+5': { n: 2, won: 2 } });
  assert.deepEqual(s.edge!.btts, { '>+10': { n: 1, won: 1 }, '−5…0': { n: 1, won: 1 } });
  assert.equal(s.buckets!.x12['70–80'].n, 1); // oransız maç seviye kovasında
});

test('bandFor: league scope when n ≥ 20, else all-league fallback; strong needs a ≥15-point gap', () => {
  const edge = (inN: number, inW: number, outN: number, outW: number) => ({ x12: { '−5…0': { n: inN, won: inW }, '+5…+10': { n: outN, won: outW } }, ou25: {}, btts: {} });
  const league = edge(30, 21, 12, 3);      // bant içi %70, bant dışı %25 → güçlü
  const all = edge(400, 232, 120, 36);     // %58 vs %30
  const b = bandFor('x12', league, all)!;
  assert.equal(b.scope, 'league'); assert.equal(b.inBand.n, 30); assert.equal(b.outPlus.acc, 0.25); assert.equal(b.strong, true);
  const thin = bandFor('x12', edge(8, 6, 2, 0), all)!;
  assert.equal(thin.scope, 'all'); assert.equal(thin.inBand.n, 400); assert.equal(thin.strong, true);
  const weak = bandFor('x12', edge(30, 18, 12, 7), all)!; // %60 vs %58 → ayırt etmiyor
  assert.equal(weak.strong, false);
  assert.equal(bandFor('ou25', league, undefined), null); // ligde ou25 kanıtı yok, toplam da yok → null
});

test('sumEdge adds per-bucket cells across leagues', () => {
  const a: any = { edge: { x12: { '0…+5': { n: 3, won: 2 } }, ou25: {}, btts: {} } };
  const b: any = { edge: { x12: { '0…+5': { n: 5, won: 1 }, '>+10': { n: 2, won: 0 } }, ou25: {}, btts: {} } };
  assert.deepEqual(sumEdge([a, null, b]).x12, { '0…+5': { n: 8, won: 3 }, '>+10': { n: 2, won: 0 } });
  assert.equal(BAND.minN, 20);
});
