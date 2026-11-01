import { getTranslations } from 'next-intl/server';
import { PLAY_STORE_URL } from '@/lib/site/app-links';

// Footer "follow us" strip (2026-11-01): the four public channels, each as a
// link + a scannable QR (static SVGs in /public/qr, generated once with the
// `qrcode` npm package — no runtime dependency). QR tiles keep a white ground
// so they scan in dark mode too. Copy stays analytics-only (no betting words).
export const SOCIAL_CHANNELS = [
  { key: 'instagram', label: 'Instagram', handle: '@_footballanalyticspro', href: 'https://www.instagram.com/_footballanalyticspro/' },
  { key: 'x', label: 'X', handle: '@fanalytics_pro', href: 'https://x.com/fanalytics_pro' },
  { key: 'telegram', label: 'Telegram', handle: 't.me/fanalytics_pro', href: 'https://t.me/fanalytics_pro' },
  { key: 'play', label: 'Google Play', handle: 'Football Analytics Pro', href: `${PLAY_STORE_URL}&referrer=utm_source%3Dsite%26utm_medium%3Dfooter` },
] as const;

function Icon({ k }: { k: (typeof SOCIAL_CHANNELS)[number]['key'] }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'shrink-0' } as const;
  if (k === 'instagram') return (
    <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>
  );
  if (k === 'x') return (
    <svg {...p} fill="currentColor"><path d="M17.5 3h3l-7.1 8.1L21.8 21h-6.4l-5-6.5L4.6 21h-3l7.6-8.7L1.9 3h6.5l4.5 6 4.6-6Zm-1.1 16.2h1.7L7.2 4.7H5.4l11 14.5Z" /></svg>
  );
  if (k === 'telegram') return (
    <svg {...p} fill="currentColor"><path d="M21.6 4.2 18.6 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L6.9 13 2.4 11.6c-1-.3-1-1 .2-1.4L20.3 3c.8-.3 1.5.2 1.3 1.2Z" /></svg>
  );
  return (
    <svg {...p} fill="currentColor"><path d="M4 3.3v17.4c0 .5.5.8.9.6l9.6-8.7L4.9 2.7c-.4-.2-.9.1-.9.6Zm12 7.6 2.9-1.7c.7-.4.7-1.4 0-1.8L6.6 1.1l9.4 9.8Zm0 2.2-9.4 9.8 12.3-6.3c.7-.4.7-1.4 0-1.8L16 13.1Zm-1.5-1.1L6.3 3.5l8.4 8.5-.2 0Z" /></svg>
  );
}

export default async function FooterSocial() {
  const t = await getTranslations('v2.footer');
  return (
    <section className="border-t border-s-line" aria-labelledby="footer-social-h">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="footer-social-h" className="font-head text-[15px] font-bold text-s-ink">{t('follow')}</h2>
          <p className="text-[12.5px]">{t('scan')}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SOCIAL_CHANNELS.map((c) => (
            <li key={c.key}>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col gap-3 rounded-xl border border-s-line bg-s-bg p-3 transition-colors hover:border-s-ink/40"
                aria-label={`${c.label} — ${c.handle}`}
              >
                <span className="flex items-center gap-2 text-s-ink">
                  <Icon k={c.key} />
                  <span className="text-[13.5px] font-semibold">{c.label}</span>
                </span>
                <span className="mx-auto w-full max-w-[150px] rounded-lg bg-white p-2 ring-1 ring-s-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/qr/${c.key}.svg`} alt={`QR · ${c.label} ${c.handle}`} width={132} height={132} loading="lazy" className="block h-auto w-full" />
                </span>
                <span className="truncate text-center text-[12px] text-s-muted group-hover:text-s-ink">{c.handle}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
