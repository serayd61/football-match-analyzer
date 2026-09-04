'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

// Collapsible card that hosts the legacy Match Intelligence (LLM) widget and
// the chatbot. Both are dark-themed legacy components with their own data
// fetching; they are loaded only when the card is opened so the dashboard's
// first paint stays light. LanguageProvider is required by the chatbot.
const MatchIntelligence = dynamic(() => import('@/components/MatchIntelligence'), { ssr: false });
const AIChatbot = dynamic(() => import('@/components/AIChatbot'), { ssr: false });
const LanguageProvider = dynamic(() => import('@/components/LanguageProvider').then((m) => m.LanguageProvider), { ssr: false });

export default function IntelCard({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const lang = ['tr', 'en', 'de'].includes(locale) ? locale : 'en';

  return (
    <section className="rounded-sm border border-s-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="intel-panel"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <span>
          <span className="block font-medium">{t('intelTitle')}</span>
          <span className="block text-xs text-s-muted">{t('intelLead')}</span>
        </span>
        <span className="text-xs text-s-muted">{open ? t('collapse') : t('expand')}</span>
      </button>
      {open && (
        <div id="intel-panel" className="border-t border-s-line bg-[#0b1016] p-4 text-white" style={{ colorScheme: 'dark' }}>
          <LanguageProvider>
            <MatchIntelligence lang={lang} limit={12} />
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setChat((v) => !v)} className="rounded-sm border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
                {t('chatOpen')}
              </button>
            </div>
            <AIChatbot isOpen={chat} onToggle={() => setChat((v) => !v)} />
          </LanguageProvider>
        </div>
      )}
    </section>
  );
}
