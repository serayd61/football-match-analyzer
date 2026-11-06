import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeague, evaluateLeague, isProposalEligibleName, bucketOf, hideDecision, strongMarkets, wilsonLower, STRONG_GATE, HOLDOUT_DAYS, COVERAGE_GATE } from '@/lib/coverage/rules';

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

test('strongMarkets (2026-11-06): n ≥ 40, Wilson alt sınır ≥ 62%, son 30 gün doğrulaması; KG bölgesi yok', () => {
  assert.equal(STRONG_GATE.minN, 40); assert.equal(STRONG_GATE.minLower, 0.62);
  // Eski Isthmian örneği: KG 17/24 = %71 artık güçlü DEĞİL (KG bölgesi kaldırıldı, n < 40)
  const old = { x12: { '70–80': { n: 4, won: 2 }, '≥80': { n: 8, won: 2 } }, ou25: { '75–85': { n: 16, won: 9 }, '≥85': { n: 10, won: 7 } }, under25: {}, btts: { '70–80': { n: 17, won: 11 }, '≥80': { n: 7, won: 6 } } };
  assert.deepEqual(strongMarkets(old), []);
  // Üst 2,5: 45/60 = %75 → Wilson alt sınır ≈ 0,627 ≥ 0,62 → güçlü; 40/60 = %67 → alt sınır ≈ 0,54 → değil
  const ou = (won: number, n: number) => ({ x12: {}, ou25: { '75–85': { n, won } }, under25: {}, btts: { '70–80': { n: 80, won: 70 } } });
  assert.deepEqual(strongMarkets(ou(45, 60)).map((m) => m.market), ['ou25']);
  assert.ok(strongMarkets(ou(45, 60))[0].lower! >= 0.62);
  assert.deepEqual(strongMarkets(ou(40, 60)), []);
  assert.deepEqual(strongMarkets(ou(30, 39)), []);                       // n < 40
  // Yürüyen doğrulama: son 30 günde 12 maçta 5 → %42 → düşer; 12 maçta 8 → kalır; yakın dönem verisi yoksa atlanır
  const recent = (won: number, n: number) => ({ x12: {}, ou25: { '75–85': { n, won } }, under25: {}, btts: {} });
  assert.deepEqual(strongMarkets(ou(45, 60), STRONG_GATE, recent(5, 12)), []);
  assert.equal(strongMarkets(ou(45, 60), STRONG_GATE, recent(8, 12))[0].recent!.won, 8);
  assert.deepEqual(strongMarkets(ou(45, 60), STRONG_GATE, recent(4, 5)), []);  // holdout n < 10 → güçlü sayılmaz
  assert.equal(strongMarkets(ou(45, 60), STRONG_GATE, { x12: {}, ou25: {}, under25: {}, btts: {} }).length, 0);
  assert.equal(strongMarkets(ou(45, 60), STRONG_GATE, undefined).length, 1);
});

test('wilsonLower: %95 alt sınır; küçük örneklemde sert ceza', () => {
  assert.equal(wilsonLower(0, 0), 0);
  assert.ok(Math.abs(wilsonLower(70, 100) - 0.604) < 0.005);
  assert.ok(Math.abs(wilsonLower(14, 20) - 0.481) < 0.005);           // 20 maçta %70 → alt sınır %48
  assert.ok(wilsonLower(140, 200) > wilsonLower(14, 20));
});

test('aggregateLeague: son HOLDOUT_DAYS gün recentBuckets\'a ayrıca yazılır ve strong buna bakar', () => {
  assert.equal(HOLDOUT_DAYS, 30);
  const row = (daysAgo: number, pOver: number, tot: number) => ({ p_over25: pOver, p_btts_yes: null, home_score: tot, away_score: 0, correct: null, ll_1x2: null, kickoff: new Date(Date.parse('2026-11-06T12:00:00Z') - daysAgo * 86400e3).toISOString() });
  // 50 eski maç (%80 tutar) + 12 yakın maç (%42 tutar): pencere boyu %73, Wilson ≥ 0,62, ama yakın dönem düşük → güçlü değil
  const rows = [...Array.from({ length: 50 }, (_, i) => row(60 + i, 0.8, i % 5 === 0 ? 2 : 3)), ...Array.from({ length: 12 }, (_, i) => row(i, 0.8, i < 5 ? 3 : 2))];
  const s = aggregateLeague(rows, 180);
  assert.equal(s.recentBuckets!.ou25['75–85'].n, 12);
  assert.equal(s.buckets!.ou25['75–85'].n, 62);
  assert.deepEqual(s.strong, []);
  // yakın dönem de tutarsa güçlü
  const good = [...rows.slice(0, 50), ...Array.from({ length: 12 }, (_, i) => row(i, 0.8, i < 10 ? 3 : 2))];
  assert.equal(aggregateLeague(good, 180).strong!.length, 1);
});

