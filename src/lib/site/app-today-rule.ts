// ============================================================================
// Uygulamanın açılış ekranı "Bugün" — saf kural (test edilir). 2026-11-15
// ----------------------------------------------------------------------------
// Neden: 29 Eki–15 Kas arası denemesi biten 79 üyenin 54'ü yalnız kayıt günü
// görüldü. Uygulama tanıtım sayfasıyla açılıyordu: maç yok, rakam yok. Kullanıcı
// kararı (2026-11-15): uygulama günün maçlarıyla açılsın; günün ücretsiz maçları
// (Telegram'da yayınlanan liste) uygulamada ZİYARETÇİYE de rakamıyla görünsün.
//
// Erişim sınırı değişmedi: ziyaretçi kartta yalnız yayınlanmış seçimi ve model
// olasılığını görür (Telegram'da herkese açık olan bilgi). Tam analiz sayfası
// ziyaretçiye hâlâ kayıt duvarı, denemesi bitene ücretsiz maçta açık
// (free-today-rule.ts). Diğer maçlar satır olarak görünür, rakamsız ve kilitli.
// ============================================================================
import type { SiteAccessState } from './access-state';

export interface TodayRow { fixtureId: number; kickoff: string }
export interface AppTodayPlan {
  /** 'member': deneme/Pro, tam liste rakamlarıyla. 'guest': ziyaretçi ya da süresi dolmuş. */
  mode: 'member' | 'guest';
  /** rakamıyla gösterilecek ücretsiz maçlar (yalnız guest) */ free: number[];
  /** rakamsız, kilitli gösterilecek maçlar (yalnız guest) */ locked: number[];
  /** kilitli listede gösterilmeyen maç sayısı */ more: number;
  /** günün modellenmiş maç sayısı */ total: number;
}

export const APP_TODAY_LOCKED_ROWS = 5;

export function planAppToday(state: SiteAccessState, rows: TodayRow[], freeIds: number[], now = Date.now(), maxLocked = APP_TODAY_LOCKED_ROWS): AppTodayPlan {
  const total = rows.length;
  if (state === 'trial' || state === 'pro') return { mode: 'member', free: [], locked: [], more: 0, total };
  const free = [...new Set(freeIds)];
  const freeSet = new Set(free);
  // Başlamamış maçlar önce (kick-off sırasıyla), başlamış/bitmişler sonra.
  const rest = rows.filter((r) => !freeSet.has(r.fixtureId)).sort((a, b) => {
    const ua = Date.parse(a.kickoff) > now ? 0 : 1, ub = Date.parse(b.kickoff) > now ? 0 : 1;
    return ua - ub || a.kickoff.localeCompare(b.kickoff);
  });
  const locked = rest.slice(0, maxLocked).map((r) => r.fixtureId);
  return { mode: 'guest', free, locked, more: rest.length - locked.length, total };
}

export type LegLabelKey = 'selOver25' | 'selBtts' | 'selHome' | 'selAway' | 'selDraw';

/** Yayınlanan seçimin çeviri anahtarı. Günün listesi gol pazarında yalnız "üst" ve "KG var" yayınlar. */
export function legLabelKey(market: string, selection: string): LegLabelKey {
  if (market === 'ou25') return 'selOver25';
  if (market === 'btts') return 'selBtts';
  return selection === '1' ? 'selHome' : selection === '2' ? 'selAway' : 'selDraw';
}
