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

export const SITE = 'https://footballanalytics.pro';
const TZ: Record<Lang, string> = { tr: 'Europe/Istanbul', en: 'Europe/Zurich' };
const TZ_LABEL: Record<Lang, string> = { tr: 'TSİ', en: 'CET' };

export const utm = (path: string, lang: Lang, campaign: string, source = 'twitter') =>
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
  daily.forEach(push);
  showcase.filter((l) => l.market !== '1x2').sort((a, b) => b.modelP - a.modelP).forEach(push);
  showcase.filter((l) => l.market === '1x2').sort((a, b) => b.modelP - a.modelP).forEach(push);
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/** Tweet uzunluğu: URL'ler 23 sayılır. */
export function tweetLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
}

export function dailyText(legs: Leg[], ymd: string, lang: Lang, record: { n: number; won: number } | null): string {
  const head = lang === 'tr' ? `Günün seçimleri · ${fmtDate(ymd, lang)}` : `Today's picks · ${fmtDate(ymd, lang)}`;
  const lines = legs.map((l) => {
    const odds = l.odds ? ` · ${fmtOdds(l.odds, lang)}` : '';
    return `${fmtTime(l.kickoff, lang)} ${l.homeName} – ${l.awayName}: ${marketLabel(l, lang)} · ${lang === 'tr' ? 'model' : 'model'} ${pct(l.modelP)}${odds}`;
  });
  const rec = record && record.n ? (lang === 'tr' ? `Son 7 gün: ${record.won}/${record.n}` : `Last 7 days: ${record.won}/${record.n}`) : '';
  const link = utm('/predictions', lang, 'daily-pick');
  let text = [head, '', ...lines, '', rec, link].filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\n');
  // sığmazsa bacak satırlarını kısalt (takım adı 14 karakter), yine sığmazsa son bacağı at
  if (tweetLength(text) > 280) {
    const short = legs.map((l) => `${fmtTime(l.kickoff, lang)} ${l.homeName.slice(0, 14)} – ${l.awayName.slice(0, 14)}: ${marketLabel(l, lang)} ${pct(l.modelP)}`);
    text = [head, '', ...short, '', rec, link].filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\n');
  }
  while (tweetLength(text) > 280 && legs.length > 1) { legs = legs.slice(0, -1); return dailyText(legs, ymd, lang, record); }
  return text;
}

export function resultText(leg: Leg, h: number, a: number, won: boolean, lang: Lang): string {
  const mark = won ? '✓' : '✗';
  return lang === 'tr'
    ? `${leg.homeName} ${h}-${a} ${leg.awayName} · ${marketLabel(leg, lang)} ${mark}`
    : `${leg.homeName} ${h}-${a} ${leg.awayName} · ${marketLabel(leg, lang)} ${mark}`;
}

export interface WeeklyStats { from: string; to: string; n: number; won: number; byMarket: Record<string, { n: number; won: number }>; noPick: number }

export function weeklyText(s: WeeklyStats, lang: Lang): string[] {
  const rate = s.n ? Math.round((s.won / s.n) * 100) : 0;
  const mk = (k: string) => s.byMarket[k] ?? { n: 0, won: 0 };
  const range = `${fmtDate(s.from, lang)} – ${fmtDate(s.to, lang)}`;
  const link = utm('/performance', lang, 'weekly-record');
  if (lang === 'tr') return [
    `Haftalık karne · ${range}\n\nVitrin seçimleri: ${s.won}/${s.n} (%${rate})\n1X2 ${mk('1x2').won}/${mk('1x2').n} · Üst 2,5 ${mk('ou25').won}/${mk('ou25').n} · KG ${mk('btts').won}/${mk('btts').n}\nSeçim yok denilen maç: ${s.noPick}`,
    `Her seçim maçtan en az 3 saat önce dondurulur ve sonuç ne olursa olsun yazılır. Tüm karne ve pazar bazında ayrıntı: ${link}`,
  ];
  return [
    `Weekly record · ${range}\n\nShowcase picks: ${s.won}/${s.n} (${rate}%)\n1X2 ${mk('1x2').won}/${mk('1x2').n} · Over 2.5 ${mk('ou25').won}/${mk('ou25').n} · BTTS ${mk('btts').won}/${mk('btts').n}\nNo-pick calls: ${s.noPick}`,
    `Every pick is frozen at least 3 hours before kick-off and recorded whatever the result. Full record by market: ${link}`,
  ];
}
