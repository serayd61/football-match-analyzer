import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessMarket, assessMatch, inputsFor, wilson, marketOf, MIN_SUPPORT_N, ASSESSMENT_RULE_VERSION, type AssessmentMarketInput, type AssessmentContext } from '@/lib/site/assessment';
import type { MarketStanding } from '@/lib/site/match-standing';

// Ortak değerlendirme (assess-1.0, 2026-10-16): üç sinyal → pazar başına kanıt durumu.

const ctx: AssessmentContext = {
  now: '2026-10-17T12:00:00Z', kickoff: '2026-10-17T19:00:00Z', modelVersion: 'dc-1.0',
  evidence: { source: 'signals', from: '2026-06-01T00:00:00Z', to: '2026-10-16T00:00:00Z', decided: 1200 },
};
const rec = (won: number, n: number, kind: 'level' | 'edge' | 'clash' = 'edge', bucket = '+5…+10', scope: 'league' | 'all' = 'all') => ({ n, won, scope, kind, bucket });
const m1x2 = (over: Partial<AssessmentMarketInput> = {}): AssessmentMarketInput => ({
  market: '1x2', selection: '1', modelP: 0.70, calibratedP: 0.74, calibrationAvailable: true, calibrationSegment: 'covered',
  marketP: 0.48, market1x2: { pHome: 0.48, pDraw: 0.27, pAway: 0.25 }, marketOdds: 1.95, marketCapturedAt: '2026-10-17T10:00:00Z', marketPhase: 'h12', marketProvider: 'bet365',
  record: rec(19, 78), ...over,
});

test('wilson: 19/78 excludes 55% and 70%; 18/20 clears 55%; n=0 → null', () => {
  const a = wilson(19, 78)!;
  assert.ok(a.upper < 0.36 && a.lower > 0.16, JSON.stringify(a));
  const b = wilson(18, 20)!;
  assert.ok(b.lower >= 0.69 && b.lower < 0.75, JSON.stringify(b));
  assert.equal(wilson(0, 0), null);
});

test('example from the brief: model 70 / calibrated 74 / market 48 / record 19/78 → conflicting, not a recommendation', () => {
  const a = assessMarket(m1x2(), ctx);
  assert.equal(a.status, 'conflicting');
  assert.deepEqual(a.reasons.slice(0, 2), ['market_above', 'record_contradicts']);
  // kalibre %74 taşınır ama durumu yukarı çekmez; %24 yeni olasılık değil, kayıt
  assert.equal(a.calibration.p, 0.74);
  assert.equal(a.record?.acc, 19 / 78);
  assert.ok(a.record!.upper! < 0.55 && a.record!.upper! < 0.70);
  assert.equal(a.model.p, 0.70);
  assert.equal(a.price.flag, 'over');
  assert.equal(a.ruleVersion, ASSESSMENT_RULE_VERSION);
  assert.equal(a.validation, 'exploratory');
});

test('high calibrated confidence + market disagreement never becomes supported', () => {
  const a = assessMarket(m1x2({ selection: '2', modelP: 0.62, calibratedP: 0.80, marketP: 0.25, market1x2: { pHome: 0.48, pDraw: 0.27, pAway: 0.25 }, record: rec(40, 50) }), ctx);
  assert.equal(a.status, 'conflicting');
  assert.equal(a.reasons[0], 'market_disagrees');
  assert.equal(a.price.flag, 'disagree');
});

test('a small but successful sample is not automatically strong evidence', () => {
  // 9/10 in a goal market: Wilson lower ≈ 0.60 < 0.65 → uncertain → insufficient
  const g = assessMarket({ market: 'ou25', selection: 'over', modelP: 0.68, calibratedP: 0.62, calibrationAvailable: true, marketP: 0.66, record: rec(9, 10, 'level', '60–70%') }, ctx);
  assert.equal(g.status, 'insufficient');
  assert.ok(g.reasons.includes('record_uncertain'));
  // 9/10 in 1X2: lower ≈ 0.60 ≥ 0.55 but n < MIN_SUPPORT_N → still insufficient
  const x = assessMarket(m1x2({ modelP: 0.52, marketP: 0.50, market1x2: { pHome: 0.50, pDraw: 0.27, pAway: 0.23 }, record: rec(9, 10) }), ctx);
  assert.equal(x.status, 'insufficient');
  assert.ok(x.reasons.includes('record_uncertain'));
  assert.equal(MIN_SUPPORT_N, 20);
  // 18/20 with an agreeing market → supported
  const s = assessMarket(m1x2({ modelP: 0.52, marketP: 0.50, market1x2: { pHome: 0.50, pDraw: 0.27, pAway: 0.23 }, record: rec(18, 20) }), ctx);
  assert.equal(s.status, 'supported');
  assert.equal(s.reasons[0], 'record_supports');
  // fewer than 10 → thin, insufficient (not a failure signal)
  const t = assessMarket(m1x2({ modelP: 0.52, marketP: 0.50, market1x2: { pHome: 0.50, pDraw: 0.27, pAway: 0.23 }, record: rec(6, 7) }), ctx);
  assert.equal(t.status, 'insufficient');
  assert.equal(t.reasons[0], 'record_thin');
});

test('no calibration curve → the raw figure is never labelled calibrated', () => {
  const a = assessMarket(m1x2({ calibratedP: 0.70, calibrationAvailable: false }), ctx);
  assert.equal(a.calibration.p, null);
  assert.equal(a.calibration.available, false);
  assert.ok(a.reasons.includes('calibration_missing'));
  // satırdan girdi: confidenceCalibrated=false iken confidence taşınmaz
  const inputs = inputsFor({ pick: '1', pHome: 0.6, pDraw: 0.25, pAway: 0.15, confidence: 0.6, confidenceCalibrated: false, calibrationSegment: null, overUnder: null, btts: null }, [], null);
  assert.equal(inputs[0].calibratedP, null);
  assert.equal(inputs[0].calibrationAvailable, false);
});

