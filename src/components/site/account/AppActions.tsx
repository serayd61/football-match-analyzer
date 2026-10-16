'use client';

// Account → Settings rows added after the Testers Community report (2026-10-16):
// share the app, rate it on Google Play, send feedback, re-open the tour.
// Share uses the Web Share API with a copy-link fallback (Android WebView has
// no navigator.share, so inside the Play app the link is copied). All targets
// come from lib/site/app-links.ts; events go through lib/analytics.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Share2, Star, MessageSquare, Compass } from 'lucide-react';
import { useIsTwa } from '@/lib/site/twa-client';
import { buildShareTarget, rateUrl, shareOrCopy } from '@/lib/site/app-links';
import { trackEvent, Events } from '@/lib/analytics';
import { legacyHref } from '@/lib/site/legacy';
import { requestOnboarding } from '@/components/site/Onboarding';

const secondary = 'inline-flex h-10 items-center gap-2 rounded-[2px] border border-s-line px-4 text-sm font-medium hover:border-s-muted disabled:opacity-60';

export function ShareAppButton({ location = 'account' }: { location?: string }) {
  const t = useTranslations('app');
  const locale = useLocale();
  const inApp = useIsTwa();
  const [status, setStatus] = useState<'' | 'copied' | 'failed'>('');

  async function share() {
    trackEvent(Events.APP_SHARE_CLICKED, { location, in_app: inApp });
    const target = buildShareTarget(locale, inApp, t('shareTitle'), t('shareText'));
    const out = await shareOrCopy(target, typeof navigator !== 'undefined' ? (navigator as any) : {});
    setStatus(out === 'copied' ? 'copied' : out === 'failed' ? 'failed' : '');
    if (out === 'copied' || out === 'failed') setTimeout(() => setStatus(''), 4000);
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={share} className={secondary} data-testid="share-app">
        <Share2 size={16} aria-hidden />{t('shareApp')}
      </button>
      <span role="status" aria-live="polite" className={`text-xs ${status === 'failed' ? 'text-s-loss' : 'text-s-muted'}`}>
        {status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : ''}
      </span>
    </span>
  );
}

export function RateAppLink({ location = 'account' }: { location?: string }) {
  const t = useTranslations('app');
  const inApp = useIsTwa();
  return (
    <a
      href={rateUrl(inApp)}
      target={inApp ? undefined : '_blank'}
      rel="noopener noreferrer"
      onClick={() => trackEvent(Events.APP_REVIEW_CLICKED, { location, in_app: inApp })}
      className={secondary}
      data-testid="rate-app"
    >
      <Star size={16} aria-hidden />{t('rateApp')}
    </a>
  );
}

export function FeedbackLink({ location = 'account' }: { location?: string }) {
  const t = useTranslations('app');
  const locale = useLocale();
  return (
    <a href={legacyHref('/contact', locale)} onClick={() => trackEvent(Events.FEEDBACK_OPENED, { location })} className={secondary} data-testid="send-feedback">
      <MessageSquare size={16} aria-hidden />{t('sendFeedback')}
    </a>
  );
}

export function ShowTourButton() {
  const t = useTranslations('app');
  return (
    <button type="button" onClick={() => requestOnboarding('settings')} className={secondary} data-testid="show-tour">
      <Compass size={16} aria-hidden />{t('showTour')}
    </button>
  );
}
