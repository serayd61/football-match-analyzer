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
  assert.deepEqual(parseFilters({ status: 'hacked', sort: 'x', ready: 'true', q: '  ajax  ' }), { q: 'ajax', status: 'all', ready: false, sort: 'time', market: null, minP: null });
  assert.deepEqual(parseFilters({ status: 'live', sort: 'confidence', ready: '1' }), { q: '', status: 'live', ready: true, sort: 'confidence', market: null, minP: null });
});

test('market threshold filters on the model probability of that market and sorts by it', () => {
  const g = (over: number, yes: number, pick: '1' | '2' = '1', pHome = 0.5, pAway = 0.3) =>
    ({ overUnder: { pick: over >= 0.5 ? 'over' : 'under', pRaw: over >= 0.5 ? over : 1 - over }, btts: { pick: yes >= 0.5 ? 'yes' : 'no', pRaw: yes >= 0.5 ? yes : 1 - yes }, pick, pHome, pDraw: 0.2, pAway }) as Partial<SitePrediction>;
  const rs = [row('A', 'B', g(0.72, 0.55)), row('C', 'D', g(0.41, 0.66)), row('E', 'F', g(0.63, 0.61, '2', 0.2, 0.65)), row('G', 'H', { hasModel: false } as Partial<SitePrediction>)];
  assert.deepEqual(applyFilters(rs, { market: 'ou25', minP: 60 }).map((r) => r.homeName), ['A', 'E']);
  assert.deepEqual(applyFilters(rs, { market: 'btts', minP: 60 }).map((r) => r.homeName), ['C', 'E']);
  assert.deepEqual(applyFilters(rs, { market: 'x12', minP: 60 }).map((r) => r.homeName), ['E']);
  assert.deepEqual(parseFilters({ market: 'ou25' }).minP, 60);
  assert.deepEqual(parseFilters({ market: 'ou25', minp: '75' }).minP, 75);
  assert.deepEqual(parseFilters({ market: 'nope', minp: '75' }).market, null);
});
