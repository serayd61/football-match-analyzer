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
export type Source = 'twitter' | 'telegram' | 'instagram';
/** Saat dilimi etiketi: TR sabit TSİ; EN için Zürih'in o günkü kısaltması (CET/CEST). */
export const tzLabel = (lang: Lang, iso: string): string => {
  if (lang === 'tr') return 'TSİ';
  const part = new Intl.DateTimeFormat('en-GB', { timeZone: TZ.en, timeZoneName: 'short' }).formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName');
  return part?.value ?? 'CET';
};

export const utm = (path: string, lang: Lang, campaign: string, source: Source = 'twitter') =>
  `${SITE}/${lang}${path}?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}`;

// ---------------------------------------------------------------------------
// Instagram (2026-10-31): Telegram'daki günlük gönderinin aynası. Fark: ORAN YOK
// ve bahis dili yok — X Ads'te hesabı durduran "Gambling" sınıflaması aynı
// sinyallere bakıyor; Instagram'da reklam verebilmek için hesap temiz kalmalı.
// Link tıklanmaz, "link in bio" denir. Etiket: sabit küme + lig etiketleri (≤30).
// ---------------------------------------------------------------------------
export const INSTAGRAM_TAGS: Record<Lang, string[]> = {
  en: ['#footballanalytics', '#xG', '#expectedgoals', '#footballdata', '#socceranalytics', '#matchanalysis', '#footballstats', '#datascience', '#football', '#soccer'],
  tr: ['#futbolanalizi', '#xG', '#beklenengol', '#futbolverisi', '#maçanalizi', '#futbolistatistik', '#verianalizi', '#futbol', '#footballanalytics', '#expectedgoals'],
};
export const INSTAGRAM_MAX_TAGS = 30;

export function instagramTags(lang: Lang, extra: string[] = []): string {
  const seen = new Set<string>(); const out: string[] = [];
  for (const t of [...INSTAGRAM_TAGS[lang], ...extra]) { const k = t.toLowerCase(); if (t.startsWith('#') && t.length > 1 && !seen.has(k)) { seen.add(k); out.push(t); } }
  return out.slice(0, INSTAGRAM_MAX_TAGS).join(' ');
}

/** Instagram günlük açıklaması: oran yok, "link in bio", ≤2200 karakter. */
export function instagramDailyCaption(legs: Leg[], ymd: string, lang: Lang, record: { n: number; won: number } | null, tags: string[] = []): string {
  const tz = legs.length ? ` · ${tzLabel(lang, legs[0].kickoff)}` : '';
  const head = lang === 'tr' ? `Günün model seçimleri · ${fmtDate(ymd, lang)}${tz}` : `Today's model picks · ${fmtDate(ymd, lang)}${tz}`;
  const lines = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${marketLabel(l, lang)} · ${lang === 'tr' ? 'model' : 'model'} ${pct(l.modelP)}`);
  const rec = record && record.n ? (lang === 'tr' ? `Son 7 gün: ${record.won}/${record.n}` : `Last 7 days: ${record.won}/${record.n}`) : '';
  const rule = lang === 'tr'
    ? 'Her seçim maçtan önce dondurulur, sonuç ne olursa olsun yazılır. Garanti değil, kayıt.'
    : 'Every pick is frozen before kick-off and recorded whatever the result. A record, not a guarantee.';
  const cta = lang === 'tr' ? 'Tam karne ve ücretsiz analiz → profildeki link' : 'Full record and free analysis → link in bio';
  const text = [head, '', ...lines, '', rec, rule, cta, '', instagramTags(lang, tags)].filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\n');
  return text.length <= 2200 ? text : text.slice(0, 2200);
}

/** Instagram güçlü pazarlar: görselle aynı, 2 maç açık + "N daha" (siteye çağrı). */
export const INSTAGRAM_STRONG_VISIBLE = 2;
/** Instagram "güçlü pazarlar" açıklaması: lig-pazar karnesiyle, oran yok, link in bio. */
export function instagramStrongCaption(legs: StrongLeg[], ymd: string, lang: Lang, tags: string[] = []): string {
  const tz = legs.length ? ` · ${tzLabel(lang, legs[0].kickoff)}` : '';
  const head = lang === 'tr' ? `Bugün güçlü pazarlar · ${fmtDate(ymd, lang)}${tz}` : `Strong markets today · ${fmtDate(ymd, lang)}${tz}`;
  const sub = lang === 'tr' ? 'Lig-pazar karnesi son 180 günde ≥%70 (≥15 maç).' : 'League–market record ≥70% over the last 180 days (≥15 matches).';
  // Görselle aynı vitrin: ilk 2 maç açık, kalanı sayı olarak (siteye çağrı).
  const shown = legs.slice(0, INSTAGRAM_STRONG_VISIBLE), hidden = legs.length - shown.length;
  const lines = shown.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${strongMarketLabel(l, lang)} · model ${pct(l.modelP)} · ${l.leagueName} ${l.won}/${l.n}`);
  const more = hidden > 0 ? (lang === 'tr' ? `+${hidden} maç daha bugün → tam liste profildeki linkte` : `+${hidden} more ${hidden === 1 ? 'match' : 'matches'} today → full list via link in bio`) : '';
  const rule = lang === 'tr' ? 'Her seçim maçtan önce dondurulur, sonuç ne olursa olsun yazılır. Garanti değil, kayıt.' : 'Every pick is frozen before kick-off and recorded whatever the result. A record, not a guarantee.';
  const cta = lang === 'tr' ? 'Lig-pazar karnesi → profildeki link' : 'League–market record → link in bio';
  const text = [head, sub, '', ...lines, more, '', rule, cta, '', instagramTags(lang, tags)].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  return text.length <= 2200 ? text : text.slice(0, 2200);
}

