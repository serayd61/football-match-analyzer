'use client';

// Client half of src/lib/site/twa.ts: reads the `fa_twa` cookie set by the
// middleware. Used by client components (header) that must not trigger a
// dynamic render of the whole layout just to know the Play-app mode.
import { useEffect, useState } from 'react';

export function readTwaCookie(): boolean {
  try {
    return typeof document !== 'undefined' && /(?:^|;\s*)fa_twa=1(?:;|$)/.test(document.cookie);
  } catch {
    return false;
  }
}

/** `true` inside the Google Play (TWA) app; `false` on first paint and on the web. */
export function useIsTwa(): boolean {
  const [twa, setTwa] = useState(false);
  useEffect(() => { setTwa(readTwaCookie()); }, []);
  return twa;
}
