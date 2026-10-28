'use client';

// "Get it on Google Play" button (2026-10-28). Not Google's official badge
// artwork (that is a downloadable asset with its own guidelines); a site-styled
// button with the Play triangle. Tracks cta_click → location. UTM-tagged link.
// Label comes from the server: `playApp` is not in CLIENT_NAMESPACES.
import { track } from '@/lib/analytics';
import { PLAY_STORE_SITE_URL } from '@/lib/site/app-links';

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M3.6 2.3 13.9 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z" opacity=".9" />
      <path d="m15.5 13.6 2.9 2.9-11.9 6.8c-.6.3-1.2.3-1.7 0l10.7-9.7Z" opacity=".75" />
      <path d="m15.5 10.4-10.7-9.7c.5-.3 1.1-.3 1.7 0l11.9 6.8-2.9 2.9Z" opacity=".75" />
      <path d="m18.4 7.5 2.9 1.7c1 .6 1 1.9 0 2.5l-2.9 1.7-3.2-3 3.2-2.9Z" />
    </svg>
  );
}

export default function PlayBadge({ label, location, size = 'md' }: { label: string; location: string; size?: 'md' | 'lg' }) {
  return (
    <a
      href={PLAY_STORE_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track.ctaClick(location, 'google_play')}
      className={`btn btn-primary ${size === 'lg' ? 'btn-lg !h-[54px] !px-6' : ''} shrink-0`}
      data-cta={`${location}-google-play`}
    >
      <PlayIcon size={size === 'lg' ? 20 : 18} />{label}
    </a>
  );
}
