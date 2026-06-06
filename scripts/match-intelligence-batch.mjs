#!/usr/bin/env node
// ============================================================================
// Match Intelligence — Hetzner BATCH script
// ----------------------------------------------------------------------------
// Bu script Hetzner sunucusunda (gece, n8n cron) çalışır. Vercel ÇALIŞTIRMAZ
// (Vercel, Ollama'nın localhost'una erişemez). Akış:
//
//   (a) football-data.org → yaklaşan maçlar + takım son maçları (stat)
//   (b) Bright Data / crawl4ai → haber & sakatlık metni topla (opsiyonel)
//   (c) Dolphin → metni dilden BAĞIMSIZ, nötr etiketli news_digest'e ÖZETLE
//   (d) preview_tr / preview_en / preview_de anlatıları üret
//          DE → PREVIEW_DE_PROVIDER'a göre Dolphin | Claude | GPT
//   (e) Supabase'e (service_role) DOĞRUDAN upsert
//
// MİMARİ KURALI: Tahmini LLM YAPMAZ. Sayısal olasılıklar getPrediction()'dan
// gelir (şimdilik Poisson; ileride penaltyblog servisi). Dolphin asla skor
// "uydurmaz" — yalnızca özetler, anlatır, çevirir.
//
// Çalıştırma:  node scripts/match-intelligence-batch.mjs --days 4
// Gerekli env: SUPABASE + FOOTBALL_DATA_API_KEY + OLLAMA_* (aşağıya bak)
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Konfig
// ----------------------------------------------------------------------------
const ENV = process.env;

const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL || ENV.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_API_KEY = ENV.FOOTBALL_DATA_API_KEY;

const OLLAMA_BASE_URL = (ENV.OLLAMA_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, '');
const OLLAMA_MODEL = ENV.OLLAMA_MODEL || 'dolphin3:8b';
const OLLAMA_API_KEY = ENV.OLLAMA_API_KEY || 'ollama';

const PREVIEW_DE_PROVIDER = (ENV.PREVIEW_DE_PROVIDER || 'dolphin').toLowerCase(); // dolphin|claude|gpt
const ANTHROPIC_API_KEY = ENV.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = ENV.OPENAI_API_KEY;

// İleride penaltyblog istatistik servisi: ayarlanırsa getPrediction() buraya POST eder.
const STATS_SERVICE_URL = ENV.STATS_SERVICE_URL || '';

// Hangi ligler (football-data.org yarışma kodları)
const COMPETITIONS = (ENV.MI_COMPETITIONS || 'PL,PD,SA,BL1,FL1,CL').split(',').map(s => s.trim()).filter(Boolean);

const MODEL_VERSION = 'mi-1.0';
const SOURCE = 'match-intelligence-batch/1.0';

const args = process.argv.slice(2);
const DAYS = parseInt(args[args.indexOf('--days') + 1] || ENV.MI_DAYS || '4', 10);
const LIMIT = parseInt(args[args.indexOf('--limit') + 1] || ENV.MI_LIMIT || '40', 10);
const DRY_RUN = args.includes('--dry-run');

function assertEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!FOOTBALL_DATA_API_KEY) missing.push('FOOTBALL_DATA_API_KEY');
  if (missing.length) {
    console.error('❌ Eksik env:', missing.join(', '));
    process.exit(1);
  }
}

const sb = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----------------------------------------------------------------------------
// (a) football-data.org — maçlar & takım statları
// ----------------------------------------------------------------------------
const FD_BASE = 'https://api.football-data.org/v4';
const fdHeaders = { 'X-Auth-Token': FOOTBALL_DATA_API_KEY };

function ymd(d) { return d.toISOString().split('T')[0]; }

