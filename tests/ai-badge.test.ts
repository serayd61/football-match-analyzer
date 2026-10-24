import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AiBadge from '@/components/site/AiBadge';

(globalThis as unknown as { React: typeof React }).React = React;

// Liste rozeti (24 Eki): ajanların ortak kararı varsa rozet "karar" etiketi taşır, yoksa sade "AI".
test('AiBadge: karar yoksa sade AI rozeti', () => {
  const html = renderToStaticMarkup(createElement(AiBadge, { label: 'Yapay zeka görüşü hazır' }));
  assert.ok(html.includes('data-testid="ai-badge"'));
  assert.ok(!html.includes('Ajan kararı var'));
});

test('AiBadge: karar varsa etiket ve ayrı testid', () => {
  const html = renderToStaticMarkup(createElement(AiBadge, { label: 'Yapay zeka görüşü hazır', verdict: true, verdictLabel: 'Ajan kararı var' }));
  assert.ok(html.includes('data-testid="ai-badge-verdict"'));
  assert.ok(html.includes('Ajan kararı var'));
  assert.ok(html.includes('aria-label="Ajan kararı var"'));
});
