// ============================================================================
// Sosyal paylaşım içeriği (saf) — bacak seçimi, metinler (TR/EN), UTM linkleri
// ----------------------------------------------------------------------------
// Büyüme planı (2026-09-17): her sabah günün seçimleri, maç bitince sonuç,
// pazartesi haftalık karne. Kaynak veri: site_daily_picks (kural geçen gol
// pazarı bacakları) + site_showcase_picks (vitrin, kural E). Metin sade, emoji
// yok; kazanan ve kaybeden aynı biçimde yazılır. Tweet sınırı 280 (URL 23 sayılır).
// ============================================================================

export type Lang = 'tr' | 'en';
export type LegMarket = 'ou25' | 'btts' | '1x2';
export interface Leg {
  fixtureId: number; leagueSlug: string; leagueName: string; homeName: string; awayName: string; kickoff: string;
  market: LegMarket; selection: string; modelP: number; odds: number | null; source: 'daily' | 'showcase';
}
export interface DailyContent { legs: Leg[]; text: string; imageTitle: string; imageDate: string; link: string }

import { ODDS_MIN, ODDS_MAX } from '@/lib/site/daily-picks-rule';

export const SITE = 'https://footballanalytics.pro';
const TZ: Record<Lang, string> = { tr: 'Europe/Istanbul', en: 'Europe/Zurich' };
export type Source = 'twitter' | 'telegram';
/** Saat dilimi etiketi: TR sabit TSİ; EN için Zürih'in o günkü kısaltması (CET/CEST). */
export const tzLabel = (lang: Lang, iso: string): string => {
  if (lang === 'tr') return 'TSİ';
  const part = new Intl.DateTimeFormat('en-GB', { timeZone: TZ.en, timeZoneName: 'short' }).formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName');
  return part?.value ?? 'CET';
};

export const utm = (path: string, lang: Lang, campaign: string, source: Source = 'twitter') =>
  `${SITE}/${lang}${path}?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}`;

export const fmtTime = (iso: string, lang: Lang) => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ[lang] }).format(new Date(iso));
export const fmtDate = (ymd: string, lang: Lang) => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`));
export const fmtOdds = (o: number | null, lang: Lang) => o == null ? '' : lang === 'tr' ? o.toFixed(2).replace('.', ',') : o.toFixed(2);
export const pct = (p: number) => `${Math.round(p * 100)}%`;

export function marketLabel(leg: Pick<Leg, 'market' | 'selection' | 'homeName' | 'awayName'>, lang: Lang): string {
  if (leg.market === 'ou25') return lang === 'tr' ? 'Üst 2,5' : 'Over 2.5';
  if (leg.market === 'btts') return lang === 'tr' ? 'KG Var' : 'BTTS Yes';
  if (leg.selection === '1') return lang === 'tr' ? `${leg.homeName} kazanır` : `${leg.homeName} win`;
  if (leg.selection === '2') return lang === 'tr' ? `${leg.awayName} kazanır` : `${leg.awayName} win`;
  return lang === 'tr' ? 'Beraberlik' : 'Draw';
}

/**
 * Günün bacakları: önce günün seçimleri (kural geçen gol pazarı), sonra vitrin
 * gol pazarı (model olasılığına göre), sonra vitrin 1X2. Maç başına tek bacak, en çok `max`.
 */
export function pickLegs(daily: Leg[], showcase: Leg[], max = 3): Leg[] {
  const out: Leg[] = []; const seen = new Set<number>();
  const push = (l: Leg) => { if (out.length < max && !seen.has(l.fixtureId)) { seen.add(l.fixtureId); out.push(l); } };
  // Vitrin bacakları da oran bandına uyar (görsel alt yazısı 1,25–1,75 diyor; 18 Eyl: Bayern 1,11 çelişkisi). Oranı bilinmeyen vitrin bacağı gönderiye girmez.
  const inBand = (l: Leg) => l.odds != null && l.odds >= ODDS_MIN && l.odds <= ODDS_MAX;
  daily.forEach(push);
  showcase.filter((l) => l.market !== '1x2' && inBand(l)).sort((a, b) => b.modelP - a.modelP).forEach(push);
  showcase.filter((l) => l.market === '1x2' && inBand(l)).sort((a, b) => b.modelP - a.modelP).forEach(push);
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/** Tweet uzunluğu: URL'ler 23 sayılır. */
export function tweetLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
}

// ---------------------------------------------------------------------------
// Etiketler (2026-09-18, kullanıcı talimatı): takipçi az, erişim için hashtag şart.
// Sıra: günün trendiyle eşleşen etiket → bacakların lig etiketleri. En fazla 3
// (fazlası X'te spam sayılır). Yalnız X; Telegram metnine girmez.
// ---------------------------------------------------------------------------
export const MAX_TAGS = 3;
export const LEAGUE_TAG: Record<string, string> = {
  'premier-league': '#PL', championship: '#EFL', 'la-liga': '#LaLiga', 'serie-a': '#SerieA', bundesliga: '#Bundesliga',
  'ligue-1': '#Ligue1', eredivisie: '#Eredivisie', 'liga-portugal': '#LigaPortugal', 'champions-league': '#UCL',
  brasileirao: '#Brasileirao', 'super-lig': '#SüperLig',
};
const GENERIC = new Set(['fc', 'sc', 'ac', 'as', 'cf', 'afc', 'club', 'city', 'united', 'real', 'town', 'athletic', 'sporting', 'borussia', 'union', 'inter', 'de', 'la', 'le', 'the', 'und', 'jong']);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Trend adını hashtag'e çevir: boşluk/noktalama at, harf+rakam kalsın. */
export const toTag = (s: string) => `#${s.replace(/^#/, '').replace(/[^\p{L}\p{N}]/gu, '')}`;