async function fetchUpcomingMatches() {
  const from = new Date();
  const to = new Date();
  // football-data.org ücretsiz plan: tarih aralığı max 10 gün → kısıtla.
  const spanDays = Math.min(DAYS, 10);
  to.setDate(to.getDate() + spanDays);
  const url = `${FD_BASE}/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${ymd(from)}&dateTo=${ymd(to)}&status=SCHEDULED,TIMED`;
  const res = await fetch(url, { headers: fdHeaders });
  if (!res.ok) throw new Error(`football-data matches ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.matches || []).slice(0, LIMIT).map(m => ({
    matchId: m.id,
    leagueId: m.competition?.id ?? null,
    leagueName: m.competition?.name ?? null,
    homeId: m.homeTeam?.id ?? null,
    homeName: m.homeTeam?.name ?? null,
    homeCrest: m.homeTeam?.crest ?? null,   // milli takımda = bayrak
    awayId: m.awayTeam?.id ?? null,
    awayName: m.awayTeam?.name ?? null,
    awayCrest: m.awayTeam?.crest ?? null,
    kickoff: m.utcDate ?? null,
  }));
}

// Takımın son N maçından basit gol ortalamaları (Poisson lambda girdileri)
async function fetchTeamAverages(teamId) {
  const fallback = { avgFor: 1.3, avgAgainst: 1.3, played: 0, form: '' };
  if (!teamId) return fallback;
  try {
    const url = `${FD_BASE}/teams/${teamId}/matches?status=FINISHED&limit=8`;
    const res = await fetch(url, { headers: fdHeaders });
    if (!res.ok) return fallback;
    const json = await res.json();
    const matches = json.matches || [];
    if (!matches.length) return fallback;
    let gf = 0, ga = 0, n = 0;
    const form = [];
    for (const m of matches) {
      const isHome = m.homeTeam?.id === teamId;
      const fh = m.score?.fullTime?.home, fa = m.score?.fullTime?.away;
      if (fh == null || fa == null) continue;
      const teamGoals = isHome ? fh : fa;
      const oppGoals = isHome ? fa : fh;
      gf += teamGoals; ga += oppGoals; n++;
      form.push(teamGoals > oppGoals ? 'W' : teamGoals < oppGoals ? 'L' : 'D');
    }
    if (!n) return fallback;
    return { avgFor: gf / n, avgAgainst: ga / n, played: n, form: form.join('') };
  } catch {
    return fallback;
  }
}

// ----------------------------------------------------------------------------
// İSTATİSTİK TAHMİNİ — getPrediction() ARAYÜZÜ
// ⚠️ LLM DEĞİL. Şimdilik Poisson; ileride penaltyblog servisi.
// STATS_SERVICE_URL ayarlanırsa o servise POST atılır (sözleşme: aşağıdaki şema).
// ----------------------------------------------------------------------------
function factorial(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }
function poisson(lambda, k) { return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k); }

function poissonPrediction(homeAvg, awayAvg) {
  // Basit lambda: takım hücumu × rakip savunması, ev avantajı düzeltmesi
  const lambdaHome = Math.max(0.2, ((homeAvg.avgFor + awayAvg.avgAgainst) / 2) * 1.1);
  const lambdaAway = Math.max(0.2, ((awayAvg.avgFor + homeAvg.avgAgainst) / 2) * 0.9);

  let pHome = 0, pDraw = 0, pAway = 0, pOver25 = 0, pBtts = 0;
  const scores = [];
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = poisson(lambdaHome, h) * poisson(lambdaAway, a);
      if (h > a) pHome += p; else if (h < a) pAway += p; else pDraw += p;
      if (h + a > 2.5) pOver25 += p;
      if (h > 0 && a > 0) pBtts += p;
      scores.push({ score: `${h}-${a}`, p });
    }
  }
  scores.sort((x, y) => y.p - x.p);
  const round = (x) => Math.round(x * 1000) / 1000;
  return {
    pHome: round(pHome), pDraw: round(pDraw), pAway: round(pAway),
    pOver25: round(pOver25), pBttsYes: round(pBtts),
    lambdaHome: round(lambdaHome), lambdaAway: round(lambdaAway),
    topScores: scores.slice(0, 3).map(s => ({ score: s.score, p: round(s.p) })),
    source: 'poisson-1.0',
  };
}

async function getPrediction(match, homeAvg, awayAvg) {
  // İleride: penaltyblog tabanlı servis. Sözleşme: { homeAvg, awayAvg, match } → stats_prediction
  if (STATS_SERVICE_URL) {
    try {
      const res = await fetch(STATS_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match, homeAvg, awayAvg }),
      });
      if (res.ok) return await res.json();
      console.warn(`⚠️ STATS_SERVICE_URL ${res.status} — Poisson'a düşülüyor`);
    } catch (e) {
      console.warn('⚠️ STATS_SERVICE_URL erişilemedi — Poisson:', e.message);
    }
  }
  return poissonPrediction(homeAvg, awayAvg);
}

