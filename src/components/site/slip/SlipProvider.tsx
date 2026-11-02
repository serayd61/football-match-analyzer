'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { SLIP_STORAGE_KEY, parseStoredSlip, serializeSlip, toggleLeg, removeLeg, hasLeg, type SlipLeg, type AddOutcome, type LegId } from '@/lib/site/slip-rule';
import { mergeSlips, sameSlip } from '@/lib/site/slip-sync';

// ============================================================================
// Kuponum — istemci durumu (slip-1.0 → slip-2.0, 2026-11-02). localStorage hâlâ
// anlık kaynak (ilk render boş, effect'te okunur; sekmeler `storage` olayıyla
// eşlenir). Oturum açıkken sunucuyla eşitlenir (/api/site/slip):
//   • açılışta GET ?mine=1 → bu tarayıcı daha önce hiç eşitlenmediyse yerel kupon
//     sunucuyla birleşir (SYNCED_KEY), sonra sunucu tek doğrudur (cihazlar arası silme);
//   • her değişiklikte PUT { legs } (tamamı; sonucu beklenmez, hata sessiz).
// Sunucu tablo yoksa (migration bekliyor) ya da ağ yoksa yalnız localStorage ile çalışır.
// ============================================================================

interface SlipCtx {
  legs: SlipLeg[];
  ready: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: (leg: SlipLeg) => AddOutcome;
  remove: (leg: LegId) => void;
  clear: () => void;
  has: (leg: Pick<SlipLeg, 'fixtureId' | 'market' | 'selection'>) => boolean;
  /** son işlem geri bildirimi (kısa süreli) */
  flash: { outcome: AddOutcome; at: number } | null;
}

const Ctx = createContext<SlipCtx | null>(null);
const SYNCED_KEY = 'fa.slip.synced';

function read(): SlipLeg[] {
  try { return parseStoredSlip(window.localStorage.getItem(SLIP_STORAGE_KEY)); } catch { return []; }
}
function write(legs: SlipLeg[]) {
  try { window.localStorage.setItem(SLIP_STORAGE_KEY, serializeSlip(legs)); } catch { /* özel pencere / dolu depo: sessiz */ }
}
const wasSynced = () => { try { return window.localStorage.getItem(SYNCED_KEY) === '1'; } catch { return false; } };
const markSynced = () => { try { window.localStorage.setItem(SYNCED_KEY, '1'); } catch { /* sessiz */ } };

async function pushToServer(legs: SlipLeg[]): Promise<void> {
  try {
    await fetch('/api/site/slip', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ legs }), cache: 'no-store', keepalive: true });
  } catch { /* ağ: yerel kopya duruyor, sonraki değişiklikte tekrar denenir */ }
}

export function SlipProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<SlipCtx['flash']>(null);
  const authed = status === 'authenticated';
  const authedRef = useRef(false);
  authedRef.current = authed;

  useEffect(() => {
    setLegs(read()); setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === SLIP_STORAGE_KEY) setLegs(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sunucuyla ilk eşitleme (oturum başına bir kez).
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/site/slip?mine=1', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !j?.ok || !Array.isArray(j.legs)) return;
        const server = parseStoredSlip(JSON.stringify({ legs: j.legs }));
        const local = read();
        const next = wasSynced() ? server : mergeSlips(server, local);
        if (!sameSlip(next, local)) { setLegs(next); write(next); }
        if (!sameSlip(next, server)) await pushToServer(next);
        markSynced();
      } catch { /* ağ: yerel kopya ile devam */ }
    })();
    return () => { alive = false; };
  }, [authed]);

  const commit = useCallback((next: SlipLeg[]) => { setLegs(next); write(next); if (authedRef.current) void pushToServer(next); }, []);
  const toggle = useCallback((leg: SlipLeg): AddOutcome => {
    const cur = read();
    const r = toggleLeg(cur, leg);
    if (r.outcome === 'added' || r.outcome === 'replaced' || r.outcome === 'removed') commit(r.legs);
    setFlash({ outcome: r.outcome, at: Date.now() });
    return r.outcome;
  }, [commit]);
  const remove = useCallback((leg: LegId) => commit(removeLeg(read(), leg)), [commit]);
  const clear = useCallback(() => commit([]), [commit]);
  const has = useCallback((leg: Pick<SlipLeg, 'fixtureId' | 'market' | 'selection'>) => hasLeg(legs, leg), [legs]);

  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), 2500); return () => clearTimeout(id); }, [flash]);

  const value = useMemo<SlipCtx>(() => ({ legs, ready, open, setOpen, toggle, remove, clear, has, flash }), [legs, ready, open, toggle, remove, clear, has, flash]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSlip(): SlipCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSlip: SlipProvider yok');
  return v;
}
