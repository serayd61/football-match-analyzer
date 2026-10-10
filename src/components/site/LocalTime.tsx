'use client';

import { useEffect, useState } from 'react';
import { useFormatter } from 'next-intl';

// Server renders the instant in Europe/Zurich; after hydration this swaps to
// the visitor's own time zone. `suppressHydrationWarning` keeps React quiet
// about the expected text difference.
export default function LocalTime({
  iso, format = 'time', className = '',
}: { iso: string; format?: 'time' | 'kickoff' | 'kickoffZone' | 'dayShort' | 'dayLong'; className?: string }) {
  const f = useFormatter();
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    try { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || null); } catch {}
  }, []);
  const d = new Date(iso);
  // Explicit options (not named formats): the client provider only carries messages.
  const text = f.dateTime(d, { ...(FORMATS[format] as any), ...(zone ? { timeZone: zone } : {}) });
  return <time dateTime={iso} className={`num ${className}`} suppressHydrationWarning>{text}</time>;
}

const FORMATS = {
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  kickoff: { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  // Public match pages (2026-10-10): the zone is printed so a visitor never guesses which clock the time is on.
  kickoffZone: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' },
  dayShort: { day: 'numeric', month: 'short' },
  dayLong: { weekday: 'long', day: 'numeric', month: 'long' },
} as const;
