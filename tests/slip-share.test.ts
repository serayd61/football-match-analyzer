import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSlip, decodeSlip, sharePath, type SharedLeg } from '@/lib/site/slip-share';
import { MAX_LEGS } from '@/lib/site/slip-rule';

// Kupon paylaşım kodu (slip-1.3, 2026-10-17).

const legs: SharedLeg[] = [
  { fixtureId: 5103665, market: '1x2', selection: '1', p: 0.72, odds: 1.9 },
  { fixtureId: 5103665, market: 'ou25', selection: 'over', p: 0.7, odds: null },
  { fixtureId: 5976925, market: 'ah', selection: 'away', line: -0.75, p: 0.56, odds: 2.05 },
  { fixtureId: 5976925, market: 'dnb', selection: 'home', p: 0.73, odds: null },
  { fixtureId: 5781774, market: 'btts', selection: 'no', p: 0.44, odds: 1.8 },
];

test('kodla → çöz aynı bacakları verir; kod yalnız güvenli karakterlerden oluşur', () => {
  const code = encodeSlip(legs);
  assert.equal(code, 'v1~5103665_m1_p72_o1.90~5103665_oo_p70~5976925_ha_l-0.75_p56_o2.05~5976925_dh_p73~5781774_bn_p44_o1.80');
  assert.match(code, /^[0-9A-Za-z._~-]+$/);
  assert.deepEqual(decodeSlip(code), legs);
  assert.equal(sharePath('tr', legs.slice(0, 1)), '/tr/s/v1~5103665_m1_p72_o1.90');
});

test('bozuk / eski sürüm / geçersiz bacak güvenle süzülür', () => {
  assert.deepEqual(decodeSlip(null), []);
  assert.deepEqual(decodeSlip('v0~5103665_m1_p72'), []);
  assert.deepEqual(decodeSlip('v1~<script>'), []);
  assert.deepEqual(decodeSlip('v1~abc_m1_p72'), []);
  assert.deepEqual(decodeSlip('v1~5103665_mz_p72'), []);
  assert.deepEqual(decodeSlip('v1~5103665_oo'), []); // olasılık yok
  assert.deepEqual(decodeSlip('v1~5103665_hh_p50'), []); // handikapta çizgi yok
  assert.deepEqual(decodeSlip('v1~5103665_hh_l-0.3_p50'), []); // çizgi 0,25 katı değil
  assert.deepEqual(decodeSlip('v1~5103665_m1_l0.5_p72'), [{ fixtureId: 5103665, market: '1x2', selection: '1', p: 0.72, odds: null }]); // 1x2'de çizgi atılır
  assert.deepEqual(decodeSlip('v1~5103665_m1_p72_o0.90'), [{ fixtureId: 5103665, market: '1x2', selection: '1', p: 0.72, odds: null }]); // oran ≤ 1 → yok
  // aynı maç+pazar iki kez → ilki
  assert.equal(decodeSlip('v1~5103665_m1_p72~5103665_m2_p11~5103665_oo_p70').length, 2);
  // en çok MAX_LEGS
  const many = Array.from({ length: MAX_LEGS + 3 }, (_, i) => `${1000 + i}_m1_p50`).join('~');
  assert.equal(decodeSlip(`v1~${many}`).length, MAX_LEGS);
});
