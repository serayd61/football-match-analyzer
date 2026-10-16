import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inSnapshotWindow, toSnapshotRows, snapshotKey, settleSnapshots, SNAPSHOT_TABLE, type StoredSnapshot } from '@/lib/site/assessment-snapshot-rule';
import { assessMatch, type AssessmentMarketInput, type AssessmentContext } from '@/lib/site/assessment';

// Gölge kayıt (2026-10-16): tek maç öncesi snapshot, eklemeli, sonuç sızıntısız.

const KO = '2026-10-17T19:00:00Z';
const subject = { fixtureId: 77, kickoff: KO, leagueId: 47, leagueSlug: 'premier-league', covered: true, homeName: 'Arsenal', awayName: 'Chelsea' };
const inputs: AssessmentMarketInput[] = [
  { market: '1x2', selection: '1', modelP: 0.70, calibratedP: 0.74, calibrationAvailable: true, marketP: 0.48, market1x2: { pHome: 0.48, pDraw: 0.27, pAway: 0.25 }, marketOdds: 1.95, marketCapturedAt: '2026-10-17T15:00:00Z', marketPhase: 'h3', marketProvider: 'bet365', record: { n: 78, won: 19, scope: 'all', kind: 'edge', bucket: '>+10' } },
  { market: 'ou25', selection: 'over', modelP: 0.66, calibratedP: 0.62, calibrationAvailable: true, marketP: 0.64, record: { n: 45, won: 36, scope: 'league', kind: 'level', bucket: '60–70%' } }, // Wilson alt sınır ≈ %66 ≥ %65
  { market: 'btts', selection: 'yes', modelP: 0.60, calibratedP: null, calibrationAvailable: false, marketP: null, record: { n: 6, won: 5, scope: 'all', kind: 'level', bucket: '60–70%' } },
];
const ctxAt = (now: string): AssessmentContext => ({ now, kickoff: KO, modelVersion: 'dc-1.0', evidence: { source: 'signals', from: '2026-06-01T00:00:00Z', to: '2026-10-16T00:00:00Z', decided: 1200 } });

test('snapshot window is the freeze window: (0, 180] minutes before kick-off only', () => {
  const ko = Date.parse(KO);
  assert.equal(inSnapshotWindow(KO, ko - 181 * 60_000), false); // open → henüz yazma
  assert.equal(inSnapshotWindow(KO, ko - 180 * 60_000), true);
  assert.equal(inSnapshotWindow(KO, ko - 5 * 60_000), true);
  assert.equal(inSnapshotWindow(KO, ko), false);                 // başlamış → yazma yok
  assert.equal(inSnapshotWindow(KO, ko + 60_000), false);
});

test('every assessed market is recorded (all statuses), with no outcome fields', () => {
  const a = assessMatch(inputs, ctxAt('2026-10-17T16:30:00Z'));
  const rows = toSnapshotRows(a, subject);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.status), ['conflicting', 'supported', 'insufficient']);
  for (const r of rows) {
    const keys = Object.keys(r);
    for (const bad of ['home_score', 'away_score', 'won', 'correct', 'result', 'outcome', 'settled']) assert.ok(!keys.includes(bad), bad);
    assert.equal(r.assessed_at, '2026-10-17T16:30:00Z');
    assert.equal(r.kickoff, KO);
    assert.equal(r.rule_version, 'assess-1.0');
    assert.equal(r.model_version, 'dc-1.0');
  }
  // o anda kullanılan girdiler: gerçek oran + kaynak zamanı + kanıt sayıları
  assert.equal(rows[0].market_odds, 1.95); assert.equal(rows[0].market_captured_at, '2026-10-17T15:00:00Z');
  assert.equal(rows[0].record_n, 78); assert.equal(rows[0].record_won, 19);
  assert.equal(rows[2].calibration_available, false); assert.equal(rows[2].calibrated_p, null); assert.equal(rows[2].market_p, null);
  assert.deepEqual(rows[0].reasons, ['market_above', 'record_contradicts']);
});

test('an assessment made at or after kick-off never becomes a pre-match record', () => {
  assert.deepEqual(toSnapshotRows(assessMatch(inputs, ctxAt(KO)), subject), []);
  assert.deepEqual(toSnapshotRows(assessMatch(inputs, ctxAt('2026-10-17T21:00:00Z')), subject), []);
});

test('repeated runs map to the same key, so the first write wins and later ones are ignored', () => {
  const first = toSnapshotRows(assessMatch(inputs, ctxAt('2026-10-17T16:30:00Z')), subject);
  // ikinci tur: piyasa oynadı, kayıt büyüdü — anahtar aynı kalır
  const later = toSnapshotRows(assessMatch(inputs.map((i) => ({ ...i, marketP: i.marketP == null ? null : i.marketP + 0.05 })), ctxAt('2026-10-17T17:30:00Z')), subject);
  assert.deepEqual(first.map(snapshotKey), later.map(snapshotKey));
  assert.deepEqual(first.map(snapshotKey), ['77:1x2:assess-1.0', '77:ou25:assess-1.0', '77:btts:assess-1.0']);
});

test('settlement is read later from scores; pending rows stay, nothing is dropped by outcome', () => {
  const rows: StoredSnapshot[] = [
    { fixtureId: 1, market: '1x2', selection: '1', status: 'supported', kickoff: KO, ruleVersion: 'assess-1.0' },
    { fixtureId: 1, market: 'ou25', selection: 'over', status: 'conflicting', kickoff: KO, ruleVersion: 'assess-1.0' },
    { fixtureId: 2, market: 'btts', selection: 'yes', status: 'insufficient', kickoff: KO, ruleVersion: 'assess-1.0' },
    { fixtureId: 3, market: '1x2', selection: '2', status: 'supported', kickoff: KO, ruleVersion: 'assess-1.0' },
  ];
  const rec = settleSnapshots(rows, new Map([[1, [2, 0]], [2, [1, 1]]]));
  assert.equal(rec.exploratory, true);
  assert.deepEqual(rec.byStatus.supported, { n: 1, won: 1, pending: 1 });
  assert.deepEqual(rec.byStatus.conflicting, { n: 1, won: 0, pending: 0 });
  assert.deepEqual(rec.byStatus.insufficient, { n: 1, won: 1, pending: 0 });
  assert.deepEqual(rec.total, { n: 3, won: 2, pending: 1 });
  assert.deepEqual(rec.byStatusMarket.supported['1x2'], { n: 1, won: 1, pending: 1 });
});

test('migration: additive, immutable, unique per (fixture, market, rule) and pre-kick-off only', () => {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '20261016020000_site_assessment_snapshots.sql'), 'utf8');
  assert.match(sql, new RegExp(`create table if not exists public\\.${SNAPSHOT_TABLE}`));
  assert.match(sql, /unique \(fixture_id, market, rule_version\)/);
  assert.match(sql, /check \(assessed_at < kickoff\)/);
  assert.match(sql, /before update or delete on public\.site_assessment_snapshots/);
  assert.doesNotMatch(sql, /home_score|away_score|\bresult\b|\bcorrect\b/);
});
