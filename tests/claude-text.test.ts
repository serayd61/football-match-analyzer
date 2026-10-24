import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeText, CLAUDE_NO_THINKING } from '@/lib/ai/claude-text';

// Claude 5.x: ilk blok `thinking` olabilir; metin tipine göre toplanmalı (24 Eki 2026 canlı hata).
test('claudeText: thinking bloğunu atlar, text bloklarını birleştirir', () => {
  assert.equal(claudeText({ content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: 'A' }, { type: 'text', text: 'B' }] }), 'AB');
  assert.equal(claudeText({ content: [{ type: 'text', text: 'tek' }] }), 'tek');
});

test('claudeText: metin yoksa / bozuk girdi → null', () => {
  assert.equal(claudeText({ content: [{ type: 'thinking', thinking: 'x' }] }), null);
  assert.equal(claudeText({ content: [] }), null);
  assert.equal(claudeText({ content: [{ type: 'text', text: '' }] }), null);
  assert.equal(claudeText({}), null);
  assert.equal(claudeText(null), null);
  assert.equal(claudeText('str'), null);
});

test('CLAUDE_NO_THINKING gövdeye yayılır', () => {
  const body = { model: 'claude-haiku-5-5', ...CLAUDE_NO_THINKING, max_tokens: 10 };
  assert.deepEqual(body.thinking, { type: 'disabled' });
});