/** Günün kuponunun Instagram karşılığı: iki bacak + ortak model olasılığı. Oran, "kupon", ROI yok (reklam sınıflaması). */
export interface ComboLeg { fixtureId: number; kickoff: string; leagueLabel: string; homeName: string; awayName: string; market: '1x2' | 'ou25' | 'btts'; selection: string; p: number; homeScore?: number | null; awayScore?: number | null; won?: boolean | null }
export function comboLegLabel(l: Pick<ComboLeg, 'market' | 'selection' | 'homeName' | 'awayName'>, lang: Lang): string {
  if (l.market === 'ou25' && l.selection === 'under') return lang === 'tr' ? 'Alt 2,5' : 'Under 2.5';
  return marketLabel({ market: l.market, selection: l.selection, homeName: l.homeName, awayName: l.awayName }, lang);
}
export function instagramComboCaption(legs: ComboLeg[], ymd: string, lang: Lang, pJoint: number, record: { n: number; won: number } | null, tags: string[] = []): string {
  const tz = legs.length ? ` · ${tzLabel(lang, legs[0].kickoff)}` : '';
  const head = lang === 'tr' ? `Günün ikilisi · ${fmtDate(ymd, lang)}${tz}` : `Model duo of the day · ${fmtDate(ymd, lang)}${tz}`;
  const lines = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${comboLegLabel(l, lang)} · model ${pct(l.p)}`);
  const joint = lang === 'tr' ? `İkisinin birlikte tutma olasılığı (model): ${pct(pJoint)}` : `Joint model probability of both landing: ${pct(pJoint)}`;
  const rec = record && record.n ? (lang === 'tr' ? `Son 30 gün: ${record.won}/${record.n} ikili tuttu` : `Last 30 days: ${record.won}/${record.n} duos landed`) : '';
  const rule = lang === 'tr' ? 'Maçtan önce dondurulur, sonucu akşam bu gönderinin altına yazılır. Garanti değil, kayıt.' : 'Frozen before kick-off; the result is posted under this post tonight. A record, not a guarantee.';
  const cta = lang === 'tr' ? 'Tam karne → profildeki link' : 'Full record → link in bio';
  const text = [head, '', ...lines, '', joint, rec, rule, cta, '', instagramTags(lang, tags)].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  return text.length <= 2200 ? text : text.slice(0, 2200);
}
export function instagramComboResult(c: { legs: ComboLeg[]; status: 'won' | 'lost' | 'void' | 'pending' }, ymd: string, lang: Lang): string {
  const mark = c.status === 'won' ? '✓' : c.status === 'lost' ? '✗' : '–';
  const head = lang === 'tr' ? `Sonuç · ${fmtDate(ymd, lang)} ${mark}` : `Result · ${fmtDate(ymd, lang)} ${mark}`;
  const lines = c.legs.map((l) => `${l.homeName} ${l.homeScore ?? '?'}-${l.awayScore ?? '?'} ${l.awayName} · ${comboLegLabel(l, lang)} ${l.won == null ? '–' : l.won ? '✓' : '✗'}`);
  const verdict = c.status === 'won' ? (lang === 'tr' ? 'İkisi de tuttu.' : 'Both landed.') : c.status === 'lost' ? (lang === 'tr' ? 'Tutmadı, kayda geçti.' : 'Missed, recorded.') : (lang === 'tr' ? 'İptal (maç oynanmadı).' : 'Void (match not played).');
  return [head, ...lines, verdict].join('\n');
}

/** Instagram haftalık açıklaması: iki X gönderisi tek açıklamada birleşir, link "bio"ya işaret eder. */
export function instagramWeeklyCaption(s: WeeklyStats, lang: Lang): string {
  const [first, second] = weeklyText(s, lang, 'instagram');
  const cta = lang === 'tr' ? 'Pazar bazında tam karne → profildeki link' : 'Full record by market → link in bio';
  const body = `${first}\n\n${second.replace(/\s*https?:\/\/\S+$/, '')}\n${cta}\n\n${instagramTags(lang)}`;
  return body.length <= 2200 ? body : body.slice(0, 2200);
}

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
export type NameRow = Pick<Leg, 'homeName' | 'awayName' | 'leagueName'> & { leagueSlug?: string | null };
export function matchTrends(legs: NameRow[], trends: string[]): string[] {
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

/** Lig etiketi önceliği (kitle büyüklüğü): üst sınıra takılınca büyük kitle kalır. */
const LEAGUE_PRIORITY = ['premier-league', 'champions-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'championship', 'eredivisie', 'liga-portugal', 'super-lig', 'brasileirao'];

export function hashtags(legs: Leg[], trends: string[] = []): string[] {
  const out = matchTrends(legs, trends).slice(0, 2);
  const slugs = [...new Set(legs.map((l) => l.leagueSlug))].sort((a, b) => (LEAGUE_PRIORITY.indexOf(a) + 1 || 99) - (LEAGUE_PRIORITY.indexOf(b) + 1 || 99));
  for (const slug of slugs) { const t = LEAGUE_TAG[slug]; if (t && !out.some((x) => norm(x) === norm(t))) out.push(t); }
  return out.slice(0, MAX_TAGS);
}

/** Telegram kanal/grup adını (@ad) bağlantıya çevirir; sayısal id ise null. */
export const telegramLink = (chat: string | null | undefined): string | null => {
  const c = (chat || '').trim().replace(/^@/, '');
  return c && /^[A-Za-z0-9_]+$/.test(c) ? `https://t.me/${c}` : null;
};

