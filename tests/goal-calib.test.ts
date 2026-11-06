import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteCurveApplies, calibSinceOf } from '@/lib/site/goal-calib';

// Motor Platt kalibrasyonu açıldıktan sonra yazılan satıra site eğrisi uygulanmaz (2026-11-06).
test('siteCurveApplies: calib_since yoksa her zaman; varsa yalnız önce yazılan satırlara', () => {
  assert.equal(siteCurveApplies('2026-11-05T10:00:00Z', null), true);
  assert.equal(siteCurveApplies('2026-11-05T10:00:00Z', '2026-11-07T00:00:00Z'), true);   // önce yazıldı → eğri
  assert.equal(siteCurveApplies('2026-11-07T05:00:00Z', '2026-11-07T00:00:00Z'), false);  // sonra yazıldı → motor kalibre
  assert.equal(siteCurveApplies(null, '2026-11-07T00:00:00Z'), true);                      // yazım anı bilinmiyor → güvenli taraf
  assert.equal(siteCurveApplies('2026-11-07T05:00:00Z', 'bozuk'), true);
});

test('calibSinceOf: calib + geçerli calib_since ister', () => {
  assert.equal(calibSinceOf(null), null);
  assert.equal(calibSinceOf({ rho: -0.1 }), null);
  assert.equal(calibSinceOf({ calib: { btts: [0.176, 0.36] } }), null);                    // tarih yok → eski davranış
  assert.equal(calibSinceOf({ calib: { btts: [0.176, 0.36] }, calib_since: '2026-11-07T00:00:00Z' }), '2026-11-07T00:00:00Z');
  assert.equal(calibSinceOf({ calib: { btts: [0.176, 0.36] }, calib_since: 'x' }), null);
});
