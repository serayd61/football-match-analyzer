// ============================================================================
// MODEL KAPSAMI — "modelini eğitmediğin ligde tahmin yayınlama" kuralı.
// ----------------------------------------------------------------------------
// Ölçüm (2026-08-11, 3.737 sonuçlanmış tahmin): tahminlerin %99.8'i
// dc_model_params'ta KARŞILIĞI OLMAYAN 242 ligden geliyordu ve isabet %49.4'te
// kalıyordu. Yani halka açık karne, Dixon-Coles motorunu değil jenerik yedeği
// ölçüyordu. Bu modül, yayın yüzeylerinin yalnızca fit edilmiş ligleri
// göstermesini sağlar.
//
// Eşleşme neden ad+ülke? Feed maçlarda SEZONLUK lig id'si taşıyor (Eredivisie
// katalogda 937276, kanonik 57 değil — bkz. league-catalog). Kanonik id'ler
// yedek olarak tutulur; asıl anahtar `ad|ÜLKE`.
//
// Yeni lig eklerken SIRA: önce dc_model_params'a fit yaz, SONRA buraya ekle.
// ============================================================================

/** dc_model_params'taki football-data.org kodları ↔ feed'deki ad|ccode */
const COVERED_NAME_CCODE = new Set([
  'Premier League|ENG',   // PL
  'LaLiga|ESP',           // PD
  'Serie A|ITA',          // SA
  'Bundesliga|GER',       // BL1
  'Ligue 1|FRA',          // FL1
  'Champions League|INT', // CL
  'Eredivisie|NED',       // DED
  'Liga Portugal|POR',    // PPL
  'Championship|ENG',     // ELC
  'Brazilian Serie A|BRA', // BSA
]);

/** Kanonik FotMob id'leri — ad çözümlenemediğinde yedek eşleşme. */
const COVERED_IDS = new Set([47, 87, 55, 54, 53, 42, 57, 61, 48, 268]);

/**
 * Bu maç, parametreleri fit edilmiş bir ligde mi?
 * leagueName katalogdan onarılmış ad olmalı ("League 12345" değil).
 */
export function isModelCovered(
  leagueName?: string | null,
  leagueId?: number | null,
  ccode?: string | null,
): boolean {
  if (leagueId != null && COVERED_IDS.has(Number(leagueId))) return true;
  const name = (leagueName || '').trim();
  const cc = (ccode || '').trim().toUpperCase();
  if (!name || !cc) return false;
  return COVERED_NAME_CCODE.has(`${name}|${cc}`);
}

/**
 * Yalnızca ADA göre kapsam kontrolü — ülke kodu taşımayan yüzeyler için
 * (örn. SEO analiz sayfaları: `smart_analysis.league` düz bir metin).
 * Tam eşleşme aranır; "Russian Premier League" gibi adlar eşleşmez.
 * "Serie A" hem İtalya hem Brezilya'yı gösterebilir ama ikisi de kapsamda.
 */
const COVERED_NAMES = new Set(
  Array.from(COVERED_NAME_CCODE).map((k) => k.split('|')[0]),
);
const NAME_ALIASES: Record<string, string> = {
  'Brasileirão': 'Brazilian Serie A',
  'Brasileirao': 'Brazilian Serie A',
  'Campeonato Brasileiro Série A': 'Brazilian Serie A',
  'Primera División': 'LaLiga',
  'La Liga': 'LaLiga',
  'UEFA Champions League': 'Champions League',
  'EFL Championship': 'Championship',
  'Primeira Liga': 'Liga Portugal',
};
export function isCoveredLeagueName(leagueName?: string | null): boolean {
  const raw = (leagueName || '').trim();
  if (!raw) return false;
  return COVERED_NAMES.has(NAME_ALIASES[raw] || raw);
}

/** Arayüzde "neden bu lig yok?" sorusuna cevap veren liste. */
export const COVERED_LEAGUE_LABELS = [
  'Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1',
  'Champions League', 'Eredivisie', 'Liga Portugal', 'Championship',
  'Brasileirão',
];
