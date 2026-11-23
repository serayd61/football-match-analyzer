// FlashLive Sports (RapidAPI, Flashscore verisi) — saf yardımcılar (ağ yok; testlenebilir).
// Ana istemci: ./flashlive.ts. Neden var (2026-11-24): API-Football hesabı 16 Ekim'den
// beri askıda ve yenilenmeyecek; FotMob akışında Üst/Alt 2,5 pazarı yok. Bu kaynak yalnız
// Üst/Alt 2,5 (+ akışta yoksa KG) için kullanılır. Bahisçiler: bet365, Unibet, William Hill
// (Pinnacle YOK → keskin fiyat gölge ölçümünü beslemez).
import { normTeam, teamSim, type AfOdds } from './api-football-pure';

/** Tercih sırası: FlashLive bahisçi id'leri (bet365 16, Unibet 5, William Hill 15). */
export const FL_BOOKMAKERS = { bet365: 16, unibet: 5, williamHill: 15 } as const;
const PREFER: number[] = [FL_BOOKMAKERS.bet365, FL_BOOKMAKERS.unibet, FL_BOOKMAKERS.williamHill];

const num = (v: any): number | null => { const n = typeof v === 'string' ? parseFloat(v) : Number(v); return Number.isFinite(n) && n > 1 && n < 1000 ? n : null; };
const cell = (m: any, k: 'FIRST' | 'SECOND' | 'THIRD') => num(m?.[`ODD_CELL_${k}`]?.VALUE);

/** Maç sonu (Full Time) dönemindeki pazar satırları; `group` verilirse o grup (ör. "Total: 2.5"). */
function fullTimeMarkets(data: any[], type: RegExp, group?: RegExp): any[] {
  const bet = (data || []).find((b) => type.test(String(b?.BETTING_TYPE || '')));
  const period = (bet?.PERIODS || []).find((p: any) => /full[ _]?time/i.test(`${p?.ODDS_STAGE ?? ''} ${p?.OBN ?? ''}`));
  const groups: any[] = period?.GROUPS || [];
  const g = group ? groups.find((x) => group.test(String(x?.GROUP_NAME ?? ''))) : groups[0];
  return ((g?.MARKETS || []) as any[]).filter((m) => m?.ODDS_AVAILABLE !== 0);
}

/**
 * /v1/events/odds yanıtının DATA dizisinden tek bahisçinin 1X2, Üst/Alt 2,5 ve KG oranı.
 * Üst/Alt 2,5'i TAM olan ilk tercihli bahisçi seçilir (bu kaynağın varlık nedeni); hiçbirinde
 * yoksa 1X2 ya da KG'si olan ilk bahisçi. Pazarlar tek bahisçiden okunur, karıştırılmaz.
 */
export function parseFlashOdds(data: any[]): AfOdds | null {
  const x12 = fullTimeMarkets(data, /^\*?1x2$/i);
  const ou = fullTimeMarkets(data, /^\*?over\/under$/i, /^total:\s*2\.5$/i);
  const bt = fullTimeMarkets(data, /^\*?both teams to score$/i);
  const ids = [...new Set([...ou, ...x12, ...bt].map((m) => Number(m?.BOOKMAKER_ID)).filter((n) => Number.isFinite(n)))];
  const order = [...PREFER.filter((id) => ids.includes(id)), ...ids.filter((id) => !PREFER.includes(id))];
  const of = (rows: any[], id: number) => rows.find((m) => Number(m?.BOOKMAKER_ID) === id);
  const build = (id: number): AfOdds => {
    const a = of(x12, id), o = of(ou, id), b = of(bt, id);
    const over = cell(o, 'SECOND'), under = cell(o, 'THIRD'), yes = cell(b, 'SECOND'), no = cell(b, 'THIRD');
    const h = cell(a, 'FIRST'), d = cell(a, 'SECOND'), w = cell(a, 'THIRD');
    const full3 = !!(h && d && w);
    return {
      bookmaker: String((a ?? o ?? b)?.BOOKMAKER_NAME || id),
      home: full3 ? h : null, draw: full3 ? d : null, away: full3 ? w : null,
      over25: over && under ? over : null, under25: over && under ? under : null,
      bttsYes: yes && no ? yes : null, bttsNo: yes && no ? no : null,
    };
  };
  const all = order.map(build);
  return all.find((x) => x.over25) ?? all.find((x) => x.home || x.bttsYes) ?? null;
}

export interface FlashEvent { id: string; kickoff: string; home: string; away: string; tournament: string }

/** /v1/events/list yanıtının DATA dizisi → düz maç listesi (başlama saati UTC ISO). */
export function parseFlashEvents(data: any[]): FlashEvent[] {
  const out: FlashEvent[] = [];
  const seen = new Set<string>(); // aynı maç listede iki kez gelebiliyor; ikinci kopya belirsizlik kuralını bozar
  for (const t of data || []) {
    for (const e of (t?.EVENTS || []) as any[]) {
      const ts = Number(e?.START_UTIME ?? e?.START_TIME);
      const id = String(e?.EVENT_ID || ''), home = String(e?.HOME_NAME || ''), away = String(e?.AWAY_NAME || '');
      if (!id || !home || !away || !Number.isFinite(ts) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, kickoff: new Date(ts * 1000).toISOString(), home, away, tournament: String(t?.NAME || '') });
    }
  }
  return out;
}

export interface FlashCandidate { fixtureId: number; kickoff: string; home: string; away: string }
const KICKOFF_TOLERANCE_MS = 15 * 60_000;