/** X günlük gönderisinin altına: Telegram davet yanıtı (kullanıcı isteği 18 Eyl: insanlar gruba gelsin). */
export function inviteText(link: string, lang: Lang): string {
  return lang === 'tr'
    ? `Seçimler ve sonuçlar Telegram grubunda da paylaşılıyor, ücretsiz: ${link}`
    : `Picks and results are also posted in our Telegram group, free to join: ${link}`;
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

// ---- Güçlü pazarlar gönderisi (plan adım 4, 24 Eyl) ------------------------
export interface StrongLeg { fixtureId: number; homeName: string; awayName: string; kickoff: string; leagueName: string; market: 'x12' | 'ou25' | 'under25' | 'btts'; selection: string; modelP: number; won: number; n: number }
export interface StrongBoardLine { market: 'x12' | 'ou25' | 'under25' | 'btts'; leagues: Array<{ name: string; won: number; n: number }> }

export function strongMarketLabel(l: Pick<StrongLeg, 'market' | 'selection' | 'homeName' | 'awayName'>, lang: Lang): string {
  if (l.market === 'ou25') return lang === 'tr' ? 'Üst 2,5' : 'Over 2.5';
  if (l.market === 'under25') return lang === 'tr' ? 'Alt 2,5' : 'Under 2.5';
  if (l.market === 'btts') return lang === 'tr' ? 'KG Var' : 'BTTS Yes';
  return marketLabel({ market: '1x2', selection: l.selection, homeName: l.homeName, awayName: l.awayName }, lang);
}
const boardMarket = (m: StrongBoardLine['market'], lang: Lang) => m === 'ou25' ? (lang === 'tr' ? 'Üst 2,5' : 'Over 2.5') : m === 'under25' ? (lang === 'tr' ? 'Alt 2,5' : 'Under 2.5') : m === 'btts' ? (lang === 'tr' ? 'KG Var' : 'BTTS') : '1X2';

/** Sabah "güçlü pazarlar" gönderisi: lig-pazar karnesi ≥%70 olan bölgeye düşen maçlar. 280'e sığdırır. */
export function strongText(legs: StrongLeg[], ymd: string, lang: Lang, source: Source = 'twitter', tags: string[] = []): string {
  const tz = legs.length ? ` · ${tzLabel(lang, legs[0].kickoff)}` : '';
  const head = lang === 'tr' ? `Bugün güçlü pazarlar · ${fmtDate(ymd, lang)}${tz}` : `Strong markets today · ${fmtDate(ymd, lang)}${tz}`;
  const sub = lang === 'tr' ? 'Lig-pazar karnesi son 180 günde ≥%70 (≥15 maç). Garanti değil, kayıt.' : 'League–market record ≥70% over 180 days (≥15 matches). A record, not a guarantee.';
  const link = utm('/performance#strong', lang, 'strong-markets', source);
  const join = (a: string[]) => a.filter((s, i, arr) => !(s === '' && arr[i - 1] === '')).join('\n');
  const full = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${strongMarketLabel(l, lang)} ${pct(l.modelP)} · ${l.leagueName} ${l.won}/${l.n}`);
  const short = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName.slice(0, 12)} – ${l.awayName.slice(0, 12)}: ${strongMarketLabel(l, lang)} ${pct(l.modelP)} (${l.won}/${l.n})`);
  const tagSet = source === 'twitter' ? tags.slice(0, MAX_TAGS) : [];
  if (source === 'telegram') return join([head, sub, '', ...full, '', link]);
  for (const lines of [full, short]) {
    for (let n = tagSet.length; n >= 0; n--) {
      const text = join([head, '', ...lines, '', n ? tagSet.slice(0, n).join(' ') : '', link]);
      if (tweetLength(text) <= 280) return text;
    }
  }
  if (legs.length > 1) return strongText(legs.slice(0, -1), ymd, lang, source, tags);
  return join([head, '', ...short, '', link]);
}

