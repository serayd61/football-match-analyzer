import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiMarketCode, aiSelCode, agentsShort, toAiListFlag } from '@/lib/site/ai-list';

// Satır altı AI özeti (24 Eki): unified_analysis JSON yollarından yerelden bağımsız kodlara.
test('ai-list: üretimdeki pazar/seçim değerleri kodlanır', () => {
  assert.equal(aiMarketCode('Over/Under 2.5'), 'ou25');
  assert.equal(aiMarketCode('OU'), 'ou25');
  assert.equal(aiMarketCode('MS'), 'x12');
  assert.equal(aiMarketCode('1X2'), 'x12');
  assert.equal(aiMarketCode('BTTS'), 'btts');
  assert.equal(aiMarketCode('corners'), null);
  assert.equal(aiSelCode('ou25', 'Over'), 'over');
  assert.equal(aiSelCode('ou25', 'Under'), 'under');
  assert.equal(aiSelCode('x12', '1'), '1');
  assert.equal(aiSelCode('x12', 'Away'), '2');
  assert.equal(aiSelCode('x12', 'X'), 'X');
  assert.equal(aiSelCode('btts', 'Yes'), 'yes');
  assert.equal(aiSelCode('btts', 'maybe'), null);
});

test('ai-list: uzlaşı metni kısa orana iner', () => {
  assert.equal(agentsShort('2/3 ajan aynı fikirde'), '2/3');
  assert.equal(agentsShort('3 / 3 agents agree'), '3/3');
  assert.equal(agentsShort('tek ajan'), null);
  assert.equal(agentsShort(null), null);
});

test('ai-list: satır → bayrak (karar var)', () => {
  const f = toAiListFlag({ b_market: 'Over/Under 2.5', b_sel: 'Over', b_conf: '69.3', v_market: 'OU', v_sel: 'Over', v_conf: 79, v_agents: '2/3 ajan aynı fikirde' });
  assert.equal(f.verdict, true);
  assert.deepEqual(f.pick, { market: 'ou25', sel: 'over', conf: 69 });
  assert.deepEqual(f.agent, { market: 'ou25', sel: 'over', conf: 79, agents: '2/3' });
});

test('ai-list: karar yok → verdict false, agent null; bestBet yine okunur', () => {
  const f = toAiListFlag({ b_market: 'Over/Under 2.5', b_sel: 'Under', b_conf: 61, v_market: null, v_sel: null, v_conf: null, v_agents: null });
  assert.equal(f.verdict, false);
  assert.equal(f.agent, null);
  assert.deepEqual(f.pick, { market: 'ou25', sel: 'under', conf: 61 });
});

test('ai-list: tanınmayan pazar → pick null, satır çökmez', () => {
  const f = toAiListFlag({ b_market: 'Corners', b_sel: 'Over 9.5', b_conf: 55 });
  assert.equal(f.pick, null);
  assert.equal(f.agent, null);
  assert.equal(f.verdict, false);
});
