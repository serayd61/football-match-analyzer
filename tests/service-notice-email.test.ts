import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceNoticeEmail } from '@/lib/email';

test('service notice apologises for 25–28 November without naming the cause', () => {
  const m = buildServiceNoticeEmail({ unsubscribeUrl: 'https://example.test/u', name: 'Ada' });
  assert.match(m.subject, /25–28 November/);
  for (const body of [m.html, m.text]) {
    assert.match(body, /Hi Ada,/);
    assert.match(body, /sorry for the disruption/);
    assert.match(body, /example\.test\/u/);
    assert.doesNotMatch(body, /quota|rapidapi|rate limit/i);
  }
  assert.match(buildServiceNoticeEmail({ unsubscribeUrl: 'https://example.test/u' }).text, /^Hi,/);
});
