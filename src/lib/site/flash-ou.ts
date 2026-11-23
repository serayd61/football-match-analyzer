// Üst/Alt 2,5 oranını FlashLive'dan doldurma adımı (snapshot-odds cron'u çağırır, 2026-11-24).
// Bütçe kuralı: ücretsiz plan AYDA 500 istek, kapsam içi maç ayda ~480 → MAÇ BAŞINA TEK ÇAĞRI.
//   1) Yalnız kapsam içi (tier 0) ve başlamasına ≤ 24 saat kalan maçlar (faz 'opening' değil).
//   2) Maçın herhangi bir faz satırında Üst/Alt varsa yeniden çekilmez.
//   3) Çekilen oran maçın o anki SON faz satırına yazılır; sonraki fazlar yeni çağrı yapmaz,
//      son bilinen Üst/Alt oranı ileri taşınır (okuyan her yer son faz satırına bakıyor).
//      Yani 1X2 sütunları faz anındaki orandır, Üst/Alt sütunları "son bilinen" orandır.
//   4) Kota Redis'te tutulur; Redis yoksa adım hiç çalışmaz (her tur liste çağrısı kotayı bitirir).
// Ağ ve depolar dışarıdan verilir: modül saf-testlenebilir, 'server-only' içermez.
import { PHASE_ORDER, isOddsPhase, type OddsPhase } from './odds-phases';
import { flashSpendable, matchFlashEvents, type FlashEvent, type FlashQuota } from '../data-sources/flashlive-pure';
import type { AfOdds } from '../data-sources/api-football-pure';

export interface FlashJob { fixtureId: number; kickoff: string; home: string; away: string }
export interface FlashRow { fixture_id: number; phase: string; over25_odds: number | null; under25_odds: number | null; ou_provider: string | null; btts_yes_odds: number | null }
type Quotaed<T> = (T & { ok: true; quota: FlashQuota | null }) | { ok: false; error: string; quota: FlashQuota | null };

export interface FlashDeps {
  now: Date;
  /** fixture → mevcut faz satırları */
  rows: (fixtureIds: number[]) => Promise<FlashRow[]>;
  update: (fixtureId: number, phase: string, cols: Record<string, number | string>) => Promise<string | null>;
  kv: { get: (key: string) => Promise<any>; set: (key: string, value: any, ttlSeconds: number) => Promise<void> };
  events: (indentDays: number) => Promise<Quotaed<{ events: FlashEvent[] }>>;
  odds: (eventId: string) => Promise<Quotaed<{ odds: AfOdds | null }>>;
  sleep?: (ms: number) => Promise<void>;
  /** tur başına üst sınır (kota payından bağımsız fren) */
  maxCalls?: number;
}

export interface FlashResult { candidates: number; need: number; carried: number; listCalls: number; oddsCalls: number; filled: number; noOdds: number; unmatched: number; skippedBudget: number; remaining: number | null; errors: string[] }

const QUOTA_KEY = 'fl:quota';
const evKey = (fid: number) => `fl:ev:${fid}`;
const missKey = (fid: number) => `fl:miss:${fid}`;
const listKey = (ymd: string) => `fl:list:${ymd}`;
const EV_TTL_S = 4 * 86_400, MISS_TTL_S = 12 * 3600, LIST_TTL_S = 12 * 3600;
const has = (v: unknown) => Number(v) > 1;
const rank = (phase: string) => (isOddsPhase(phase) ? PHASE_ORDER[phase as OddsPhase] : -1);

