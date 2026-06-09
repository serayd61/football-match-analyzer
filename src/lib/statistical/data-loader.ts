// ============================================================================
// DATA LOADER — football-data.org'dan Dixon-Coles eğitimi için geçmiş maçlar
//
// NOT: Repo'da football-api.ts / COMPETITIONS objesi YOK. football-data.org
// istemcisi yalnızca match-results/providers.ts içinde (tarih aralığı endpoint'i)
// kullanılıyor. Eğitim için competition-bazlı endpoint'i burada tanımlıyoruz.
//
// ⚠️ Rate limit: ücretsiz plan 10 istek/dakika. İstekler arası 6.5s bekleme.
// ============================================================================

import { MatchRow } from './dixon-coles';

const BASE_URL = 'https://api.football-data.org/v4';

/**
 * Görünen lig adı → football-data.org competition kodu.
 * Yalnızca ücretsiz katmandaki ligler kapsanır; diğerleri (Süper Lig vb.) null döner.
 */
export const FD_COMPETITIONS: Record<string, string> = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Serie A': 'SA',
  'Bundesliga': 'BL1',
  'Ligue 1': 'FL1',
  'Champions League': 'CL',
  'Championship': 'ELC',
  'Eredivisie': 'DED',
  'Primeira Liga': 'PPL',
  'Brasileirão': 'BSA',
};

/** Kapsanan competition kodları (cron + backtest döngüsü için) */
export const FD_CODES: string[] = Array.from(new Set(Object.values(FD_COMPETITIONS)));

function normalizeLeagueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|cd)\b/g, '')
    .replace(/[^a-zçğıöşü0-9]/gi, '')
    .trim();
}

/** Görünen lig adını football-data.org koduna çevirir; kapsam dışı → null. */
export function leagueToCode(leagueName: string | null | undefined): string | null {
  if (!leagueName) return null;
  // Zaten kod verilmişse (PL, PD, ...) doğrudan kabul et
  if (FD_CODES.includes(leagueName)) return leagueName;
  // 1) Birebir
  if (FD_COMPETITIONS[leagueName]) return FD_COMPETITIONS[leagueName];
  // 2) case-insensitive + normalize
  const target = normalizeLeagueName(leagueName);
  for (const [name, code] of Object.entries(FD_COMPETITIONS)) {
    if (normalizeLeagueName(name) === target) return code;
  }
  // 3) içerik eşleşmesi (örn. "English Premier League")
  for (const [name, code] of Object.entries(FD_COMPETITIONS)) {
    const n = normalizeLeagueName(name);
    if (target.includes(n) || n.includes(target)) return code;
  }
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** football-data.org season parametresi: sezonun BAŞLANGIÇ yılı (Ağustos kuralı). */
export function currentSeasonStartYear(now = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  return m >= 7 ? y : y - 1;
}

interface FDMatch {
  status: string;
  utcDate: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

/** Tek sezonun FINISHED maçlarını çeker ve MatchRow[]'a map'ler. */
export async function fetchFinishedMatches(code: string, season: number): Promise<MatchRow[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY tanımlı değil — geçmiş maçlar çekilemez.');
  }

  const url = `${BASE_URL}/competitions/${code}/matches?season=${season}&status=FINISHED`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
    // Next.js fetch cache'ini kapat — cron her seferinde taze veri çeksin
    cache: 'no-store',
  });

  if (res.status === 429) {
    throw new Error(`football-data.org rate limit (429) — ${code}/${season}. 6.5s beklemeyi kontrol et.`);
  }
  if (!res.ok) {
    throw new Error(`football-data.org ${res.status} — ${code}/${season}`);
  }

  const data = (await res.json()) as { matches?: FDMatch[] };
  const matches = data.matches ?? [];

  const rows: MatchRow[] = [];
  for (const m of matches) {
    const h = m.score?.fullTime?.home;
    const a = m.score?.fullTime?.away;
    if (h === null || h === undefined || a === null || a === undefined) continue; // skoru yoksa atla
    rows.push({
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeGoals: h,
      awayGoals: a,
      date: m.utcDate,
    });
  }
  return rows;
}

/**
 * Mevcut + önceki sezonu çeker (≈2 istek). İstekler arası 6.5s bekleme ile
 * rate limit'e uyar. Hangi sezonların döndüğü `seasons` ile bildirilir.
 */
export async function loadTwoSeasons(
  code: string,
  now = new Date()
): Promise<{ matches: MatchRow[]; seasons: number[] }> {
  const cur = currentSeasonStartYear(now);
  const prev = cur - 1;

  const curMatches = await fetchFinishedMatches(code, cur);
  await sleep(6500); // ⏳ rate limit
  const prevMatches = await fetchFinishedMatches(code, prev);

  return {
    matches: [...prevMatches, ...curMatches],
    seasons: [prev, cur],
  };
}