// ----------------------------------------------------------------------------
// (b) Bright Data / crawl4ai — haber & sakatlık metni
// ⚠️ Dış entegrasyon noktası. Ayarlı değilse boş döner (digest atlanır).
//     Mevcut repo deseni: Bright Data MCP / crawl4ai. Buraya kendi
//     toplama çağrını koy; çıktı düz metin olmalı (dilden bağımsız işlenecek).
// ----------------------------------------------------------------------------
async function collectNewsText(match) {
  const endpoint = ENV.NEWS_CRAWL_URL; // örn. crawl4ai / Bright Data toplayıcı
  if (!endpoint) return '';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home: match.homeName, away: match.awayName, league: match.leagueName }),
    });
    if (!res.ok) return '';
    const json = await res.json();
    return (json.text || json.content || '').toString().slice(0, 6000);
  } catch {
    return '';
  }
}

// ----------------------------------------------------------------------------
// LLM yardımcıları
// ----------------------------------------------------------------------------
const OLLAMA_TIMEOUT_MS = parseInt(ENV.OLLAMA_TIMEOUT_MS || '180000', 10); // CPU-only → cömert

async function callDolphin(messages, { temperature = 0.4, maxTokens = 900, timeout = OLLAMA_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OLLAMA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!res.ok) { console.warn('⚠️ Dolphin', res.status); return null; }
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('⚠️ Dolphin hata:', e.message);
    return null;
  } finally { clearTimeout(t); }
}

async function callClaudeFrontier(system, user, { maxTokens = 700 } = {}) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.content?.[0]?.text || null;
  } catch { return null; }
}

