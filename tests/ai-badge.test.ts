import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AiBadge, { AiDetail } from '@/components/site/AiBadge';

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

// Satır altı özet (24 Eki akşamı): AI en iyi bahis + ajan kararı; ikisi de yoksa boş.
const LABELS = { ai: 'AI', agent: 'Ajan', agents: 'ajan', sel: { '1': 'Ev', X: 'Beraberlik', '2': 'Deplasman', over: 'Üst 2,5', under: 'Alt 2,5', yes: 'KG Var', no: 'KG Yok' } } as const;

test('AiDetail: AI bahsi ve ajan kararı tek satırda', () => {
  const html = renderToStaticMarkup(createElement(AiDetail, { flag: { verdict: true, pick: { market: 'ou25', sel: 'over', conf: 69 }, agent: { market: 'x12', sel: '1', conf: 79, agents: '2/3' } }, labels: LABELS }));
  assert.ok(html.includes('data-testid="ai-detail"'));
  assert.ok(html.includes('Üst 2,5'));
  assert.ok(html.includes('69%')); // varsayılan biçim sonek; TR öneki pct ile gelir
  assert.ok(html.includes('Ev'));
  assert.ok(html.includes('2/3 ajan'));
});

test('AiDetail: yalnız AI bahsi varsa ajan parçası çizilmez', () => {
  const html = renderToStaticMarkup(createElement(AiDetail, { flag: { verdict: false, pick: { market: 'ou25', sel: 'under', conf: 61 }, agent: null }, labels: LABELS }));
  assert.ok(html.includes('Alt 2,5'));
  assert.ok(!html.includes('Ajan'));
});

test('AiDetail: ikisi de yoksa boş', () => {
  const html = renderToStaticMarkup(createElement(AiDetail, { flag: { verdict: false, pick: null, agent: null }, labels: LABELS }));
  assert.equal(html, '');
});

// Yüzde biçimi (31 Eki): varsayılan "62%"; TR satırı pct ile "%62" verir — İngilizce sayfada "%62" sızmaz.
test('AiDetail: yüzde biçimi varsayılan sonek, pct ile önek', () => {
  const flag = { verdict: false, pick: { market: 'ou25', sel: 'over', conf: 62 }, agent: null } as const;
  const en = renderToStaticMarkup(createElement(AiDetail, { flag: flag as any, labels: LABELS }));
  assert.ok(en.includes('62%') && !en.includes('%62'));
  const tr = renderToStaticMarkup(createElement(AiDetail, { flag: flag as any, labels: { ...LABELS, pct: (n: number) => `%${n}` } }));
  assert.ok(tr.includes('%62') && !tr.includes('62%'));
});
