import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidence, eligibleRows, similarMatches, rateOf, SIMILARITY, OWN_THIN_N, EVIDENCE_RULE_VERSION, type PoolRow, type EvidenceTarget } from '@/lib/site/evidence-rule';
import { assessMatch, type AssessmentMarketInput, type AssessmentContext, type MatchAssessment } from '@/lib/site/assessment';

// Geçmiş kanıt analizi (evidence-1.0, 2026-10-16): deterministik gruplar, asOf sınırı, örtüşme.

const ASOF = '2026-10-17T12:00:00.000Z';
const KICKOFF = '2026-10-17T18:00:00.000Z';

/** Sentetik havuz — gerçek maç sonucu DEĞİL. Seed'li LCG ile üretilir (deterministik).
 *  İlk `cluster` oranı (varsayılan yarısı) verilen λ'nın hemen çevresinde, kalanı geniş dağılır:
 *  z-ölçekli yarıçap havuzun kendi yayılımına göre olduğu için "yakın" küme ancak böyle oluşur. */
function synthPool(n: number, opts: { leagueId?: number; homeId?: number; awayId?: number; lh?: number; la?: number; daysAgoFrom?: number; result?: 'H' | 'D' | 'A' | null; cluster?: number } = {}): PoolRow[] {
  let s = 42;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const rows: PoolRow[] = [];
  const near = Math.round(n * (opts.cluster ?? 0.5));
  for (let i = 0; i < n; i++) {
    const spread = i < near ? 0.1 : 1.6;
    const lh = (opts.lh ?? 1.5) + (rnd() - 0.5) * spread;
    const la = (opts.la ?? 1.2) + (rnd() - 0.5) * spread;
    const ko = new Date(Date.parse(ASOF) - ((opts.daysAgoFrom ?? 2) + i) * 86_400_000).toISOString();
    const r = opts.result ?? (['H', 'D', 'A'] as const)[Math.floor(rnd() * 3)];
    const [hs, as] = r === 'H' ? [2, 0] : r === 'A' ? [0, 2] : [1, 1];
    rows.push({
      fixtureId: 1000 + i, leagueId: opts.leagueId ?? 57, homeId: opts.homeId ?? 500 + i, awayId: opts.awayId ?? 700 + i,
      homeName: `H${i}`, awayName: `A${i}`, kickoff: ko, settledAt: new Date(Date.parse(ko) + 2 * 3_600_000).toISOString(),
      pHome: 0.45, pDraw: 0.25, pAway: 0.30, pOver25: 0.55, pBtts: 0.5, lambdaHome: Math.max(0.2, lh), lambdaAway: Math.max(0.2, la), homeScore: hs, awayScore: as,
    });
  }
  return rows;
}

const target: EvidenceTarget = {
  fixtureId: 5781774, leagueId: 57, homeId: 6414, awayId: 10235, homeName: 'Telstar', awayName: 'Feyenoord', kickoff: KICKOFF,
  pHome: 0.14, pDraw: 0.21, pAway: 0.65, pOver25: 0.61, pBtts: 0.56, lambdaHome: 0.95, lambdaAway: 2.22,
  pick: '2', overPick: 'over', bttsPick: 'yes', modelVersion: 'dc-1.0', featuresAt: '2026-10-16T04:00:00.000Z',
};

const ctx: AssessmentContext = { now: ASOF, kickoff: KICKOFF, modelVersion: 'dc-1.0', evidence: { source: 'signals', from: null, to: null, decided: 500 } };
const assessmentWith = (over: Partial<AssessmentMarketInput> = {}): MatchAssessment => assessMatch([{
  market: '1x2', selection: '2', modelP: 0.65, calibratedP: null, calibrationAvailable: false, calibrationSegment: null,
  marketP: null, market1x2: null, marketOdds: null, marketCapturedAt: null, marketPhase: null, marketProvider: null, record: null, ...over,
}], ctx);

