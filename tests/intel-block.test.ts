import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntelBlock, type IntelLabels } from '@/components/site/Assessment';
import { toIntelView, fmtPts } from '@/lib/site/intel-view';

// İstihbarat satırı sunucu bileşeni: giriş gerektiren maç sayfası yerine statik render ile doğrulanır.
// tsconfig jsx=preserve (Next); tsx klasik dönüşümle derler ve bileşen render'da global React arar.
(globalThis as unknown as { React: typeof React }).React = React;

const view = toIntelView({
  fixture_id: 5795478, agent_version: 'intel-1.0', model_version: 'dc-1.0', llm_model: 'claude-haiku-5-5',
  analyzed_at: '2026-10-16T16:45:33+00:00', issued_after_kickoff: false,
  baseline: { home: 0.40, draw: 0.26, away: 0.34, over25: 0.61, btts: 0.64 },
  final: { home: 0.42, draw: 0.26, away: 0.32 },
  goals: { over25: 0.615, btts: 0.641, adjusted: true },
  deviations: [{ factor: 'Reece James (RB, kaptan) diz ameliyatı: kesin yok', category: 'key_absence', team: 'away', shift: { home: 0.02, draw: 0, away: -0.02 }, source: 'https://www.evertonfc.com/news/x', asOf: '2026-10-16' }],
  confidence: 'medium', data_completeness: 0.65, warnings: [],
})!;

const labels: IntelLabels = {
  title: 'İstihbarat', badge: 'Claude ile kontrol edildi', checkedAt: '16 Eki 19:45',
  lead: 'Kadro haberleri tarandı.', noFactors: 'İsimli etken bulunmadı.',
  probLine: 'Model %40 / %26 / %34 → istihbarat sonrası %42 / %26 / %32', goalsLine: 'Üst 2,5 %61 → %62 · KG Var %64 → %64',
  team: { home: 'Everton', away: 'Chelsea', both: 'iki takım' },
  category: { key_absence: 'kilit eksik', multiple_absences: 'çoklu eksik', rotation: 'rotasyon', tactical_mismatch: 'taktik', travel_congestion: 'seyahat', weather_pitch: 'hava', motivation: 'motivasyon', other: 'diğer' },
  shift: (f) => `Everton ${fmtPts(f.shiftPts.home)} · X ${fmtPts(f.shiftPts.draw)} · Chelsea ${fmtPts(f.shiftPts.away)} puan`,
  source: 'Kaynak:', asOf: (iso) => `${iso} itibarıyla`, note: 'Bu satır durumu değiştirmez.',
};

test('IntelBlock: rozet, faktör, kaydırma, kaynak bağlantısı ve olasılık satırı render edilir; serbest metin yok', () => {
  const html = renderToStaticMarkup(createElement(IntelBlock, { intel: view, labels }));
  assert.ok(html.includes('Claude ile kontrol edildi'));
  assert.ok(html.includes('tag-claude'));
  assert.ok(html.includes('<svg'), 'Claude işareti rozetin içinde');
  assert.ok(html.includes('Reece James (RB, kaptan) diz ameliyatı: kesin yok'));
  assert.ok(html.includes('kilit eksik'));
  assert.ok(html.includes('Chelsea'));
  assert.ok(html.includes('Everton +2 · X 0 · Chelsea −2 puan'));
  assert.ok(html.includes('href="https://www.evertonfc.com/news/x"'));
  assert.ok(html.includes('rel="noopener noreferrer nofollow"'));
  assert.ok(html.includes('evertonfc.com'));
  assert.ok(html.includes('Model %40 / %26 / %34 → istihbarat sonrası %42 / %26 / %32'));
  assert.ok(html.includes('Üst 2,5 %61 → %62'));
  assert.ok(html.includes('Bu satır durumu değiştirmez.'));
  assert.ok(!html.includes('İsimli etken bulunmadı.'));
});

test('IntelBlock: sapma yoksa "etken bulunmadı" metni, olasılık satırı yok', () => {
  const empty = { ...view, factors: [], changed: false, goals: { over25: null, btts: null, adjusted: false } };
  const html = renderToStaticMarkup(createElement(IntelBlock, { intel: empty, labels: { ...labels, goalsLine: null } }));
  assert.ok(html.includes('İsimli etken bulunmadı.'));
  assert.ok(!html.includes('istihbarat sonrası'));
});

test('AssessmentCard: istihbarat bloğu pazar listesinden ÖNCE gelir (sayfanın altında kalmasın)', async () => {
  const { default: AssessmentCard } = await import('@/components/site/Assessment');
  const assessment = { version: 'assess-1.0', markets: [{ market: '1x2', selection: 'home', status: 'insufficient', model: { p: 0.75 }, price: { p: null }, calibration: { available: false, p: null }, record: null, reasons: [] }] } as unknown as Parameters<typeof AssessmentCard>[0]['assessment'];
  const al = {
    title: 'Değerlendirme', lead: 'lead', market: { '1x2': '1X2', ou25: 'Ü/A', btts: 'KG' }, selection: () => 'Ev', status: { supported: 'd', conflicting: 'ç', insufficient: 'y' },
    model: 'MODEL', marketCol: 'PİYASA', recordCol: 'KAYIT', calibrated: () => 'k', rawOnly: 'r', noMarket: 'yok', marketSub: () => null, recordSub: () => null,
    reason: () => 'sebep', notes: () => [], noRecord: 'kayıt yok', thinRecord: () => 'ince', footer: 'footer',
  } as unknown as Parameters<typeof AssessmentCard>[0]['labels'];
  const html = renderToStaticMarkup(createElement(AssessmentCard, { assessment, labels: al, intel: view, intelLabels: labels }));
  const iIntel = html.indexOf('data-testid="intel-block"');
  const iMarkets = html.indexOf('>1X2<');
  assert.ok(iIntel > 0 && iMarkets > 0);
  assert.ok(iIntel < iMarkets, `intel (${iIntel}) pazarlardan (${iMarkets}) önce olmalı`);
});