test('missing market data does not reject the market by itself; stale market is flagged', () => {
  const a = assessMarket(m1x2({ marketP: null, market1x2: null, marketOdds: null, marketCapturedAt: null, modelP: 0.58, record: rec(30, 40, 'level', '50–60%') }), ctx);
  assert.equal(a.status, 'supported');
  assert.ok(a.reasons.includes('market_missing'));
  assert.equal(a.price.p, null); assert.equal(a.price.flag, null); assert.equal(a.price.stale, false);
  const s = assessMarket(m1x2({ marketCapturedAt: '2026-10-15T09:00:00Z', modelP: 0.50, marketP: 0.50, market1x2: { pHome: 0.50, pDraw: 0.27, pAway: 0.23 }, record: rec(30, 40) }), ctx);
  assert.equal(s.price.stale, true);
  assert.ok(s.reasons.includes('market_stale'));
  assert.equal(s.status, 'supported'); // bayatlık tek başına durumu değiştirmez, gerekçeye girer
});

test('tight market can never be supported, even with a strong record', () => {
  const a = assessMarket(m1x2({ modelP: 0.44, marketP: 0.42, market1x2: { pHome: 0.42, pDraw: 0.30, pAway: 0.28 }, record: rec(30, 40) }), ctx);
  assert.equal(a.status, 'insufficient');
  assert.equal(a.reasons[0], 'market_tight');
});

test('goal markets: blended flip (raw < 50%) is a disagreement; raw ≥5 pts above market is "above"', () => {
  const flip = assessMarket({ market: 'btts', selection: 'no', modelP: 0.45, calibratedP: null, calibrationAvailable: false, marketP: 0.58, record: rec(70, 100, 'level', '50–60%') }, ctx);
  assert.equal(flip.status, 'conflicting'); assert.equal(flip.reasons[0], 'market_disagrees');
  const above = assessMarket({ market: 'ou25', selection: 'over', modelP: 0.72, calibratedP: 0.66, calibrationAvailable: true, marketP: 0.60, record: rec(80, 100, 'level', '≥70%') }, ctx);
  assert.equal(above.status, 'conflicting'); assert.equal(above.reasons[0], 'market_above');
  const fine = assessMarket({ market: 'ou25', selection: 'over', modelP: 0.68, calibratedP: 0.66, calibrationAvailable: true, marketP: 0.66, record: rec(80, 100, 'level', '60–70%') }, ctx);
  assert.equal(fine.status, 'supported');
});

test('markets are independent: a 1X2 conflict does not change the BTTS assessment', () => {
  const standing: MarketStanding[] = [
    { market: '1x2', selection: '1', modelP: 0.70, primary: { kind: 'edge', bucket: '>+10', league: null, all: { n: 44, won: 9, acc: 9 / 44 } }, secondary: null, acc: 9 / 44, n: 44, won: 9, scope: 'all', verdict: 'weak' },
    { market: 'btts', selection: 'yes', modelP: 0.64, primary: { kind: 'level', bucket: '60–70%', league: null, all: { n: 104, won: 80, acc: 80 / 104 } }, secondary: null, acc: 80 / 104, n: 104, won: 80, scope: 'all', verdict: 'strong' }, // alt sınır ≈ %68
  ];
  const row = { pick: '1' as const, pHome: 0.70, pDraw: 0.18, pAway: 0.12, confidence: 0.74, confidenceCalibrated: true, calibrationSegment: 'covered', overUnder: null, btts: { pick: 'yes' as const, pRaw: 0.64, pMarket: 0.62, blended: true, calibrated: true, pCal: 0.61 } };
  const snap = { pHome: 0.48, pDraw: 0.27, pAway: 0.25, homeOdds: 1.95, drawOdds: 3.5, awayOdds: 3.8, capturedAt: '2026-10-17T10:00:00Z', phase: 'h12', provider: 'bet365' };
  const a = assessMatch(inputsFor(row, standing, snap), ctx);
  assert.equal(marketOf(a, '1x2')!.status, 'conflicting');
  assert.equal(marketOf(a, 'btts')!.status, 'supported');
  assert.equal(marketOf(a, 'ou25'), null);
  // aynı girdi → aynı çıktı (ekranlar arası tutarlılık)
  assert.deepEqual(assessMatch(inputsFor(row, standing, snap), ctx), a);
  // 1X2 oranı gol pazarına zaman/faz olarak taşınmaz (uydurma yok)
  assert.equal(marketOf(a, 'btts')!.price.capturedAt, null);
  assert.equal(marketOf(a, 'btts')!.price.p, 0.62);
});

test('priority is deterministic: flags beat record, record contradiction beats support, tight beats support', () => {
  const both = assessMarket(m1x2({ record: rec(30, 40) }), ctx); // +22 fark + güçlü kayıt
  assert.equal(both.status, 'conflicting'); assert.equal(both.reasons[0], 'market_above');
  const contra = assessMarket(m1x2({ modelP: 0.60, marketP: 0.58, market1x2: { pHome: 0.58, pDraw: 0.24, pAway: 0.18 }, record: rec(10, 60) }), ctx);
  assert.equal(contra.status, 'conflicting'); assert.equal(contra.reasons[0], 'record_contradicts');
  const none = assessMarket(m1x2({ modelP: 0.60, marketP: 0.58, market1x2: { pHome: 0.58, pDraw: 0.24, pAway: 0.18 }, record: null }), ctx);
  assert.equal(none.status, 'insufficient'); assert.equal(none.reasons[0], 'record_missing');
});
