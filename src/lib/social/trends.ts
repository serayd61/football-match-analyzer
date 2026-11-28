// ============================================================================
// Günün trendleri — ücretsiz kaynak: Google Trends günlük RSS (anahtar gerekmez)
// ----------------------------------------------------------------------------
// X trend ucu 2026-11'den beri boş dönüyor (API kredisi 402). Google'ın
// trends.google.com/trending/rss?geo=XX beslemesi o günün arama trendlerini
// verir; ülke seti SOCIAL_TREND_GEOS ile değişir (varsayılan GB,DE,TR — hedef
// pazarlar + Instagram dili). Hepsi best-effort: hata/zaman aşımı → boş liste.
// Futbolla ilgisizleri ayıklamak content.ts'teki dayTrendTags'in işi.
// ============================================================================

export const DEFAULT_TREND_GEOS = ['GB', 'DE', 'TR'];

export function trendGeos(env = process.env.SOCIAL_TREND_GEOS): string[] {
  const list = (env || '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
  return list.length ? [...new Set(list)] : DEFAULT_TREND_GEOS;
}

/** RSS metninden trend başlıklarını çeker (ilk <title> kanal adıdır, atlanır). */
export function parseTrendsRss(xml: string): string[] {
  const out: string[] = [];
  const re = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?<\/title>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = m[1].replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

export async function fetchGoogleTrends(geos: string[] = trendGeos(), fetcher: typeof fetch = fetch): Promise<string[]> {
  const out: string[] = [];
  for (const geo of geos) {
    try {
      const r = await fetcher(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fa-social/1.0)', Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      } as RequestInit);
      if (!r.ok) continue;
      for (const t of parseTrendsRss(await r.text())) if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    } catch { /* etiketsiz devam */ }
  }
  return out;
}