// Flashscore kısa ad kullanır ("Cardiff", "Sheffield Utd", "QPR", "Wolves", "Dortmund"); bizim
// akış uzun ad ("Cardiff City", "Queens Park Rangers"). teamSim uzun adın fazladan kelimesini
// cezalandırdığı için 24 Kas 2026 denemesinde 17 maçtan yalnız 8'i eşleşti. Burada kısa ad
// uzun adın ALT KÜMESİ ise tam eşleşme sayılır; baş harf kısaltması ve ortak kök de tanınır.
const SQUAD_MARK = /(^|[\s(])(w|women|u1[5-9]|u2[0-3]|b|ii|reserves?|jong|youth|am)(?=$|[\s)])/i;
const squadOf = (s: string) => (s.match(SQUAD_MARK)?.[2] ?? '').toLowerCase();
const tokens = (s: string) => normTeam(s.replace(/[øØ]/g, 'o').replace(/\butd\b\.?/gi, 'united').replace(/[/.]/g, ' ')).filter((t) => t.length > 1);
const acronym = (s: string) => s.replace(/[^A-Za-zÀ-ÿ ]+/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toLowerCase();

/** Kısa/uzun takım adı benzerliği (0–1). Farklı kadro (kadın, U21, B takımı) hiçbir zaman eşleşmez. */
export function flashTeamSim(a: string, b: string): number {
  if (squadOf(a) !== squadOf(b)) return 0;
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  // baş harf kısaltması: "QPR" ~ "Queens Park Rangers", "PSG" ~ "Paris Saint-Germain"
  const rawShort = A.length <= B.length ? a : b, rawLong = A.length <= B.length ? b : a;
  if (short.length === 1 && short[0].length >= 3 && short[0].length <= 4 && acronym(rawLong) === short[0] && rawShort.trim().length <= 4) return 1;
  let hit = 0;
  for (const x of short) {
    if (long.includes(x)) { hit += 1; continue; }
    // ortak kök: "Wolves" ~ "Wolverhampton" (en az 4 harf ortak baş), "Inter" ~ "Internazionale"
    if (long.some((y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i >= 4; })) hit += 0.8;
  }
  return Math.max(hit / short.length, teamSim(a, b));
}

/**
 * Bizim maçları günün TÜM dünya listesine eşle. Liste lig süzmez (kadınlar, U21, alt ligler
 * aynı listede), bu yüzden başlama saati ±15 dk içinde olmayan aday hiç sayılmaz; İKİ takımın
 * da benzerliği ≥ 0,6 olmalı ve en iyi aday ikinciden ≥ 0,15 önde olmalı. Tutmuyorsa maç
 * eşlenmez (yanlış maça oran yazmaktansa boş).
 */
export function matchFlashEvents(ours: FlashCandidate[], theirs: FlashEvent[], minScore = 0.6): Array<{ fixtureId: number; eventId: string; score: number }> {
  const out: Array<{ fixtureId: number; eventId: string; score: number }> = [];
  const used = new Set<string>();
  for (const o of ours) {
    const t0 = Date.parse(o.kickoff);
    const scored = theirs
      .filter((t) => !used.has(t.id) && Math.abs(Date.parse(t.kickoff) - t0) <= KICKOFF_TOLERANCE_MS)
      .map((t) => ({ t, s: Math.min(flashTeamSim(o.home, t.home), flashTeamSim(o.away, t.away)) }))
      .sort((a, b) => b.s - a.s);
    const best = scored[0], second = scored[1];
    if (best && best.s >= minScore && (!second || best.s - second.s >= 0.15)) { used.add(best.t.id); out.push({ fixtureId: o.fixtureId, eventId: best.t.id, score: Math.round(best.s * 100) / 100 }); }
  }
  return out;
}

export interface FlashQuota { remaining: number; resetAtMs: number }

/** RapidAPI yanıt başlıklarından aylık kota (yoksa null). */
export function quotaFromHeaders(get: (name: string) => string | null, nowMs: number): FlashQuota | null {
  const rem = Number(get('x-ratelimit-requests-remaining')), reset = Number(get('x-ratelimit-requests-reset'));
  if (!Number.isFinite(rem) || !Number.isFinite(reset) || get('x-ratelimit-requests-remaining') == null) return null;
  return { remaining: rem, resetAtMs: nowMs + reset * 1000 };
}

/** Ayın kalan her günü için ayrılan pay: kota ilk hafta sonunda erimesin. */
export const FL_RESERVE_PER_DAY = 8;

/**
 * Şu an harcanabilecek istek sayısı. Ücretsiz plan ayda 500 istek; kapsam içi maç ayda ~480.
 * Kural: yenilenmeye kalan her gün için FL_RESERVE_PER_DAY istek dokunulmaz kalır; üstü
 * hemen harcanabilir (hafta sonu yoğunluğu taşar, ay sonu yine de boş kalmaz).
 */
export function flashSpendable(q: FlashQuota | null, nowMs: number): number {
  // Kota bilinmiyor ya da kayıt bayat (ay döndü): tek istekle öğren, gerisi sonraki yanıta göre.
  if (!q || q.resetAtMs <= nowMs) return 1;
  const daysLeft = Math.max(0, Math.ceil((q.resetAtMs - nowMs) / 86_400_000) - 1);
  return Math.max(0, Math.floor(q.remaining - FL_RESERVE_PER_DAY * daysLeft));
}