/** Haftalık dizinin üçüncü gönderisi: pazar başına en güçlü ligler. */
export function strongBoardText(board: StrongBoardLine[], lang: Lang, source: Source = 'twitter'): string {
  const head = lang === 'tr' ? 'En güçlü lig-pazar çiftleri (180 gün):' : 'Strongest league–market pairs (180 days):';
  const lines = board.map((b) => `${boardMarket(b.market, lang)}: ${b.leagues.map((l) => `${l.name} ${l.won}/${l.n}`).join(' · ')}`);
  const link = utm('/performance#strong', lang, 'strong-markets', source);
  let text = [head, ...lines, '', link].join('\n');
  let take = board.map((b) => b.leagues.length);
  while (source === 'twitter' && tweetLength(text) > 280 && take.some((n) => n > 1)) {
    take = take.map((n) => Math.max(1, n - 1));
    text = [head, ...board.map((b, i) => `${boardMarket(b.market, lang)}: ${b.leagues.slice(0, take[i]).map((l) => `${l.name} ${l.won}/${l.n}`).join(' · ')}`), '', link].join('\n');
  }
  return text;
}

// ---------------------------------------------------------------------------
// Boş gün kanıt kartı etiketleri (2026-11-15, kullanıcı: "boş günlerde kanıt kartı
// atsın ama etiketler çok önemli, o günün trendleri etikete eklensin").
// Kaynaklar: (1) günün trendleri (X + Google Trends RSS) → yalnız futbolla ilgili
// olanlar (günün maçlarındaki takım/lig kelimesi, futbol anahtar kelimesi ya da
// büyük kulüp adı; rugby/kriket vb. dışlanır); (2) günün programındaki turnuvalar
// (Uluslar Ligi, Dünya Kupası elemesi, Premier League...); (3) o turnuvalardaki
// takımlar. Sabit küme (10) + bunlar ≤ 30.
// ---------------------------------------------------------------------------
const FOOTBALL_WORDS = ['football', 'soccer', 'futbol', 'fussball', 'fußball', 'calcio', 'fútbol', 'futebol', 'uefa', 'fifa', 'premier league', 'bundesliga', 'la liga', 'laliga', 'serie a', 'ligue 1', 'süper lig', 'super lig', 'eredivisie', 'championship', 'champions league', 'europa league', 'conference league', 'nations league', 'world cup', 'copa america', 'afcon', 'euro 2028', 'euro 2032', 'derby', 'derbi', 'matchday', 'transfer', 'milli takım', 'millî', 'national team', 'nationalmannschaft', 'dfb', 'tff', 'fa cup', 'dfb pokal', 'coppa italia', 'copa del rey', 'libertadores', 'mls', 'liga mx', 'brasileirao', 'brasileirão', 'xg', 'goalkeeper', 'striker', 'midfielder', 'hat-trick', 'penalty shootout', 'var decision'];
const NOT_FOOTBALL = ['rugby', 'cricket', 'nfl', 'nba', 'nhl', 'mlb', 'basketball', 'basketbol', 'tennis', 'tenis', 'golf', 'f1', 'formula 1', 'ufc', 'boxing', 'boks', 'handball', 'hentbol', 'volleyball', 'voleybol', 'ice hockey', 'eishockey', 'super bowl', 'wwe', 'darts', 'snooker', 'cycling', 'esports'];
const BIG_CLUBS = ['arsenal', 'chelsea', 'liverpool', 'manchester united', 'man utd', 'manchester city', 'man city', 'tottenham', 'spurs', 'newcastle', 'aston villa', 'everton', 'west ham', 'celtic', 'rangers', 'real madrid', 'barcelona', 'barça', 'atletico', 'atlético', 'sevilla', 'valencia', 'athletic bilbao', 'bayern', 'dortmund', 'bvb', 'leverkusen', 'leipzig', 'schalke', 'frankfurt', 'stuttgart', 'gladbach', 'hamburger sv', 'hsv', 'juventus', 'inter milan', 'ac milan', 'napoli', 'roma', 'lazio', 'atalanta', 'fiorentina', 'psg', 'paris saint-germain', 'marseille', 'lyon', 'monaco', 'lille', 'ajax', 'psv', 'feyenoord', 'benfica', 'porto', 'sporting cp', 'galatasaray', 'fenerbahçe', 'fenerbahce', 'beşiktaş', 'besiktas', 'trabzonspor', 'red star', 'crvena zvezda', 'partizan', 'dinamo zagreb', 'hajduk', 'olympiacos', 'panathinaikos', 'anderlecht', 'club brugge', 'basel', 'young boys', 'salzburg', 'flamengo', 'palmeiras', 'boca juniors', 'river plate', 'al hilal', 'al nassr', 'inter miami', 'la galaxy'];
/** Uluslararası turnuvalar: katalogda yok, lig adına göre (öncelik = sıra). */
const INTL_COMPETITIONS: { re: RegExp; tags: string[] }[] = [
  { re: /uefa nations league|^nations league/i, tags: ['#NationsLeague', '#UEFANationsLeague'] },
  { re: /concacaf nations league/i, tags: ['#NationsLeague', '#CNL'] },
  { re: /world cup qual/i, tags: ['#WorldCupQualifiers', '#WCQ', '#WorldCup2026'] },
  { re: /africa cup of nations/i, tags: ['#AFCON', '#AFCONQualifiers'] },
  { re: /euro.*qual|european championship qual/i, tags: ['#EUROQualifiers'] },
  { re: /copa america/i, tags: ['#CopaAmerica'] },
  { re: /asian cup/i, tags: ['#AsianCup'] },
  { re: /^friendlies$|international friendl/i, tags: ['#InternationalFriendly', '#InternationalBreak'] },
];
/** Kulüp ligleri: yalnız katalog slug'ıyla (Gana "Premier League" gibi ad çakışmaları etiketlenmez); sıra = öncelik. */
const CLUB_COMPETITIONS: [slug: string, tags: string[]][] = [
  ['champions-league', ['#ChampionsLeague', '#UCL']], ['europa-league', ['#EuropaLeague', '#UEL']], ['conference-league', ['#ConferenceLeague', '#UECL']],
  ['premier-league', ['#PremierLeague', '#PL']], ['la-liga', ['#LaLiga']], ['bundesliga', ['#Bundesliga']], ['serie-a', ['#SerieA']], ['ligue-1', ['#Ligue1']],
  ['super-lig', ['#SüperLig']], ['eredivisie', ['#Eredivisie']], ['championship', ['#EFLChampionship', '#EFL']], ['liga-portugal', ['#LigaPortugal']],
  ['brasileirao', ['#Brasileirao']], ['mls', ['#MLS']], ['liga-mx', ['#LigaMX']], ['ekstraklasa', ['#Ekstraklasa']], ['eliteserien', ['#Eliteserien']], ['superligaen', ['#Superligaen']],
];
const competitionIndex = (r: NameRow): number => {
  const i = INTL_COMPETITIONS.findIndex((c) => c.re.test(r.leagueName.trim()));
  if (i >= 0) return i;
  const j = r.leagueSlug ? CLUB_COMPETITIONS.findIndex(([slug]) => slug === r.leagueSlug) : -1;
  return j >= 0 ? INTL_COMPETITIONS.length + j : -1;
};
const competitionTags = (i: number): string[] => (i < INTL_COMPETITIONS.length ? INTL_COMPETITIONS[i].tags : CLUB_COMPETITIONS[i - INTL_COMPETITIONS.length][1]);
export const DAY_TREND_MAX_EXTRA = INSTAGRAM_MAX_TAGS - INSTAGRAM_TAGS.en.length; // 20
const TAG_MAX_LEN = 20; // trend/takım etiketi (uzun TR tamlamaları düşer); turnuva etiketleri küratörlü, sınırsız
const CLUB_SUFFIX = /\b(fc|sc|ac|cf|afc|sk|bk|if|fk|kf|nk|cd|ud|sd|u21|u19|w)\b\.?/gi;