test('asOf: başlamamış, pencere dışı ve asOf\'ta sonucu bilinmeyen maçlar havuza girmez; maçın kendisi dışlanır', () => {
  const pool = synthPool(5);
  pool.push({ ...pool[0], fixtureId: 1, kickoff: '2026-10-17T13:00:00.000Z', settledAt: '2026-10-17T15:00:00.000Z' });      // asOf'tan sonra başlar
  pool.push({ ...pool[0], fixtureId: 2, kickoff: '2026-10-17T10:00:00.000Z', settledAt: '2026-10-17T13:00:00.000Z' });      // başladı ama sonucu asOf'ta yok
  pool.push({ ...pool[0], fixtureId: 3, kickoff: '2026-10-17T08:00:00.000Z', settledAt: null });                            // settledAt yok → kickoff+3s = 11:00 ≤ asOf → girer
  pool.push({ ...pool[0], fixtureId: 4, kickoff: '2025-01-01T12:00:00.000Z', settledAt: '2025-01-01T15:00:00.000Z' });      // 365 gün penceresi dışı
  pool.push({ ...pool[0], fixtureId: target.fixtureId, kickoff: '2026-10-10T12:00:00.000Z' });                             // maçın kendisi (sahte geçmiş satır)
  const ids = eligibleRows(pool, target, ASOF).map((r) => r.fixtureId).sort((a, b) => a - b);
  assert.deepEqual(ids, [3, 1000, 1001, 1002, 1003, 1004]);
});

test('benzer maçlar: komşunun özellikleri kendi maç-öncesi λ\'sıdır, uzaklık z-ölçekli, sıralama deterministik', () => {
  const pool = synthPool(400, { lh: 0.95, la: 2.22 });
  const sim = similarMatches(eligibleRows(pool, target, ASOF), target)!;
  assert.ok(sim.n >= SIMILARITY.minN, `n=${sim.n}`);
  assert.ok(sim.n <= SIMILARITY.k);
  for (let i = 1; i < sim.fixtures.length; i++) assert.ok(sim.fixtures[i - 1].distance! <= sim.fixtures[i].distance!);
  for (const f of sim.fixtures) {
    const src = pool.find((r) => r.fixtureId === f.fixtureId)!;
    assert.equal(f.lambdaHome, src.lambdaHome); assert.equal(f.lambdaAway, src.lambdaAway);
    assert.notEqual(f.fixtureId, target.fixtureId);
    assert.ok(f.distance! <= SIMILARITY.radius);
  }
  assert.equal(sim.scope, 'league');
});

test('lig kapsamında yarıçap içinde yeterli aday yoksa tüm liglere düşer ve bunu söyler', () => {
  const pool = [...synthPool(10, { leagueId: 57, lh: 0.95, la: 2.22 }), ...synthPool(300, { leagueId: 47, lh: 0.95, la: 2.22 }).map((r, i) => ({ ...r, fixtureId: 5000 + i }))];
  const rep = buildEvidence({ target, pool, assessment: null, asOf: ASOF });
  assert.equal(rep.groups.similar?.scope, 'all');
  assert.ok(rep.missing.some((m) => m.key === 'league_scope' && m.reason === 'fallback_all'));
});

test('kapsam sırası: lig yetersizse kapsanan ligler, o da yetersizse tüm ligler', () => {
  const pool = [...synthPool(6, { leagueId: 57, lh: 0.95, la: 2.22 }), ...synthPool(80, { leagueId: 47, lh: 0.95, la: 2.22 }).map((r, i) => ({ ...r, fixtureId: 5000 + i })), ...synthPool(80, { leagueId: 999, lh: 0.95, la: 2.22 }).map((r, i) => ({ ...r, fixtureId: 7000 + i }))];
  const cov = buildEvidence({ target, pool, assessment: null, asOf: ASOF, coveredLeagueIds: new Set([47, 57]) });
  assert.equal(cov.groups.similar?.scope, 'covered');
  assert.ok(cov.groups.similar!.fixtures.every((f) => f.fixtureId < 7000), 'kapsam dışı lig komşuya girmez');
  assert.ok(cov.missing.some((m) => m.key === 'league_scope' && m.reason === 'fallback_covered'));
  const all = buildEvidence({ target, pool, assessment: null, asOf: ASOF, coveredLeagueIds: new Set([57]) });
  assert.equal(all.groups.similar?.scope, 'all');
});