async function callGptFrontier(system, user, { maxTokens = 700 } = {}) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ----------------------------------------------------------------------------
// (c) Dolphin → dilden bağımsız, nötr etiketli news_digest (JSON)
// ----------------------------------------------------------------------------
function parseJsonLoose(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function summarizeNews(match, rawText) {
  if (!rawText || rawText.length < 40) return null;
  const sys = [
    'You are a neutral football news summarizer. Read raw text about a fixture and',
    'extract structured facts ONLY. Do NOT predict scores or outcomes. Do NOT give',
    'betting advice. Use neutral, language-independent labels (English keys/values).',
    'Return STRICT JSON with keys: injuries[], suspensions[], form_notes[], key_facts[].',
    'Each injury/suspension item: {team:"home"|"away", player, status}.',
    'If nothing is found, return empty arrays. Output JSON only.',
  ].join(' ');
  const user = `Fixture: ${match.homeName} (home) vs ${match.awayName} (away), ${match.leagueName}.\n\nRAW TEXT:\n${rawText}`;
  const out = await callDolphin([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.2, maxTokens: 800 });
  const parsed = parseJsonLoose(out) || {};
  return {
    injuries: Array.isArray(parsed.injuries) ? parsed.injuries : [],
    suspensions: Array.isArray(parsed.suspensions) ? parsed.suspensions : [],
    form_notes: Array.isArray(parsed.form_notes) ? parsed.form_notes : [],
    key_facts: Array.isArray(parsed.key_facts) ? parsed.key_facts : [],
    as_of: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// (d) Çok dilli preview anlatıları
// ----------------------------------------------------------------------------
function statsLine(stats) {
  return `pHome=${stats.pHome} pDraw=${stats.pDraw} pAway=${stats.pAway} `
    + `over2.5=${stats.pOver25} btts=${stats.pBttsYes} `
    + `xG≈${stats.lambdaHome}-${stats.lambdaAway} topScores=${stats.topScores.map(s => s.score).join(',')}`;
}

function digestLine(digest) {
  if (!digest) return 'No news digest available.';
  const inj = (digest.injuries || []).map(i => `${i.team}:${i.player}(${i.status})`).join(', ') || 'none';
  const sus = (digest.suspensions || []).map(s => `${s.team}:${s.player}`).join(', ') || 'none';
  const facts = (digest.key_facts || []).slice(0, 4).join(' | ') || 'none';
  return `Injuries: ${inj}. Suspensions: ${sus}. Key facts: ${facts}.`;
}

const PREVIEW_PROMPTS = {
  tr: 'Türkçe yaz. Yaklaşan maç için 3-4 cümlelik nötr bir önizleme yaz. İstatistik olasılıklarını ve haber özetini doğal dille aktar. SKOR TAHMİNİ UYDURMA, bahis tavsiyesi verme. Olasılıklar verili sayılardan gelir.',
  en: 'Write in English. Write a neutral 3-4 sentence preview for the upcoming match. Convey the statistical probabilities and news digest naturally. Do NOT invent score predictions or give betting advice. Probabilities come from the given numbers.',
  de: 'Schreibe auf Hochdeutsch, Schweizer Rechtschreibung (ss statt ß). Verfasse eine neutrale Vorschau von 3-4 Sätzen für das bevorstehende Spiel. Gib die statistischen Wahrscheinlichkeiten und die Nachrichtenzusammenfassung natürlich wieder. Erfinde KEINE Ergebnistipps und gib KEINE Wettempfehlungen. Die Wahrscheinlichkeiten stammen aus den vorgegebenen Zahlen.',
};

async function generatePreview(lang, match, stats, digest) {
  const sys = PREVIEW_PROMPTS[lang];
  const user = `Match: ${match.homeName} vs ${match.awayName} (${match.leagueName}).\n`
    + `STATS (model, not LLM): ${statsLine(stats)}\n`
    + `NEWS: ${digestLine(digest)}`;

  // DE için sağlayıcı yönlendirmesi
  if (lang === 'de' && PREVIEW_DE_PROVIDER !== 'dolphin') {
    const out = PREVIEW_DE_PROVIDER === 'claude'
      ? await callClaudeFrontier(sys, user)
      : await callGptFrontier(sys, user);
    if (out) return { text: out.trim(), provider: PREVIEW_DE_PROVIDER };
    // frontier yoksa Dolphin'e zarif düşüş
  }
  const out = await callDolphin([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.5, maxTokens: 500 });
  return { text: (out || '').trim(), provider: 'dolphin' };
}

// ----------------------------------------------------------------------------
// (FAZ 4 — opsiyonel) Güven ayarı: frontier agent (Claude/GPT) stats + digest'i
// alır, "kilit sakatlık/ceza güveni nasıl etkiler" diye KISA bir metin üretir.
// Skor/olasılık ÜRETMEZ — yalnızca mevcut sayısal tahminin güvenini yorumlar.
// MI_CONFIDENCE=on ise çalışır; provider MI_CONFIDENCE_PROVIDER (claude|gpt).
// ----------------------------------------------------------------------------
const CONFIDENCE_ON = (ENV.MI_CONFIDENCE || 'off').toLowerCase() === 'on';
const CONFIDENCE_PROVIDER = (ENV.MI_CONFIDENCE_PROVIDER || 'claude').toLowerCase();

async function generateConfidence(match, stats, digest) {
  if (!CONFIDENCE_ON) return null;
  const sys = [
    'You are a cautious football analyst. Given a statistical prediction (already',
    'computed — do NOT change it) and a news digest, write ONE short sentence on how',
    'key injuries/suspensions affect CONFIDENCE in that prediction. Do NOT invent a',
    'score or a new probability. No betting advice. Neutral tone. English.',
  ].join(' ');
  const user = `Match: ${match.homeName} vs ${match.awayName}.\n`
    + `STATS: ${statsLine(stats)}\nNEWS: ${digestLine(digest)}`;
  const out = CONFIDENCE_PROVIDER === 'gpt'
    ? await callGptFrontier(sys, user, { maxTokens: 160 })
    : await callClaudeFrontier(sys, user, { maxTokens: 160 });
  return out ? out.trim() : null;
}

// ----------------------------------------------------------------------------
// (e) Supabase upsert
// ----------------------------------------------------------------------------
async function upsertRow(client, row) {
  const { error } = await client
    .from('match_intelligence')
    .upsert(row, { onConflict: 'match_id,model_version' });
  if (error) throw new Error(`supabase upsert: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Ana akış
// ----------------------------------------------------------------------------
async function main() {
  assertEnv();
  console.log(`🚀 Match Intelligence batch — ${DAYS} gün, max ${LIMIT} maç, ligler: ${COMPETITIONS.join(',')}`);
  console.log(`   Dolphin: ${OLLAMA_MODEL} @ ${OLLAMA_BASE_URL} | DE provider: ${PREVIEW_DE_PROVIDER}${DRY_RUN ? ' | DRY-RUN' : ''}`);

  const client = DRY_RUN ? null : sb();
  const matches = await fetchUpcomingMatches();
  console.log(`📅 ${matches.length} yaklaşan maç bulundu`);

  let ok = 0, fail = 0;
  for (const match of matches) {
    try {
      const [homeAvg, awayAvg] = await Promise.all([
        fetchTeamAverages(match.homeId),
        fetchTeamAverages(match.awayId),
      ]);

      const stats = await getPrediction(match, homeAvg, awayAvg);          // (a) LLM DEĞİL
      const rawNews = await collectNewsText(match);                        // (b)
      const digest = await summarizeNews(match, rawNews);                  // (c) Dolphin

      // CPU-only sunucuda Ollama istekleri sıraya koyar → paralel çağrılar
      // sırada beklerken timeout'a düşer. Bu yüzden önizlemeleri SIRAYLA üret.
      const tr = await generatePreview('tr', match, stats, digest);       // (d)
      const en = await generatePreview('en', match, stats, digest);
      const de = await generatePreview('de', match, stats, digest);

      const confidence = await generateConfidence(match, stats, digest);  // (FAZ 4)

      const row = {
        match_id: match.matchId,
        league_id: match.leagueId,
        league_name: match.leagueName,
        home_id: match.homeId,
        home_name: match.homeName,
        home_crest: match.homeCrest,
        away_id: match.awayId,
        away_name: match.awayName,
        away_crest: match.awayCrest,
        kickoff: match.kickoff,
        stats_prediction: stats,
        news_digest: digest,
        preview_tr: tr.text || null,
        preview_en: en.text || null,
        preview_de: de.text || null,
        preview_de_provider: de.provider,
        confidence: confidence,                                           // (FAZ 4) null olabilir
        model_version: MODEL_VERSION,
        source: SOURCE,
      };

      if (DRY_RUN) {
        console.log(`— ${match.homeName} vs ${match.awayName}\n   stats: ${statsLine(stats)}\n   de(${de.provider}): ${(de.text || '').slice(0, 120)}…`);
      } else {
        await upsertRow(client, row);
      }
      ok++;
      console.log(`✅ ${match.homeName} vs ${match.awayName}`);
    } catch (e) {
      fail++;
      console.error(`❌ ${match.homeName} vs ${match.awayName}: ${e.message}`);
    }
  }

  console.log(`\n🏁 Bitti — ${ok} başarılı, ${fail} hatalı.`);
}

main().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });
