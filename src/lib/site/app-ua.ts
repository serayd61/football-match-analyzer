// ============================================================================
// Play uygulaması kimliği — saf (test edilir). 2026-11-15
// ----------------------------------------------------------------------------
// Neden: kayıtların kaçı uygulamadan geliyor ve kullanıcı hangi sürümde, bilinmiyordu
// (profilde kaynak yok, Vercel logları 1 gün). "İndirme çok, abonelik yok" sorusu
// bu yüzden web ve uygulama için ayrı cevaplanamıyordu. Satın alma köprüsü yalnız
// 1.3.0+ sürümde var; sürüm dağılımı "kaç kişi satın alamıyor" demek.
//
// Kaynak: WebView user-agent'a `FootballAnalyticsPro/<sürüm> (Android WebView)`
// ekler (android-app MainActivity.UA_SUFFIX). İlk TWA sürümü eklemiyordu; onu
// yalnız `fa_twa` çerezi ele verir → kaynak 'app', sürüm bilinmiyor.
// ============================================================================
export type SignupSource = 'app' | 'web';

const UA_RX = /FootballAnalyticsPro\/(\d{1,3}(?:\.\d{1,4}){0,3})/;

/** UA'daki uygulama imzası. `version` yalnız imza sürüm taşıyorsa dolu. */
export function parseAppUa(ua: string | null | undefined): { app: boolean; version: string | null } {
  const s = ua || '';
  const m = UA_RX.exec(s);
  if (m) return { app: true, version: m[1] };
  return { app: s.includes('FootballAnalyticsPro/'), version: null };
}

/** İstek uygulamadan mı geldi: UA imzası ya da (eski TWA için) `fa_twa` çerezi. */
export function appSignalOf(ua: string | null | undefined, twaCookie: boolean): { source: SignupSource; appVersion: string | null } {
  const p = parseAppUa(ua);
  return p.app || twaCookie ? { source: 'app', appVersion: p.version } : { source: 'web', appVersion: null };
}

/** Bu sürüm uygulama içi satın almayı (Play Billing köprüsü, 1.3.0+) taşıyor mu? Sürüm bilinmiyorsa null. */
export function appSellsPro(version: string | null | undefined): boolean | null {
  if (!version) return null;
  const [a = 0, b = 0] = version.split('.').map((x) => parseInt(x, 10) || 0);
  return a > 1 || (a === 1 && b >= 3);
}
