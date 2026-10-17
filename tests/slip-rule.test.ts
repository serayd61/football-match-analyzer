import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleLeg, removeLeg, hasLeg, slipTotals, legHit, slipStatus, parseStoredSlip, serializeSlip, slipText, MAX_LEGS, type SlipLeg } from '@/lib/site/slip-rule';

// Kuponum (slip-1.0, 2026-10-17): kullanıcı kuponu kuralı.

const NOW = Date.parse('2026-10-17T12:00:00Z');
const leg = (over: Partial<SlipLeg> = {}): SlipLeg => ({
  fixtureId: 5781774, kickoff: '2026-10-17T18:00:00.000Z', leagueLabel: 'Eredivisie', homeName: 'Telstar', awayName: 'Feyenoord',
  market: '1x2', selection: '2', p: 0.65, odds: 1.55, addedAt: '2026-10-17T11:00:00.000Z', ...over,
});

test('ekle / aynı seçimi tekrar ekle (çıkar) / aynı pazarın başka seçimi (değiştir) / aynı maçın başka pazarı (ekle)', () => {
  const a = toggleLeg([], leg(), NOW);
  assert.equal(a.outcome, 'added'); assert.equal(a.legs.length, 1);
  const b = toggleLeg(a.legs, leg(), NOW);
  assert.equal(b.outcome, 'removed'); assert.equal(b.legs.length, 0);
  const c = toggleLeg(a.legs, leg({ selection: '1', p: 0.14 }), NOW);
  assert.equal(c.outcome, 'replaced'); assert.equal(c.legs.length, 1); assert.equal(c.legs[0].selection, '1');
  // slip-1.2: aynı maçtan 1 + Üst 2,5 + KG Var üç ayrı bacak
  const d = toggleLeg(a.legs, leg({ market: 'ou25', selection: 'over', p: 0.61, odds: 1.7 }), NOW);
  assert.equal(d.outcome, 'added'); assert.equal(d.legs.length, 2);
  const e = toggleLeg(d.legs, leg({ market: 'btts', selection: 'yes', p: 0.56, odds: null }), NOW);
  assert.equal(e.outcome, 'added'); assert.equal(e.legs.length, 3);
  assert.ok(hasLeg(e.legs, { fixtureId: 5781774, market: '1x2', selection: '2' }));
  assert.ok(hasLeg(e.legs, { fixtureId: 5781774, market: 'ou25', selection: 'over' }));
  const f = toggleLeg(e.legs, leg({ market: 'ou25', selection: 'under', p: 0.39, odds: 2.1 }), NOW);
  assert.equal(f.outcome, 'replaced'); assert.equal(f.legs.length, 3);
  assert.ok(!hasLeg(f.legs, { fixtureId: 5781774, market: 'ou25', selection: 'over' }));
  assert.equal(slipTotals(f.legs).fixtures, 1);
  assert.equal(removeLeg(f.legs, { fixtureId: 5781774, market: 'btts', selection: 'yes' }).length, 2);
  assert.equal(removeLeg(f.legs, 5781774).length, 0);
});

test('başlamış maç eklenmez; kupon doluysa yeni maç girmez', () => {
  assert.equal(toggleLeg([], leg({ kickoff: '2026-10-17T11:00:00.000Z' }), NOW).outcome, 'started');
  const full = Array.from({ length: MAX_LEGS }, (_, i) => leg({ fixtureId: 100 + i }));
  assert.equal(toggleLeg(full, leg({ fixtureId: 999 }), NOW).outcome, 'full');
  assert.equal(toggleLeg(full, leg({ fixtureId: 100, selection: '1' }), NOW).outcome, 'replaced');
  assert.equal(removeLeg(full, 100).length, MAX_LEGS - 1);
});

test('toplamlar: oran çarpımı yalnız her bacakta oran varsa; olasılık çarpımı; ilk başlama', () => {
  const t = slipTotals([leg({ odds: 1.5, p: 0.6 }), leg({ fixtureId: 2, odds: 2.0, p: 0.5, kickoff: '2026-10-17T15:00:00.000Z' })]);
  assert.equal(t.n, 2); assert.equal(t.totalOdds, 3); assert.equal(t.missingOdds, 0);
  assert.ok(Math.abs(t.jointP - 0.3) < 1e-9); assert.equal(t.firstKickoff, '2026-10-17T15:00:00.000Z');
  const m = slipTotals([leg({ odds: null }), leg({ fixtureId: 2, odds: 2.0 })]);
  assert.equal(m.totalOdds, null); assert.equal(m.missingOdds, 1);
  assert.equal(slipTotals([]).jointP, 0);
});

test('bacak sonucu ve kupon durumu', () => {
  const fin = (h: number, a: number) => ({ homeScore: h, awayScore: a, settled: true, status: 'finished' });
  assert.equal(legHit({ market: '1x2', selection: '2' }, fin(0, 2)), true);
  assert.equal(legHit({ market: '1x2', selection: 'X' }, fin(1, 1)), true);
  assert.equal(legHit({ market: 'ou25', selection: 'over' }, fin(2, 1)), true);
  assert.equal(legHit({ market: 'ou25', selection: 'under' }, fin(2, 1)), false);
  assert.equal(legHit({ market: 'btts', selection: 'yes' }, fin(2, 0)), false);
  assert.equal(legHit({ market: 'btts', selection: 'no' }, fin(2, 0)), true);
  assert.equal(legHit({ market: 'btts', selection: 'no' }, { homeScore: 1, awayScore: 0, settled: false, status: 'started' }), null);
  assert.equal(legHit({ market: '1x2', selection: '1' }, null), null);
  const legs = [leg(), leg({ fixtureId: 2, market: 'ou25', selection: 'over' })];
  assert.equal(slipStatus(legs, {}), 'pending');
  assert.equal(slipStatus(legs, { 5781774: fin(0, 2) }), 'pending');
  assert.equal(slipStatus(legs, { 5781774: fin(0, 2), 2: fin(3, 0) }), 'won');
  assert.equal(slipStatus(legs, { 5781774: fin(2, 0) }), 'lost');
  assert.equal(slipStatus([], {}), 'empty');
});

