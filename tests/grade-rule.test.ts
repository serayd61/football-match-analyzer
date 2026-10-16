import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeMatch, weekLessons, preKickoffMarket, toGradeRow, fromGradeRow, MIN_LESSON_N, GRADE_RULE_VERSION, type GradeInput, type MatchGrade } from '@/lib/site/grade-rule';
import { latestPhase } from '@/lib/site/odds-phases';

// Biten maç derece kartı (grade-1.0, 2026-10-16): kim haklıydı + haftalık dersler.

const KO = '2026-10-17T18:00:00.000Z';
const base: GradeInput = {
  fixtureId: 5781774, leagueId: 57, leagueSlug: 'eredivisie', covered: true, homeName: 'Telstar', awayName: 'Feyenoord', kickoff: KO, modelVersion: 'dc-1.0',
  pHome: 0.14, pDraw: 0.21, pAway: 0.65, pick: '2', pOver25: 0.61, overPick: 'over', pBtts: 0.56, bttsPick: 'yes',
  homeScore: 0, awayScore: 2,
  market: { pHome: 0.20, pDraw: 0.25, pAway: 0.55, phase: 'closing', capturedAt: '2026-10-17T16:00:00.000Z', provider: 'x' },
  statuses: [{ market: '1x2', selection: '2', status: 'supported', reasons: ['record_supports'], ruleVersion: 'assess-1.0', assessedAt: '2026-10-17T15:45:00.000Z' }],
};

test('1X2: seçim tuttu, bahisçi favorisiyle aynı (agree), +10 puan üstte → over_edge; durum gölge kayıttan', () => {
  const g = gradeMatch(base).find((x) => x.market === '1x2')!;
  assert.equal(g.hit, true); assert.equal(g.marketFav, '2'); assert.equal(g.clash, 'agree');
  assert.deepEqual(g.codes, ['pick_hit', 'market_fav_hit', 'agree', 'over_edge', 'status_hit']);
  assert.equal(g.status, 'supported'); assert.equal(g.statusSource, 'snapshot'); assert.equal(g.assessmentRuleVersion, 'assess-1.0');
  assert.equal(g.edgeBucket, '>+10'); assert.equal(g.levelBucket, '60–70%');
  assert.equal(g.isoYear, 2026); assert.equal(g.isoWeek, 42);
});

test('ayrışma çözümü: model haklı / bahisçi haklı / ikisi de yanlış', () => {
  const dis = { ...base, market: { ...base.market!, pHome: 0.50, pDraw: 0.25, pAway: 0.25 } };
  assert.equal(gradeMatch(dis)[0].clash, 'model_right');
  assert.ok(gradeMatch(dis)[0].codes.includes('disagree_model_right'));
  assert.equal(gradeMatch({ ...dis, homeScore: 2, awayScore: 0 })[0].clash, 'market_right');
  assert.equal(gradeMatch({ ...dis, homeScore: 1, awayScore: 1 })[0].clash, 'both_wrong');
});

test('gol pazarları: Üst 2,5 ve KG seçimleri sonuçtan; piyasa yok → market_missing', () => {
  const gs = gradeMatch({ ...base, homeScore: 1, awayScore: 2 });
  const ou = gs.find((x) => x.market === 'ou25')!, bt = gs.find((x) => x.market === 'btts')!;
  assert.equal(ou.hit, true); assert.equal(bt.hit, true);
  assert.ok(ou.codes.includes('market_missing')); assert.equal(ou.marketP, null); assert.equal(ou.clash, null);
  const under = gradeMatch({ ...base, overPick: 'under', homeScore: 1, awayScore: 0 }).find((x) => x.market === 'ou25')!;
  assert.equal(under.hit, true); assert.equal(under.modelP, 0.39);
});

test('durum yalnız kickoff ÖNCESİ gölge kayıttan; yoksa statusSource none ve status_missing — geriye dönük üretilmez', () => {
  const none = gradeMatch({ ...base, statuses: [] })[0];
  assert.equal(none.status, null); assert.equal(none.statusSource, 'none'); assert.ok(none.codes.includes('status_missing'));
  const late = gradeMatch({ ...base, statuses: [{ ...base.statuses[0], assessedAt: '2026-10-17T19:00:00.000Z' }] })[0];
  assert.equal(late.statusSource, 'none');
});

test('piyasa: kickoff sonrası yakalanan görüntü yok sayılır, öncesinde en geç faz seçilir', () => {
  const rows = [
    { phase: 'opening', capturedAt: '2026-10-16T04:00:00.000Z', p: 1 },
    { phase: 'h3', capturedAt: '2026-10-17T15:30:00.000Z', p: 2 },
    { phase: 'closing', capturedAt: '2026-10-17T18:30:00.000Z', p: 3 }, // kickoff sonrası
  ];
  const l = preKickoffMarket(rows, KO, (rs) => latestPhase(rs))!;
  assert.equal(l.p, 2);
  assert.equal(preKickoffMarket([rows[2]], KO, (rs) => latestPhase(rs)), null);
});

