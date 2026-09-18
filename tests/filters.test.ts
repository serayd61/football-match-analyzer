// Denetim 2026-09-18 (B10): liste filtreleri sayfaya bağlı ve Türkçe adlarla çalışmalı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, fold, parseFilters } from '@/lib/site/filters';
import type { SitePrediction } from '@/lib/site/predictions';

const row = (homeName: string, awayName: string, over: Partial<SitePrediction> = {}) =>
  ({ homeName, awayName, status: 'scheduled', hasModel: true, confidence: 0.5, confidenceRaw: 0.5, kickoff: '2026-09-20T18:00:00Z', league: { slug: 'super-lig' }, ...over }) as unknown as SitePrediction;

const rows = [
  row('Beşiktaş', 'İstanbul Başakşehir', { confidence: 0.61 }),
  row('Fenerbahçe', 'Göztepe', { status: 'live', confidence: 0.72 } as Partial<SitePrediction>),
  row('Köln', 'Bayern München', { hasModel: false, confidence: null, confidenceRaw: null } as Partial<SitePrediction>),
];

test('search folds diacritics and Turkish dotted/dotless i', () => {
  assert.equal(fold('İstanbul Başakşehir'), 'istanbul basaksehir');
  assert.deepEqual(applyFilters(rows, { q: 'besiktas' }).map((r) => r.homeName), ['Beşiktaş']);
  assert.deepEqual(applyFilters(rows, { q: 'ISTANBUL' }).map((r) => r.homeName), ['Beşiktaş']);
  assert.deepEqual(applyFilters(rows, { q: 'munchen' }).map((r) => r.homeName), ['Köln']);
});

test('search + status + ready combine', () => {
  assert.deepEqual(applyFilters(rows, { status: 'live' }).map((r) => r.homeName), ['Fenerbahçe']);
  assert.equal(applyFilters(rows, { ready: true }).length, 2);
  assert.equal(applyFilters(rows, { q: 'fener', status: 'upcoming' }).length, 0);
});

test('confidence sort puts unrated rows last', () => {
  assert.deepEqual(applyFilters(rows, { sort: 'confidence' }).map((r) => r.homeName), ['Fenerbahçe', 'Beşiktaş', 'Köln']);
});

test('parseFilters ignores unknown URL values', () => {
  assert.deepEqual(parseFilters({ status: 'hacked', sort: 'x', ready: 'true', q: '  ajax  ' }), { q: 'ajax', status: 'all', ready: false, sort: 'time' });
  assert.deepEqual(parseFilters({ status: 'live', sort: 'confidence', ready: '1' }), { q: '', status: 'live', ready: true, sort: 'confidence' });
});
