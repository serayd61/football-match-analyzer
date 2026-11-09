import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRecoveryRecipients, type RecoverySession } from '@/lib/site/checkout-recovery';

const t0 = Math.floor(Date.parse('2026-10-20T10:00:00Z') / 1000);
const s = (email: string | null, status: string, paymentStatus: string, daysLater = 0): RecoverySession =>
  ({ email, status, paymentStatus, created: t0 + daysLater * 86_400 });

test('unpaid expired/open sessions become recipients, most attempts first; paid and completed are excluded', () => {
  const sessions = [
    s('a@x.io', 'expired', 'unpaid', 0),
    s('a@x.io', 'expired', 'unpaid', 3),
    s('a@x.io', 'open', 'unpaid', 5),
    s('b@x.io', 'expired', 'unpaid', 1),
    s('c@x.io', 'expired', 'unpaid', 0),
    s('c@x.io', 'complete', 'paid', 2),          // later paid → out
    s('D@x.io', 'open', 'unpaid', 4),            // case-folded
    s(null, 'expired', 'unpaid', 1),             // no email
    s('e@x.io', 'complete', 'no_payment_required', 1),
  ];
  const out = selectRecoveryRecipients(sessions);
  assert.deepEqual(out.map((r) => [r.email, r.attempts]), [['a@x.io', 3], ['d@x.io', 1], ['b@x.io', 1]]);
  assert.equal(out[0].lastAttempt, '2026-10-25T10:00:00.000Z');
});

test('onlyExpired: open sessions are ignored — someone mid-checkout gets no mail', () => {
  const sessions = [
    s('a@x.io', 'expired', 'unpaid', 0),
    s('a@x.io', 'open', 'unpaid', 1),    // sayılmaz ama expired'ı var → alıcı
    s('b@x.io', 'open', 'unpaid', 1),    // yalnız open → alıcı DEĞİL
    s('c@x.io', 'expired', 'unpaid', 0),
    s('c@x.io', 'complete', 'paid', 1),  // sonra ödedi → hariç
  ];
  const out = selectRecoveryRecipients(sessions, { onlyExpired: true });
  assert.deepEqual(out.map((r) => [r.email, r.attempts]), [['a@x.io', 1]]);
});

test('unsubscribed, already sent, subscribed and admin addresses are skipped', () => {
  const sessions = [s('a@x.io', 'expired', 'unpaid'), s('b@x.io', 'expired', 'unpaid'), s('c@x.io', 'expired', 'unpaid'), s('admin@x.io', 'expired', 'unpaid')];
  const out = selectRecoveryRecipients(sessions, {
    unsubscribed: new Set(['a@x.io']), alreadySent: new Set(['b@x.io']), subscribed: new Set(['c@x.io']), exclude: new Set(['admin@x.io']),
  });
  assert.deepEqual(out, []);
});