test('sıkı piyasa (favori < %45) işaretlenir; piyasa yoksa hiçbir piyasa kodu yok', () => {
  const tight = gradeMatch({ ...base, market: { ...base.market!, pHome: 0.34, pDraw: 0.30, pAway: 0.36 } })[0];
  assert.ok(tight.codes.includes('tight_market'));
  const nm = gradeMatch({ ...base, market: null })[0];
  assert.deepEqual(nm.codes, ['pick_hit', 'market_missing', 'status_hit']);
  assert.equal(nm.marketFav, null); assert.equal(nm.edge, null);
});

test('satır dönüşümü kayıpsız (toGradeRow → fromGradeRow)', () => {
  for (const g of gradeMatch(base)) assert.deepEqual(fromGradeRow(toGradeRow(g)), g);
});

/** Sentetik kartlar — gerçek maç DEĞİL. */
function synth(n: number, over: Partial<MatchGrade> & { hitRate?: number } = {}): MatchGrade[] {
  const { hitRate = 0.6, ...rest } = over;
  const out: MatchGrade[] = [];
  for (let i = 0; i < n; i++) {
    const hit = (i % 10) < Math.round(hitRate * 10); // her 10 kartta round(hitRate·10) isabet
    const g = gradeMatch({ ...base, fixtureId: 1000 + i, homeScore: hit ? 0 : 2, awayScore: hit ? 2 : 0, statuses: [] })[0];
    out.push({ ...g, ...rest, hit, codes: rest.codes ?? g.codes });
  }
  return out;
}

test('dersler: küçük örneklem ders üretmez; n ≥ 20 ve Wilson ters sıra → status_order_inverted', () => {
  const wk = { isoYear: 2026, isoWeek: 42 };
  const thin = weekLessons([...synth(5, { status: 'supported', statusSource: 'snapshot', hitRate: 0.2 }), ...synth(5, { status: 'conflicting', statusSource: 'snapshot', hitRate: 0.9 })], wk);
  assert.equal(thin.lessons.length, 0);
  assert.equal(thin.statusCoverage.withSnapshot, 10);
  const inv = weekLessons([...synth(40, { status: 'supported', statusSource: 'snapshot', hitRate: 0.3 }), ...synth(40, { status: 'conflicting', statusSource: 'snapshot', hitRate: 0.8 })], wk);
  assert.ok(inv.lessons.some((l) => l.code === 'status_order_inverted' && l.market === '1x2'));
  const holds = weekLessons([...synth(40, { status: 'supported', statusSource: 'snapshot', hitRate: 0.7 }), ...synth(40, { status: 'conflicting', statusSource: 'snapshot', hitRate: 0.4 })], wk);
  assert.ok(holds.lessons.some((l) => l.code === 'status_order_holds'));
});

test('dersler: durum kovaları yalnız gölge kaydı olan kartlardan; snapshot yoksa byStatus boş', () => {
  const s = weekLessons(synth(50, { statusSource: 'none', status: null }), { isoYear: 2026, isoWeek: 42 });
  assert.deepEqual(s.byStatus, {});
  assert.equal(s.statusCoverage.withSnapshot, 0);
  assert.equal(s.byMarket['1x2'].n, 50);
});

test('dersler: ayrışmalarda bahisçi üstünse disagreements_market_led; seviye kovası aşırı güvenli', () => {
  const wk = { isoYear: 2026, isoWeek: 42 };
  const cards = [...synth(30, { clash: 'market_right', hit: false, hitRate: 0 }), ...synth(5, { clash: 'model_right', hitRate: 1 }).map((g, i) => ({ ...g, fixtureId: 2000 + i }))];
  const s = weekLessons(cards, wk);
  assert.ok(s.lessons.some((l) => l.code === 'disagreements_market_led'));
  const over = weekLessons(synth(40, { levelBucket: '≥70%', hitRate: 0.3 }), wk);
  assert.ok(over.lessons.some((l) => l.code === 'level_overconfident' && l.subject === '≥70%'));
});

test('dersler: varsayılan kapsam kapsanan ligler; kapsam dışı kartlar sayılır ama hücreye girmez', () => {
  const wk = { isoYear: 2026, isoWeek: 42 };
  const cards = [...synth(30), ...synth(10, { covered: false, leagueSlug: null }).map((g, i) => ({ ...g, fixtureId: 4000 + i }))];
  const cov = weekLessons(cards, wk);
  assert.equal(cov.scope, 'covered'); assert.equal(cov.grades, 30); assert.equal(cov.excluded, 10);
  const all = weekLessons(cards, wk, { scope: 'all' });
  assert.equal(all.grades, 40); assert.equal(all.excluded, 0);
});

test('dersler: başka haftanın kartları girmez; aynı girdi aynı çıktı', () => {
  const wk = { isoYear: 2026, isoWeek: 42 };
  const cards = [...synth(30), ...synth(10, { isoWeek: 41 }).map((g, i) => ({ ...g, fixtureId: 3000 + i }))];
  const a = weekLessons(cards, wk), b = weekLessons([...cards].reverse(), wk);
  assert.equal(a.grades, 30);
  assert.deepEqual(a, b);
  assert.equal(a.ruleVersion, GRADE_RULE_VERSION); assert.equal(a.validation, 'exploratory');
  assert.ok(MIN_LESSON_N >= 20);
});