/** Trend → okunur hashtag: kelime başları büyük, harf+rakam kalır (#ArsenalWomen). */
export function trendTag(s: string): string | null {
  const words = s.replace(/^#/, '').replace(CLUB_SUFFIX, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const body = words.map((w) => (w === w.toUpperCase() && w.length <= 4 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('').replace(/[^\p{L}\p{N}]/gu, '');
  if (body.length < 2 || body.length > TAG_MAX_LEN || /^\p{N}+$/u.test(body)) return null;
  return `#${body}`;
}

/** Trend futbolla ilgili mi? Günün maç kelimeleri, futbol anahtar kelimesi ya da büyük kulüp; spor dışlama listesi önce gelir. */
export function isFootballTrend(trend: string, rows: NameRow[] = []): boolean {
  const t = norm(trend.replace(/^#/, ''));
  if (NOT_FOOTBALL.some((w) => t.includes(w))) return false;
  if (FOOTBALL_WORDS.some((w) => t.includes(norm(w)))) return true;
  if (BIG_CLUBS.some((c) => t.includes(norm(c)))) return true;
  return matchTrends(rows, [trend]).length > 0;
}

export interface DayTrendTagsInput { trends: string[]; rows: NameRow[]; lang?: Lang }

/** Boş gün etiketleri: futbol trendleri → günün turnuvaları → o turnuvaların takımları (tekil, ≤20). */
export function dayTrendTags({ trends, rows }: DayTrendTagsInput, max = DAY_TREND_MAX_EXTRA): string[] {
  const out: string[] = []; const seen = new Set<string>();
  const push = (tag: string | null) => { if (!tag) return; const k = norm(tag); if (!seen.has(k) && out.length < max) { seen.add(k); out.push(tag); } };
  for (const t of trends) if (isFootballTrend(t, rows)) push(trendTag(t));
  // Günün turnuvaları: öncelik sırası (uluslararası önce, sonra kulüp ligleri), eşitse maç sayısı.
  const byComp = new Map<number, { n: number; rows: NameRow[] }>();
  for (const r of rows) {
    const i = competitionIndex(r);
    if (i < 0) continue;
    const e = byComp.get(i) ?? { n: 0, rows: [] }; e.n++; e.rows.push(r); byComp.set(i, e);
  }
  const comps = [...byComp.entries()].sort((a, b) => a[0] - b[0] || b[1].n - a[1].n);
  for (const [i] of comps.slice(0, 4)) for (const tag of competitionTags(i)) push(tag);
  // Takımlar: öncelikli turnuvalardan, büyük kulüpler önce; en fazla 6.
  const teams: string[] = [];
  for (const [, e] of comps) for (const r of e.rows) for (const name of [r.homeName, r.awayName]) if (!teams.includes(name)) teams.push(name);
  const big = (n: string) => BIG_CLUBS.some((c) => norm(n).includes(norm(c)));
  const teamTags = teams.sort((a, b) => Number(big(b)) - Number(big(a))).map((n) => trendTag(n)).filter((t): t is string => !!t);
  let added = 0;
  for (const t of teamTags) { if (added >= 6) break; const before = out.length; push(t); if (out.length > before) added++; }
  return out;
}
