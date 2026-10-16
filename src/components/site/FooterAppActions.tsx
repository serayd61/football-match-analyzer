'use client';

// Footer row shown only inside the Google Play app (fa_twa cookie): share /
// rate / feedback without needing an account. On the web the footer already
// has its link columns, so nothing renders. Testers Community feedback 2026-10-16.
import { useTranslations } from 'next-intl';
import { useIsTwa } from '@/lib/site/twa-client';
import { ShareAppButton, RateAppLink, FeedbackLink } from '@/components/site/account/AppActions';

export default function FooterAppActions() {
  const inApp = useIsTwa();
  const t = useTranslations('account');
  if (!inApp) return null;
  return (
    <div className="border-t border-s-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6" aria-label={t('app')}>
        <ShareAppButton location="footer" />
        <RateAppLink location="footer" />
        <FeedbackLink location="footer" />
      </div>
    </div>
  );
}