export async function fillFlashOu(jobs: FlashJob[], d: FlashDeps): Promise<FlashResult> {
  const res: FlashResult = { candidates: jobs.length, need: 0, carried: 0, listCalls: 0, oddsCalls: 0, filled: 0, noOdds: 0, unmatched: 0, skippedBudget: 0, remaining: null, errors: [] };
  if (!jobs.length) return res;
  const nowMs = d.now.getTime();
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const err = (m: string) => { if (res.errors.length < 10 && !res.errors.includes(m)) res.errors.push(m); };

  let quota: FlashQuota | null;
  try { quota = (await d.kv.get(QUOTA_KEY)) ?? null; } catch (e: any) { err(`kv: ${String(e?.message || e).slice(0, 120)}`); return res; }
  const learn = (q: FlashQuota | null) => { if (q) quota = q; else if (quota) quota = { ...quota, remaining: quota.remaining - 1 }; };
  let calls = 0;
  const max = d.maxCalls ?? 40;
  const canSpend = () => calls < max && flashSpendable(quota, nowMs) > 0;

  // Faz satırları: son faz + Üst/Alt taşıyan en geç faz
  const byFix = new Map<number, FlashRow[]>();
  for (const r of await d.rows(jobs.map((j) => j.fixtureId))) { const k = Number(r.fixture_id); byFix.set(k, [...(byFix.get(k) ?? []), r]); }
  const need: Array<FlashJob & { phase: string; bttsMissing: boolean }> = [];
  for (const j of jobs) {
    const rows = (byFix.get(j.fixtureId) ?? []).filter((r) => rank(r.phase) >= 0).sort((a, b) => rank(a.phase) - rank(b.phase));
    const last = rows[rows.length - 1];
    if (!last) continue; // akışta 1X2 de yok: yazılacak satır yok
    const src = [...rows].reverse().find((r) => has(r.over25_odds) && has(r.under25_odds));
    if (!src) { need.push({ ...j, phase: last.phase, bttsMissing: !has(last.btts_yes_odds) }); continue; }
    if (src !== last) {
      const e = await d.update(j.fixtureId, last.phase, { over25_odds: Number(src.over25_odds), under25_odds: Number(src.under25_odds), ou_provider: src.ou_provider ?? 'FlashLive' });
      if (e) err(`carry: ${e}`); else res.carried++;
    }
  }
  res.need = need.length;
  if (!need.length) { res.remaining = quota?.remaining ?? null; return res; }

  // Bilinen maç kimlikleri ve yakın zamanda boş dönenler
  const evOf = new Map<number, string>();
  const todo: typeof need = [];
  for (const n of need) {
    if (await d.kv.get(missKey(n.fixtureId))) continue;
    const ev = await d.kv.get(evKey(n.fixtureId));
    if (ev) evOf.set(n.fixtureId, String(ev));
    todo.push(n);
  }

  // Eşleme: eşlenmemiş maçların UTC günü başına tek liste çağrısı (12 saatte bir)
  const today = d.now.toISOString().slice(0, 10);
  const days = [...new Set(todo.filter((n) => !evOf.has(n.fixtureId)).map((n) => n.kickoff.slice(0, 10)))].sort();
  for (const ymd of days) {
    const indent = Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (indent < 0 || indent > 2) continue;
    if (await d.kv.get(listKey(ymd))) continue;
    if (!canSpend()) break;
    const r = await d.events(indent); calls++; res.listCalls++; learn(r.quota);
    if (!r.ok) { err(`list: ${r.error}`); break; }
    const mine = todo.filter((n) => !evOf.has(n.fixtureId) && n.kickoff.slice(0, 10) === ymd);
    for (const m of matchFlashEvents(mine, r.events)) { evOf.set(m.fixtureId, m.eventId); await d.kv.set(evKey(m.fixtureId), m.eventId, EV_TTL_S); }
    await d.kv.set(listKey(ymd), 1, LIST_TTL_S);
  }

  // Oran: en yakın maç önce
  for (const n of todo.sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const ev = evOf.get(n.fixtureId);
    if (!ev) { res.unmatched++; continue; }
    if (!canSpend()) { res.skippedBudget++; continue; }
    const r = await d.odds(ev); calls++; res.oddsCalls++; learn(r.quota);
    if (!r.ok) { err(`odds: ${r.error}`); if (/HTTP (401|403|429)/.test(r.error)) break; continue; }
    const o = r.odds;
    if (!o?.over25 || !o.under25) { res.noOdds++; await d.kv.set(missKey(n.fixtureId), 1, MISS_TTL_S); await sleep(250); continue; }
    const cols: Record<string, number | string> = { over25_odds: o.over25, under25_odds: o.under25, ou_provider: `FlashLive/${o.bookmaker}` };
    if (n.bttsMissing && o.bttsYes && o.bttsNo) { cols.btts_yes_odds = o.bttsYes; cols.btts_no_odds = o.bttsNo; }
    const e = await d.update(n.fixtureId, n.phase, cols);
    if (e) err(`update: ${e}`); else res.filled++;
    await sleep(250);
  }

  if (quota) { try { await d.kv.set(QUOTA_KEY, quota, Math.max(60, Math.ceil((quota.resetAtMs - nowMs) / 1000))); } catch { /* sonraki tur yeniden öğrenir */ } }
  res.remaining = quota?.remaining ?? null;
  return res;
}