/** Takım/lig kelimeleriyle eşleşen trendler (ilgisiz trendlere etiket asılmaz). */
export function matchTrends(legs: Leg[], trends: string[]): string[] {
  const words = new Set<string>();
  for (const l of legs) for (const name of [l.homeName, l.awayName, l.leagueName]) for (const w of norm(name).split(/[^a-z0-9]+/)) if (w.length >= 4 && !GENERIC.has(w)) words.add(w);
  const out: string[] = [];
  for (const t of trends) {
    const tw = norm(t.replace(/^#/, '')).split(/[^a-z0-9]+/).filter(Boolean);
    const compact = norm(t.replace(/^#/, '')).replace(/[^a-z0-9]/g, '');
    const hit = tw.some((w) => words.has(w)) || [...words].some((w) => w.length >= 5 && compact.includes(w));
    if (hit) { const tag = toTag(t); if (tag.length > 1 && !out.includes(tag)) out.push(tag); }
  }
  return out;
}

export function hashtags(legs: Leg[], trends: string[] = []): string[] {
  const out = matchTrends(legs, trends).slice(0, 2);
  for (const l of legs) { const t = LEAGUE_TAG[l.leagueSlug]; if (t && !out.some((x) => norm(x) === norm(t))) out.push(t); }
  return out.slice(0, MAX_TAGS);
}

export function dailyText(legs: Leg[], ymd: string, lang: Lang, record: { n: number; won: number } | null, source: Source = 'twitter', tags: string[] = []): string {
  const tz = legs.length ? ` · ${tzLabel(lang, legs[0].kickoff)}` : '';
  const head = lang === 'tr' ? `Günün seçimleri · ${fmtDate(ymd, lang)}${tz}` : `Today's picks · ${fmtDate(ymd, lang)}${tz}`;
  const rec = record && record.n ? (lang === 'tr' ? `Son 7 gün: ${record.won}/${record.n}` : `Last 7 days: ${record.won}/${record.n}`) : '';
  const link = utm('/predictions', lang, 'daily-pick', source);
  const join = (a: string[]) => a.filter((s, i, arr) => !(s === '' && arr[i - 1] === '')).join('\n');
  const full = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${marketLabel(l, lang)} · model ${pct(l.modelP)}${l.odds ? ` · ${fmtOdds(l.odds, lang)}` : ''}`);
  const short = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName.slice(0, 14)} – ${l.awayName.slice(0, 14)}: ${marketLabel(l, lang)} ${pct(l.modelP)}`);
  // sığmazsa sırayla: etiketleri azalt → satırları kısalt → son bacağı at
  const tagSet = source === 'twitter' ? tags.slice(0, MAX_TAGS) : [];
  for (const lines of [full, short]) {
    for (let n = tagSet.length; n >= 0; n--) {
      const text = join([head, '', ...lines, '', rec, n ? tagSet.slice(0, n).join(' ') : '', link]);
      if (tweetLength(text) <= 280) return text;
    }
  }
  if (legs.length > 1) return dailyText(legs.slice(0, -1), ymd, lang, record, source, tags);
  return join([head, '', ...short, '', rec, link]);
}

export function resultText(leg: Leg, h: number, a: number, won: boolean, lang: Lang): string {
  const mark = won ? '✓' : '✗';
  return lang === 'tr'
    ? `${leg.homeName} ${h}-${a} ${leg.awayName} · ${marketLabel(leg, lang)} ${mark}`
    : `${leg.homeName} ${h}-${a} ${leg.awayName} · ${marketLabel(leg, lang)} ${mark}`;
}

export interface WeeklyStats { from: string; to: string; n: number; won: number; byMarket: Record<string, { n: number; won: number }>; noPick: number }

export function weeklyText(s: WeeklyStats, lang: Lang, source: Source = 'twitter', tags: string[] = []): string[] {
  const tagLine = source === 'twitter' && tags.length ? `\n\n${tags.slice(0, MAX_TAGS).join(' ')}` : '';
  const rate = s.n ? Math.round((s.won / s.n) * 100) : 0;
  const mk = (k: string) => s.byMarket[k] ?? { n: 0, won: 0 };
  const range = `${fmtDate(s.from, lang)} – ${fmtDate(s.to, lang)}`;
  const link = utm('/performance', lang, 'weekly-record', source);
  if (lang === 'tr') return [
    `Haftalık karne · ${range}\n\nVitrin seçimleri: ${s.won}/${s.n} (%${rate})\n1X2 ${mk('1x2').won}/${mk('1x2').n} · Üst 2,5 ${mk('ou25').won}/${mk('ou25').n} · KG ${mk('btts').won}/${mk('btts').n}\nSeçim yok denilen maç: ${s.noPick}${tagLine}`,
    `Her seçim maçtan en az 3 saat önce dondurulur ve sonuç ne olursa olsun yazılır. Tüm karne ve pazar bazında ayrıntı: ${link}`,
  ];
  return [
    `Weekly record · ${range}\n\nShowcase picks: ${s.won}/${s.n} (${rate}%)\n1X2 ${mk('1x2').won}/${mk('1x2').n} · Over 2.5 ${mk('ou25').won}/${mk('ou25').n} · BTTS ${mk('btts').won}/${mk('btts').n}\nNo-pick calls: ${s.noPick}${tagLine}`,
    `Every pick is frozen at least 3 hours before kick-off and recorded whatever the result. Full record by market: ${link}`,
  ];
}