test('küçük örneklem güçlü kanıt değildir: benzer maç < 20 → similar_insufficient, oran yok; xG/Elo her zaman "hesaplanamıyor"', () => {
  const pool = synthPool(8, { lh: 0.95, la: 2.22 });
  const rep = buildEvidence({ target, pool, assessment: null, asOf: ASOF });
  const m = rep.markets.find((x) => x.market === '1x2')!;
  assert.equal(m.rates.similar, null);
  assert.ok(m.findings.includes('similar_insufficient'));
  assert.ok(rep.missing.some((x) => x.key === 'similar' && x.reason === 'insufficient'));
  assert.ok(rep.missing.some((x) => x.key === 'xg' && x.reason === 'not_live'));
  assert.ok(rep.missing.some((x) => x.key === 'elo' && x.reason === 'no_history'));
  assert.ok(!('xg' in rep.features) && !('elo' in rep.features), 'xG/Elo için sayı uydurulmaz');
});

test('takımın kendi geçmişi: 10 maçın altı ince; oran gösterilmez, bulgu own_*_thin', () => {
  const pool = [...synthPool(5, { homeId: target.homeId!, result: 'H' }), ...synthPool(12, { awayId: target.awayId!, result: 'A' }).map((r, i) => ({ ...r, fixtureId: 2000 + i }))];
  const rep = buildEvidence({ target, pool, assessment: null, asOf: ASOF });
  const m = rep.markets.find((x) => x.market === '1x2')!;
  assert.equal(rep.groups.homeAtHome?.n, 5);
  assert.equal(m.rates.homeAtHome, null);
  assert.ok(m.findings.includes('own_home_thin'));
  assert.equal(rep.groups.awayAtAway?.n, 12);
  assert.ok(rep.groups.awayAtAway!.n >= OWN_THIN_N);
  assert.equal(m.rates.awayAtAway?.won, 12);
  assert.ok(m.rates.awayAtAway!.lower < 1 && m.rates.awayAtAway!.lower > 0.7, 'Wilson alt sınırı 12/12 için 1 değil');
});

test('örtüşen gruplar bağımsız örnek sayılmaz: kesişim raporlanır, gruplar ayrı tutulur', () => {
  // Deplasmanın dış saha maçları, hedefe λ olarak da benzer → benzer kümeye de girer.
  const pool = synthPool(60, { awayId: target.awayId!, lh: 0.95, la: 2.22 });
  const rep = buildEvidence({ target, pool, assessment: null, asOf: ASOF });
  assert.ok(rep.overlap.awaySimilar > 0);
  const m = rep.markets.find((x) => x.market === '1x2')!;
  assert.ok(m.rates.similar && m.rates.awayAtAway);
  assert.ok(m.rates.similar!.n + m.rates.awayAtAway!.n > 60, 'iki grup ayrı sayılır; toplanmış tek n yok');
  assert.ok(!('combined' in m.rates));
});

test('kalibrasyon yoksa calibratedP null ve calibration_missing bulgusu; eğri varsa değer taşınır', () => {
  const pool = synthPool(80, { lh: 0.95, la: 2.22 });
  const raw = buildEvidence({ target, pool, assessment: assessmentWith(), asOf: ASOF }).markets[0];
  assert.equal(raw.calibratedP, null); assert.equal(raw.calibrationAvailable, false);
  assert.ok(raw.findings.includes('calibration_missing'));
  const cal = buildEvidence({ target, pool, assessment: assessmentWith({ calibratedP: 0.61, calibrationAvailable: true, calibrationSegment: 'covered' }), asOf: ASOF }).markets[0];
  assert.equal(cal.calibratedP, 0.61);
  assert.ok(!cal.findings.includes('calibration_missing'));
});

