// ============================================================================
// Günün ücretsiz maçları — erişim kuralı (saf, test edilir). 2026-11-14
// ----------------------------------------------------------------------------
// Karar (kullanıcı, 2026-11-14): o gün Telegram'da ve geri kazanım e-postasında
// yayınlanan ücretsiz maçlar (en çok 3), DENEMESİ BİTMİŞ ÜYEYE tam analizle
// açılır. Ziyaretçiye açılmaz (kayıt olması gerekir); diğer maçlar, yapay zeka
// yorumu ve kupon Pro'da kalır.
//
// Kaynak: social_posts'ta `posted` durumundaki günlük gönderi (kind=daily) ve
// e-postanın kendi kaydı (kind=winback) — yani yalnız GERÇEKTEN yayınlanmış
// liste. Sayfa günün seçimlerini kendisi hesaplamaz: getDailyPicks(bugün) seçim
// yoksa üretip dondurur, sayfa açılışı üretim saatini değiştirmemeli.
//
// Dün yayınlanan maç bugün de açık kalır: e-postayı ertesi gün açan üye
// bağlantıya tıklayınca duvara çarpmasın (o maç zaten sonuçlanmıştır).
// ============================================================================
import type { SiteAccessState } from './access-state';

/** social_posts.kind değerleri: günlük gönderi ve geri kazanım e-postasının kaydı. */
export const FREE_KINDS = ['daily', 'winback'] as const;

export interface FreePostRow { kind?: string | null; day?: string | null; status?: string | null; fixture_ids?: unknown }
export interface FreeFixtures {
  /** bugünün listesi (uygulamadaki "bugün açık" bloğu) */ today: number[];
  /** kapının açtığı her maç: bugün + dün */ open: number[];
}

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);

/** Yayın kayıtlarından ücretsiz maçlar. `yesterday` verilmezse yalnız bugün sayılır. */
export function freeFromPosts(rows: FreePostRow[], today: string, yesterday?: string): FreeFixtures {
  const t = new Set<number>(), o = new Set<number>();
  for (const r of rows) {
    if (r.status !== 'posted' || !(FREE_KINDS as readonly string[]).includes(String(r.kind))) continue;
    const day = String(r.day ?? '').slice(0, 10);
    if (day !== today && day !== yesterday) continue;
    for (const id of ids(r.fixture_ids)) { o.add(id); if (day === today) t.add(id); }
  }
  return { today: [...t], open: [...o] };
}

/** Ücretsiz görünüm kime: yalnız denemesi bitmiş üye. Deneme/Pro zaten her şeyi görür, ziyaretçi kilitli kalır. */
export function freeViewFor(state: SiteAccessState, isFree: boolean): boolean {
  return state === 'expired' && isFree;
}
