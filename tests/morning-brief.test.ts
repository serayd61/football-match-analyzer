import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMorningBrief, briefSubject, briefCampaignKey, marketLabel, SAMPLE_BRIEF_INPUT, type BriefInput } from '@/lib/site/morning-brief';
import { classifyUsers } from '@/lib/site/ops-report';

const urls = { site: 'https://x.io', dashboard: 'https://x.io/dashboard', telegram: 'https://t.me/x', unsubscribe: 'https://x.io/u', play: 'https://play' };
const base: BriefInput = { name: 'Ada', viewed: [], clubs: [], pick: null, trialDaysLeft: 3, urls };
const viewed = { fixtureId: 11, homeName: 'Arsenal', awayName: 'Chelsea', homeScore: 2, awayScore: 1, leagueName: 'Premier League', pick: '1' as const, confidence: 0.58, outcome: 'won' as const };
const club = { teamId: 5, teamName: 'Galatasaray', fixtureId: 22, homeName: 'Galatasaray', awayName: 'Fenerbahçe', kickoff: '2026-11-02T17:00:00Z', leagueName: 'Süper Lig', hasModel: true, pick: '1' as const, confidence: 0.52 };
const pick = { fixtureId: 33, homeName: 'Bayern', awayName: 'Dortmund', market: 'ou25', selection: 'over', modelP: 0.71, odds: 1.55, kickoff: '2026-11-02T19:30:00Z' };

test('kişisel içerik yoksa mail yok — günün seçimi tek başına yetmez', () => {
  assert.equal(buildMorningBrief(base), null);
  assert.equal(buildMorningBrief({ ...base, pick }), null);
});

test('dün bakılan maç: skor, model çağrısı ve sonuç; konu satırı sonucu söyler', () => {
  const b = buildMorningBrief({ ...base, viewed: [viewed] });
  assert.ok(b);
  assert.equal(b.subject, "Arsenal 2–1 Chelsea — the model's call hit");
  assert.match(b.text, /Arsenal 2-1 Chelsea \(Premier League\) · model call: Arsenal 58% · hit · https:\/\/x\.io\/predictions\/11/);
  assert.match(b.body, /2–1/);
  assert.match(b.text, /Trial: 3 day\(s\) left/);
  assert.match(b.text, /Unsubscribe: https:\/\/x\.io\/u/);
  const lost = buildMorningBrief({ ...base, viewed: [{ ...viewed, outcome: 'lost', homeScore: 0, awayScore: 3 }] });
  assert.equal(lost?.subject, "Arsenal 0–3 Chelsea — the model's call missed");
  const flat = buildMorningBrief({ ...base, viewed: [{ ...viewed, outcome: 'nopick', pick: null }] });
  assert.equal(flat?.subject, 'Arsenal 2–1 Chelsea — result inside');
  assert.match(flat!.text, /model call: no favourite · no call/);
});

test('takımın bugün oynuyor: konu takım adıyla; iki parça varsa ikisi de konuda', () => {
  const only = buildMorningBrief({ ...base, clubs: [club], pick, trialDaysLeft: null });
  assert.equal(only?.subject, "Galatasaray play today — the model's view");
  assert.match(only!.text, /Galatasaray - Fenerbahçe \(Süper Lig, 17:00 UTC\) · Model: Galatasaray 52%/);
  assert.match(only!.text, /TODAY'S PICK: Bayern - Dortmund \(19:30 UTC\) · Over 2.5 goals · model 71% · odds 1.55/);
  assert.doesNotMatch(only!.text, /Trial:/);
  const both = buildMorningBrief({ ...base, viewed: [viewed], clubs: [club] });
  assert.equal(both?.subject, "Galatasaray play today · yesterday's Arsenal–Chelsea ended 2–1");
  assert.equal(both?.title, 'Your result, your club');
  const noModel = buildMorningBrief({ ...base, clubs: [{ ...club, hasModel: false, pick: null, confidence: null }] });
  assert.match(noModel!.text, /Model view publishes closer to kick-off/);
});

test('HTML kaçışı ve yardımcılar', () => {
  const b = buildMorningBrief({ ...base, name: '<b>', viewed: [{ ...viewed, homeName: 'A&B' }] });
  assert.match(b!.body, /Hi &lt;b&gt;/);
  assert.match(b!.body, /A&amp;B/);
  assert.equal(briefSubject({ ...base, viewed: [viewed, { ...viewed, fixtureId: 12 }] }), "Arsenal 2–1 Chelsea — the model's call hit (+1 more)");
  assert.equal(briefCampaignKey('2026-11-02'), 'morning-brief-2026-11-02');
  assert.equal(marketLabel('btts', 'yes'), 'Both teams to score · Yes');
  assert.equal(marketLabel('ou25', 'under'), 'Under 2.5 goals');
  assert.ok(buildMorningBrief({ ...SAMPLE_BRIEF_INPUT, urls }));
});

test('classifyUsers: deneme / ödeyen / bitmiş sınıfları ve id', () => {
  const now = Date.parse('2026-11-02T07:00:00Z');
  const d = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const rows = classifyUsers({
    users: [
      { id: 'a', email: 'Trial@x.io', name: 'T', createdAt: d(2) },
      { id: 'b', email: 'ended@x.io', createdAt: d(9) },
      { id: 'c', email: 'paid@x.io', createdAt: d(30) },
    ],
    profiles: [{ email: 'paid@x.io', subscriptionStatus: 'active', subscriptionEnd: '2099-01-01T00:00:00Z' }],
    subs: [],
  }, now);
  const by = Object.fromEntries(rows.map((r) => [r.email, r]));
  assert.equal(by['trial@x.io'].access, 'trial');
  assert.equal(by['trial@x.io'].id, 'a');
  assert.equal(Math.round((by['trial@x.io'].endMs - now) / 86_400_000), 5);
  assert.equal(by['ended@x.io'].access, 'expired');
  assert.equal(by['paid@x.io'].access, 'paid');
});