test('depo okuma: bozuk / eksik / yinelenen / fazla kayıt güvenle süzülür; yazılan geri okunur', () => {
  assert.deepEqual(parseStoredSlip(null), []);
  assert.deepEqual(parseStoredSlip('{bozuk'), []);
  assert.deepEqual(parseStoredSlip(JSON.stringify([{ fixtureId: 1 }])), []);
  assert.deepEqual(parseStoredSlip(JSON.stringify([leg({ market: '1x2', selection: 'over' as any })])), []);
  const dup = parseStoredSlip(JSON.stringify([leg(), leg({ selection: '1' })]));
  assert.equal(dup.length, 1);
  assert.equal(parseStoredSlip(JSON.stringify([leg(), leg({ market: 'ou25', selection: 'over' })])).length, 2);
  const many = parseStoredSlip(JSON.stringify(Array.from({ length: MAX_LEGS + 5 }, (_, i) => leg({ fixtureId: 1 + i }))));
  assert.equal(many.length, MAX_LEGS);
  const legs = [leg(), leg({ fixtureId: 2, odds: null })];
  assert.deepEqual(parseStoredSlip(serializeSlip(legs)), legs);
});

test('paylaşım metni: başlık, bacaklar, toplam oran (varsa), not', () => {
  const txt = slipText([leg(), leg({ fixtureId: 2, market: 'ou25', selection: 'over', odds: 1.7, p: 0.61 })], (l) => (l.market === '1x2' ? l.awayName : 'Üst 2,5'), {
    time: () => '21:00', odds: (o) => o.toFixed(2), pct: (p) => `%${Math.round(p * 100)}`, title: 'Kuponum', total: 'Toplam oran', note: 'not',
  });
  assert.equal(txt, 'Kuponum\n21:00 Telstar – Feyenoord: Feyenoord · %65 · 1.55\n21:00 Telstar – Feyenoord: Üst 2,5 · %61 · 1.70\nToplam oran 2.64\nnot');
  const noOdds = slipText([leg({ odds: null })], () => 'x', { time: () => 't', odds: (o) => String(o), pct: () => 'p', title: 'T', total: 'Toplam', note: 'n' });
  assert.ok(!noOdds.includes('Toplam'));
});

test('slip-1.1: Asya handikapı ve beraberlikte iade sonuçları', async () => {
  const { asianOutcome, legOutcome } = await import('@/lib/site/slip-rule');
  const fin = (h: number, a: number) => ({ homeScore: h, awayScore: a, settled: true, status: 'finished' });
  assert.equal(asianOutcome(2, 1, -0.5), 'won'); assert.equal(asianOutcome(1, 1, -0.5), 'lost');
  assert.equal(asianOutcome(1, 1, 0), 'void'); assert.equal(asianOutcome(2, 1, -1), 'void');
  assert.equal(asianOutcome(2, 1, -0.75), 'half_won'); assert.equal(asianOutcome(2, 1, -1.25), 'half_lost');
  assert.equal(asianOutcome(2, 1, -0.25), 'won'); assert.equal(asianOutcome(1, 1, -0.25), 'half_lost'); assert.equal(asianOutcome(1, 1, 0.25), 'half_won');
  assert.equal(asianOutcome(3, 1, -1.75), 'half_won');
  assert.equal(legOutcome({ market: 'ah', selection: 'away', line: -0.75 }, fin(2, 1)), 'half_lost');
  assert.equal(legOutcome({ market: 'ah', selection: 'away', line: 0 }, fin(1, 1)), 'void');
  assert.equal(legOutcome({ market: 'dnb', selection: 'home' }, fin(1, 1)), 'void');
  assert.equal(legOutcome({ market: 'dnb', selection: 'away' }, fin(0, 1)), 'won');
  assert.equal(legHit({ market: 'dnb', selection: 'away' }, fin(1, 1)), true);
  assert.equal(slipStatus([leg({ market: 'dnb', selection: 'home' })], { 5781774: fin(1, 1) }), 'won');
  // aynı maçta farklı çizgi = farklı seçim (değiştirir), aynı çizgi = çıkarır
  const a = toggleLeg([], leg({ market: 'ah', selection: 'home', line: -0.5 }), NOW);
  assert.equal(toggleLeg(a.legs, leg({ market: 'ah', selection: 'home', line: -0.75 }), NOW).outcome, 'replaced');
  assert.equal(toggleLeg(a.legs, leg({ market: 'ah', selection: 'home', line: -0.5 }), NOW).outcome, 'removed');
  assert.ok(hasLeg(a.legs, { fixtureId: 5781774, market: 'ah', selection: 'home', line: -0.5 }));
  assert.ok(!hasLeg(a.legs, { fixtureId: 5781774, market: 'ah', selection: 'home', line: -1 }));
  // depo: ah çizgisiz / 1x2 çizgili geçersiz
  assert.deepEqual(parseStoredSlip(JSON.stringify([leg({ market: 'ah', selection: 'home' })])), []);
  assert.deepEqual(parseStoredSlip(JSON.stringify([leg({ line: 0.5 })])), []);
  assert.equal(parseStoredSlip(JSON.stringify([leg({ market: 'ah', selection: 'away', line: 1.25 })])).length, 1);
});
