// ============================================================================
// Örnek analiz seçimi — saf kural (testli)
// ----------------------------------------------------------------------------
// Neden (2026-10-13): ana sayfadaki "Örnek analizi gör" temsili bir karta
// ("Takım A / Takım B") çıpalıyordu. Ziyaretçiye artık GEÇMİŞTE gerçekten
// yayımlanmış, sonuçlanmış bir analiz gösterilir: üyenin maçtan önce gördüğü
// sayfanın aynısı, üstünde skor ve sonuç. Sonuçlanmış maçın ticari değeri
// kalmadığı için üyeye özel veri sızmaz; yaklaşan maçlar kapalı kalır.
//
// Seçim: kapsanan lig, resmi sürüm, skorla sonuçlanmış, seçim KAZANMIŞ,
// kalibre güven ≥ eşik, maçtan sonra yayımlanmamış, son N gün içinde.
// En yeni ilk; havuz birkaç maç tutar ki ana sayfa yenilenip örnek
// değiştiğinde eski bağlantı birkaç gün daha herkese açık kalsın.
// ============================================================================

export const SAMPLE_MIN_CONF = 0.6;
export const SAMPLE_WINDOW_DAYS = 45;
/** Aynı anda herkese açık tutulan örnek maç sayısı (en yeniden eskiye). */
export const SAMPLE_POOL = 5;

export interface SampleInput {
  fixtureId: number;
  kickoff: string;
  covered: boolean;
  hasLeague: boolean;
  settled: boolean;
  outcome: 'won' | 'lost' | 'void' | 'pending';
  confidence: number | null;
  homeScore: number | null;
  awayScore: number | null;
  publishedAfterKickoff: boolean;
}

export function sampleEligible(r: SampleInput, now = Date.now()): boolean {
  if (!r.covered || !r.hasLeague || !r.settled) return false;
  if (r.outcome !== 'won') return false;
  if (r.homeScore == null || r.awayScore == null) return false;
  if (r.publishedAfterKickoff) return false;
  if (r.confidence == null || r.confidence < SAMPLE_MIN_CONF) return false;
  const age = now - Date.parse(r.kickoff);
  return Number.isFinite(age) && age >= 0 && age <= SAMPLE_WINDOW_DAYS * 86_400_000;
}

/** Uygun satırlar, en yeni önce, en fazla `pool` adet. */
export function pickSamplePool<T extends SampleInput>(rows: T[], now = Date.now(), pool = SAMPLE_POOL): T[] {
  return rows
    .filter((r) => sampleEligible(r, now))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, pool);
}