test('strongMarkets (eski örnek yorumu): KG 17/24 artık güçlü değil', () => {
  const b = { x12: { '70–80': { n: 4, won: 2 }, '≥80': { n: 8, won: 2 } }, ou25: { '75–85': { n: 16, won: 9 }, '≥85': { n: 10, won: 7 } }, under25: {}, btts: { '70–80': { n: 17, won: 11 }, '≥80': { n: 7, won: 6 } } };
  assert.deepEqual(strongMarkets(b), []);
  assert.deepEqual(strongMarkets(undefined), []);
  const st = (status: any, strong: any[]) => hideDecision(status, { n: 63, x12: { n: 63, won: 25, ll: 1.2989 }, ouHi: { n: 0, won: 0 }, bttsHi: { n: 0, won: 0 }, strong, lastKickoff: null, windowDays: 180 });
  // Güçlü pazar gizlemeyi engeller / kaldırır; artık ancak yeni kapıyı geçen pazar
  const strongOu = strongMarkets({ x12: {}, ou25: { '75–85': { n: 60, won: 45 } }, under25: {}, btts: {} });
  assert.equal(st('excluded', strongOu), null);
  assert.equal(st('hidden', strongOu), 'unhide');
  assert.equal(st('excluded', strongMarkets(b)), 'hide');   // KG 17/24 artık korumaz
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

// 17 Eki eleme kuralı: uzak ülke / alt kademe / kadın-genç / yerel eleme turu sitede görünmez
test('pruneReason hides far countries, low tiers, women/youth and qualifiers but keeps bookmaker leagues', () => {
  const { pruneReason } = require('@/lib/coverage/rules') as typeof import('@/lib/coverage/rules');
  assert.ok(pruneReason('Ligue 1', 'ALG'));                       // Cezayir
  assert.ok(pruneReason('Premier League', 'TAN'));
  assert.ok(pruneReason('Regionalliga West', 'GER'));             // Almanya 4. lig
  assert.ok(pruneReason('Segunda Federacion - Group 1', 'ESP'));
  assert.ok(pruneReason('Isthmian Premier Division', 'ENG'));
  assert.ok(pruneReason('3. Divisjon Avd. 4', 'NOR'));
  assert.ok(pruneReason('Premier League U18', 'ENG'));
  assert.ok(pruneReason("Women's Premier Division", 'IRL'));
  assert.ok(pruneReason('Toppserien', 'NOR'));
  assert.ok(pruneReason('FA Cup Qualification', 'ENG'));
  assert.ok(pruneReason('CAF Confederation Cup', 'INT'));
  assert.ok(pruneReason('AFC Challenge League Grp. A', 'INT-2'));
  // kalanlar
  assert.equal(pruneReason('3. Liga', 'GER'), null);
  assert.equal(pruneReason('2. Liga', 'AUT'), null);
  assert.equal(pruneReason('Serie C Grp. A', 'ITA'), null);
  assert.equal(pruneReason('Premier League', 'ENG'), null);
  assert.equal(pruneReason('Champions League Qualification', 'INT-2'), null); // Avrupa elemeleri kalır
  assert.equal(pruneReason('Champions League', 'INT-2'), null);
  assert.equal(pruneReason('Eliteserien', 'NOR'), null);
  assert.equal(pruneReason('Saudi Pro League', 'KSA'), null);
  assert.equal(pruneReason('', 'ALG'), null);
});
