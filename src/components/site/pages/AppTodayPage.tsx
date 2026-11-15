import type { ReactNode } from 'react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Page } from '@/components/site/ui';
import { Crest } from '@/components/site/PredictionTable';
import LocalTime from '@/components/site/LocalTime';
import AppPlansLink from '@/components/site/AppPlansLink';
import { TrialNotice } from '@/components/site/Paywall';
import { REGISTER_HREF, SIGNIN_HREF } from '@/lib/site/auth-links';
import { canSeeMatches, type SiteAccess } from '@/lib/site/access-state';
import { listDay } from '@/lib/site/fixtures';
import { getPrediction, nextDayWithPredictions, type SitePrediction } from '@/lib/site/predictions';
import { showcaseRecord } from '@/lib/site/showcase';
import { freeFixtures, freeLegsToday, type FreeLeg } from '@/lib/site/free-today';
import { APP_TODAY_RECORD_WINDOWS, legLabelKey, planAppToday, recordEnough } from '@/lib/site/app-today-rule';
import { matchPath } from '@/lib/site/match-public';
import { touchSeen } from '@/lib/site/seen';
import { todayYmd, zonedStartOfDay } from '@/lib/site/time';

// ============================================================================
// Uygulamanın açılış ekranı "Bugün" (2026-11-15) — yalnız Play uygulamasında
// (m/page.tsx, fa_twa). Kural ve gerekçe: lib/site/app-today-rule.ts.
//
// Tanıtım sayfası (HomePage) yerine: tarih, son 7 günün herkese açık karnesi,
// günün ücretsiz maçları rakamıyla, günün diğer maçları. Deneme/Pro üyesi tam
// listeyi görür: `memberHero` üye rotasından prop olarak gelir (HomeMemberHero
// yalnız m/page.tsx'ten import edilir, tests/isr-anon-tree). Web'de ana sayfa değişmedi.
//
// Satın alma bağlantısı her zaman <AppPlansLink>: Play Billing varsa planlar,
// eski sürümde "uygulamayı güncelle"; web ödeme bağlantısı yok (Play politikası).
// ============================================================================
export default async function AppTodayPage({ locale, access, memberHero = null }: { locale: string; access: SiteAccess; memberHero?: ReactNode }) {
  const today = todayYmd();
  const unlocked = canSeeMatches(access);
  const [t, tp, tc, f, day, free, legs, recordShort] = await Promise.all([
    getTranslations({ locale, namespace: 'appToday' }),
    getTranslations({ locale, namespace: 'paywall' }),
    getTranslations({ locale, namespace: 'common' }),
    getFormatter({ locale }),
    listDay(today).catch(() => null),
    unlocked ? Promise.resolve({ today: [] as number[], open: [] as number[] }) : freeFixtures(),
    unlocked ? Promise.resolve([] as FreeLeg[]) : freeLegsToday(),
    showcaseRecord(APP_TODAY_RECORD_WINDOWS[0]).catch(() => null),
    // uygulama açılışı = aktivasyon izi (süresi dolmuş üye de sayılır; yalnız panel sayılıyordu)
    touchSeen(access.email),
  ]);

  const rows = (day?.rows ?? []).filter((r) => r.covered && r.hasModel);
  const byId = new Map(rows.map((r) => [r.fixtureId, r] as const));
  const plan = planAppToday(access.state, rows, free.today);
  // Ücretsiz maç günün kapsam listesinde olmayabilir (kapsam dışı lig) → tek tek oku.
  const freeRows = (await Promise.all(plan.free.map((id) => byId.get(id) ?? getPrediction(id).catch(() => null))))
    .filter((p): p is SitePrediction => !!p)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const legOf = new Map(legs.map((l) => [l.fixtureId, l] as const));
  const lockedRows = plan.locked.map((id) => byId.get(id)).filter((p): p is SitePrediction => !!p);
  const empty = plan.mode === 'member' ? !memberHero : freeRows.length === 0 && lockedRows.length === 0;
  const nextDay = empty ? await nextDayWithPredictions(today).catch(() => null) : null;
  const anon = access.state === 'anon';
  // ince hafta (milli ara): 7 günlük pencere eşiğin altındaysa 30 güne düş
  const record = recordEnough(recordShort) ? recordShort : await showcaseRecord(APP_TODAY_RECORD_WINDOWS[1]).catch(() => null);
  const showRecord = recordEnough(record);

  /** Kartta büyük rakam: yayınlanan seçim; kayıt bulunamazsa modelin 1X2 tercihi. */
  const headline = (p: SitePrediction): { pct: number; label: string } | null => {
    const l = legOf.get(p.fixtureId);
    if (l) return { pct: Math.round(l.modelP * 100), label: t(legLabelKey(l.market, l.selection), { home: p.homeName, away: p.awayName }) };
    const conf = p.confidence ?? p.confidenceRaw;
    if (!p.pick || p.noFavourite || conf == null) return null;
    return { pct: Math.round(conf * 100), label: t(legLabelKey('1x2', p.pick), { home: p.homeName, away: p.awayName }) };
  };

  return (
    <Page>
      <header className="pt-6">
        <p className="kicker">{f.dateTime(zonedStartOfDay(today), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-[34px] leading-tight">{t('title')}</h1>
          {/* sayı başlıkta yalnız liste başlığı onu söylemiyorsa (üye görünümü, ücretsiz maçlı gün) */}
          {plan.total > 0 && (plan.mode === 'member' || freeRows.length > 0) && <p className="num text-[14px] text-s-muted">{t('rated', { n: plan.total })}</p>}
        </div>
        {showRecord && (
          <Link href="/performance" data-cta="app-today-record" className="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-s-line bg-s-surface px-3.5 py-2.5 text-[14px] hover:bg-s-raised/60">
            <span><span className="font-semibold text-s-win">{t('record', { days: record!.days, won: record!.won, n: record!.n })}</span> <span className="text-s-muted">{t('recordNote')}</span></span>
            <span aria-hidden className="shrink-0 text-s-muted">→</span>
          </Link>
        )}
      </header>

      {access.state === 'trial' && <div className="pt-4"><TrialNotice access={access} /></div>}

      {plan.mode === 'member' ? (
        <div className="pt-5">
          {memberHero}
          {memberHero && <Link href="/predictions" className="btn btn-primary btn-block mt-4" data-cta="app-today-all">{t('allPredictions')}</Link>}
        </div>
      ) : (
        <>
          {freeRows.length > 0 && (
            <section className="pt-6" aria-labelledby="app-free-title">
              <p className="kicker !text-s-accent-700">{tp('freeKicker')}</p>
              <h2 id="app-free-title" className="mt-1 text-[20px]">{t('freeTitle', { n: freeRows.length })}</h2>
              <ul className="mt-3 space-y-2.5">
                {freeRows.map((p) => {
                  const h = headline(p);
                  return (
                    <li key={p.fixtureId}>
                      <Link href={`/predictions/${p.fixtureId}`} data-cta="app-today-free" className="block rounded-[14px] border border-s-accent/40 bg-s-surface px-4 py-3.5 shadow-[var(--s-shadow)] hover:bg-s-raised/50">
                        <span className="flex items-center justify-between gap-3 text-[12.5px] text-s-muted">
                          <span className="min-w-0 truncate"><LocalTime iso={p.kickoff} format="time" /> · {p.leagueName}</span>
                          <span className="tag tag-accent shrink-0">{tp('freeKicker')}</span>
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-3">
                          <span className="min-w-0 space-y-1">
                            <span className="flex items-center gap-2 text-[16px] font-semibold"><Crest src={p.homeCrest} alt={tc('crestAlt', { team: p.homeName })} /><span className="min-w-0 [overflow-wrap:anywhere]">{p.homeName}</span></span>
                            <span className="flex items-center gap-2 text-[16px] font-semibold"><Crest src={p.awayCrest} alt={tc('crestAlt', { team: p.awayName })} /><span className="min-w-0 [overflow-wrap:anywhere]">{p.awayName}</span></span>
                          </span>
                          {h && (
                            <span className="shrink-0 text-right">
                              <span className="num block text-[34px] font-extrabold leading-none text-s-accent-700">{h.pct}%</span>
                              <span className="mt-1 block max-w-[130px] text-[12.5px] font-semibold leading-tight">{h.label}</span>
                            </span>
                          )}
                        </span>
                        <span className="mt-2.5 block text-[13px] font-semibold text-s-accent">{anon ? t('freeOpenAnon') : tp('freeOpen')} →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {lockedRows.length > 0 && (
            <section className="pt-7" aria-labelledby="app-more-title">
              <h2 id="app-more-title" className="text-[18px]">{freeRows.length > 0 ? t('moreTitle', { n: lockedRows.length + plan.more }) : t('ratedTitle', { n: lockedRows.length + plan.more })}</h2>
              <ul className="mt-3 divide-y divide-s-line rounded-[12px] border border-s-line bg-s-surface">
                {lockedRows.map((p) => (
                  <li key={p.fixtureId}>
                    <Link href={anon ? matchPath(p) : `/predictions/${p.fixtureId}`} data-cta="app-today-locked" className="flex items-center gap-3 px-3.5 py-3 hover:bg-s-raised/60">
                      <LocalTime iso={p.kickoff} format="time" className="w-11 shrink-0 text-[13px] text-s-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold [overflow-wrap:anywhere]">{p.homeName} – {p.awayName}</span>
                        <span className="block truncate text-[12.5px] text-s-muted">{p.leagueName}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-s-line px-2.5 py-1 text-[12px] font-semibold text-s-muted">{t('locked')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {plan.more > 0 && <p className="mt-2 text-[13px] text-s-muted">{t('andMore', { n: plan.more })}</p>}
            </section>
          )}

          {!empty && (
            <section className="mt-6 rounded-[14px] border border-s-line bg-s-surface p-5">
              <p className="text-[16px] font-semibold">{anon ? t('ctaTitleAnon') : t('ctaTitleExpired')}</p>
              <p className="mt-1 text-[13.5px] text-s-muted">{anon ? t('ctaLeadAnon') : freeRows.length > 0 ? t('ctaLeadExpired') : t('ctaLeadExpiredNoFree')}</p>
              <div className="mt-4 flex flex-col gap-2.5">
                {anon ? (
                  <>
                    <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-primary btn-lg btn-block" data-cta="app-today-register">{t('ctaAnon')}</Link>
                    <Link href={SIGNIN_HREF} rel="nofollow" className="text-center text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
                  </>
                ) : (
                  <AppPlansLink plans={tp('expiredCta')} update={tp('appUpdateCta')} className="btn btn-primary btn-lg btn-block" location="app_today_app" />
                )}
              </div>
            </section>
          )}
        </>
      )}

      {empty && (
        <section className="mt-6 rounded-[14px] border border-s-line bg-s-surface p-5">
          <p className="text-[16px] font-semibold">{t('emptyTitle')}</p>
          <p className="mt-1 text-[13.5px] text-s-muted">{nextDay ? t('emptyNext', { day: f.dateTime(zonedStartOfDay(nextDay), { weekday: 'long', day: 'numeric', month: 'long' }) }) : t('emptyLead')}</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {unlocked
              ? <Link href={nextDay ? `/predictions?date=${nextDay}` : '/predictions'} className="btn btn-primary btn-block" data-cta="app-today-next">{t('emptyCta')}</Link>
              : <Link href="/matches" className="btn btn-primary btn-block" data-cta="app-today-week">{t('emptyCta')}</Link>}
            {anon && <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-secondary btn-block" data-cta="app-today-register">{t('ctaAnon')}</Link>}
            {access.state === 'expired' && <AppPlansLink plans={tp('expiredCta')} update={tp('appUpdateCta')} className="btn btn-secondary btn-block" location="app_today_empty_app" />}
          </div>
        </section>
      )}

      <p className="rule-t mt-10 pt-4 text-xs text-s-muted">{tp('expiredNote')}</p>
    </Page>
  );
}
