'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SLIP_STORAGE_KEY, parseStoredSlip, serializeSlip, toggleLeg, removeLeg, hasLeg, type SlipLeg, type AddOutcome, type LegId } from '@/lib/site/slip-rule';

// ============================================================================
// Kuponum — istemci durumu (slip-1.0). localStorage'da durur; sekme/pencere arası
// `storage` olayıyla eş zamanlanır. Hidrasyon: ilk render boş, effect'te okunur.
// Sunucuya yazmaz; üye kapısı buton/çubuk düzeyinde (sayfa yalnız üyeye basar).
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

function read(): SlipLeg[] {
  try { return parseStoredSlip(window.localStorage.getItem(SLIP_STORAGE_KEY)); } catch { return []; }
}
function write(legs: SlipLeg[]) {
  try { window.localStorage.setItem(SLIP_STORAGE_KEY, serializeSlip(legs)); } catch { /* özel pencere / dolu depo: sessiz */ }
}

export function SlipProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<SlipCtx['flash']>(null);

  useEffect(() => {
    setLegs(read()); setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === SLIP_STORAGE_KEY) setLegs(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const commit = useCallback((next: SlipLeg[]) => { setLegs(next); write(next); }, []);
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
