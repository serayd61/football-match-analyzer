import { routing } from '@/i18n/routing';

// Anonim ISR ayrımı (2026-11-08, Core Web Vitals) — saf fonksiyon, kenar
// çalışma zamanında (middleware) kullanılır, DB/çerez okumaz, birim testli.
//
// Herkese açık maç sayfası artık iki rotada duruyor:
//   /{locale}/matches/{slug}      ISR + CDN, access = ANON_ACCESS   (anonim)
//   /{locale}/m/matches/{slug}    force-dynamic, gerçek oturum      (üye)
// Middleware, oturum çerezi (ya da Play `fa_twa` çerezi) olan isteği
// ikincisine **rewrite** eder: adres çubuğunda temiz URL kalır, CDN anahtarı
// URL olduğu için anonim yanıt hiç kimseye özel veri taşımaz.
//
// Gün merkezleri (/matches/today|tomorrow|yesterday|yyyy-mm-dd) de buradan
// geçer: çıktıları oturuma bağlı değil, ama tek bir kuralın iki dalı olmaması
// hatayı azaltıyor ve üye sayısı çok küçük (aktif Pro 0, 292 kayıt).

/**
 * Middleware'in rewrite'a eklediği istek başlığı. Üye sayfası bununla
 * "rewrite ile geldim" ile "/{l}/m/… elle yazıldı"yı ayırt eder: ilkinde
 * ziyaretçinin adres çubuğunda temiz (indekslenebilir) URL var, ikincisinde
 * kopya bir URL — yalnız ikincisi noindex alır.
 */
export const MEMBER_REWRITE_HEADER = 'x-fa-member-rewrite';

/** Üye rotasının `[locale]` altındaki ön eki (bkz. app/(site)/[locale]/m/). */
export const MEMBER_SEGMENT = 'm';

const LOCALE_RX = `(${routing.locales.join('|')})`;
/** /{locale}/matches/{slug} — sondaki eğik çizgi kabul, boş slug hariç. */
const MATCH_PATH = new RegExp(`^/${LOCALE_RX}/matches/(?!${MEMBER_SEGMENT}/)([^/]+)/?$`);

/**
 * Üye isteği için rewrite hedefi, yoksa null.
 *
 * Döngü koruması: zaten `/{locale}/m/...` altındaysak null döner, yoksa
 * middleware kendi hedefini tekrar yazardı.
 */
export function memberRewritePath(path: string): string | null {
  if (isMemberPath(path)) return null;
  const m = MATCH_PATH.exec(path);
  if (!m) return null;
  const [, locale, slug] = m;
  return `/${locale}/${MEMBER_SEGMENT}/matches/${slug}`;
}

/** Yol üye (rewrite hedefi) ağacında mı? */
export function isMemberPath(path: string): boolean {
  return new RegExp(`^/${LOCALE_RX}/${MEMBER_SEGMENT}(/|$)`).test(path);
}