test('model–piyasa çelişkisi gerekçeli çıkar; durum assess-1.0\'dan olduğu gibi taşınır (burada değişmez)', () => {
  const pool = synthPool(80, { lh: 0.95, la: 2.22 });
  const a = assessmentWith({ marketP: 0.48, market1x2: { pHome: 0.27, pDraw: 0.25, pAway: 0.48 }, marketOdds: 2.05, marketCapturedAt: '2026-10-17T10:00:00.000Z', marketPhase: 'h12', marketProvider: 'x' });
  const m = buildEvidence({ target, pool, assessment: a, asOf: ASOF }).markets[0];
  assert.equal(m.status, a.markets[0].status);
  assert.equal(m.status, 'conflicting');
  assert.ok(m.findings.includes('market_above'));
  assert.equal(m.marketP, 0.48);
});

test('piyasa anlık görüntüsü asOf\'tan sonraysa karşılaştırmaya girmez (market_after_asof)', () => {
  const pool = synthPool(80, { lh: 0.95, la: 2.22 });
  const a = assessmentWith({ marketP: 0.48, market1x2: { pHome: 0.27, pDraw: 0.25, pAway: 0.48 }, marketOdds: 2.05, marketCapturedAt: '2026-10-17T13:00:00.000Z', marketPhase: 'h6', marketProvider: 'x' });
  const m = buildEvidence({ target, pool, assessment: a, asOf: ASOF }).markets[0];
  assert.equal(m.marketP, null);
  assert.ok(m.findings.includes('market_after_asof'));
});

test('hedefin özellikleri asOf\'tan sonra yazıldıysa işaretlenir', () => {
  const pool = synthPool(30);
  const rep = buildEvidence({ target: { ...target, featuresAt: '2026-10-17T13:00:00.000Z' }, pool, assessment: null, asOf: ASOF });
  assert.equal(rep.features.afterAsOf, true);
  assert.equal(buildEvidence({ target, pool, assessment: null, asOf: ASOF }).features.afterAsOf, false);
});

test('aynı girdi aynı sayısal raporu üretir (zaman damgası yok)', () => {
  const pool = synthPool(200, { lh: 0.95, la: 2.22 });
  const a = buildEvidence({ target, pool, assessment: assessmentWith(), asOf: ASOF });
  const b = buildEvidence({ target, pool: [...pool].reverse(), assessment: assessmentWith(), asOf: ASOF });
  assert.deepEqual(a, b);
  assert.equal(a.ruleVersion, EVIDENCE_RULE_VERSION);
  assert.equal(a.validation, 'exploratory');
});

test('benzer maç oranı modelin kendi p\'siyle karşılaştırılır: Wilson aralığı içindeyse uyuşur, altındaysa similar_below', () => {
  const agree = buildEvidence({ target, pool: synthPool(120, { lh: 0.95, la: 2.22, result: 'A' }).map((r, i) => (i % 3 === 0 ? { ...r, homeScore: 1, awayScore: 1 } : r)), assessment: null, asOf: ASOF }).markets[0];
  assert.ok(agree.rates.similar && agree.rates.similar.p > 0.6 && agree.rates.similar.p < 0.7);
  assert.ok(agree.findings.includes('similar_agrees'));
  const below = buildEvidence({ target, pool: synthPool(120, { lh: 0.95, la: 2.22, result: 'H' }), assessment: null, asOf: ASOF }).markets[0];
  assert.ok(below.findings.includes('similar_below'));
  assert.equal(rateOf([], '2'), null);
});
