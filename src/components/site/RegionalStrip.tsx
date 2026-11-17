'use client';

// Bölgesel fiyat şeridi (2026-11-17). Bölgesel fiyat alan ANONİM ziyaretçiye
// başlığın altında tek satır: "bölgene özel fiyat, ayda $2,99". Neden: indirim
// yalnız /pricing'de görünüyordu; oraya gelmeyen ziyaretçi $9,90 sanıyordu.
//
// - Üyeye gösterilmez: denemedeki / süresi dolmuş üye UpgradeBanner'ı görür
//   (o da bölgesel rakamı yazar), Pro üyeye söylenecek bir şey yok.
// - /pricing ve /login hariç (planların kendisi; giriş formu).
// - Play uygulamasında yok: fiyatı Play gösterir (Play ödeme politikası).
// - Kapatma o oturum için (sessionStorage), UpgradeBanner ile aynı kural.
// Bayrak fa_ppp çerezinden okunur (middleware yazar); yalnız 'm' (aylık
// bölgesel fiyat açık) varken gösterilir, çünkü metin aylık rakamı söyler.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { track } from '@/lib/analytics';
import { useAppMode, type AppMode } from '@/lib/site/app-mode';
import { useRegionFlags } from '@/lib/site/use-region';
import type { RegionFlags } from '@/lib/site/regional';

const CLOSED = 'fa_regional_strip_closed';
const EXCLUDED = ['/pricing', '/login'];

/** Saf karar (test edilir). */
export function showRegionalStrip(flags: RegionFlags, sessionStatus: string, pathname: string, mode: AppMode | null, closed: boolean): boolean {
  if (!flags.includes('m') || sessionStatus !== 'unauthenticated' || mode !== 'web' || closed) return false;
  const path = pathname.replace(/^\/(en|de|it|tr)(?=\/|$)/, '') || '/';
  return !EXCLUDED.some((p) => path === p || path.startsWith(p + '/'));
}

export default function RegionalStrip({ labels: l, pricingHref }: { labels: { kicker: string; title: string; cta: string; close: string }; pricingHref: string }) {
  const { status } = useSession();
  const pathname = usePathname();
  const mode = useAppMode();
  const flags = useRegionFlags();
  const [closed, setClosed] = useState(false);
  useEffect(() => { try { setClosed(sessionStorage.getItem(CLOSED) === '1'); } catch { /* ignore */ } }, []);

  if (!showRegionalStrip(flags, status, pathname, mode, closed)) return null;
  const close = () => { try { sessionStorage.setItem(CLOSED, '1'); } catch { /* ignore */ } setClosed(true); };

  return (
    <div role="region" aria-label={l.kicker} className="border-b border-s-line bg-s-brand text-s-brand-ink" data-testid="regional-strip">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{l.kicker}</p>
          <p className="text-[14px] font-semibold">{l.title}</p>
        </div>
        <a href={pricingHref} onClick={() => track.ctaClick('regional_strip', 'pricing')} data-cta="regional_strip" className="shrink-0 rounded-full bg-s-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-s-ink hover:opacity-90">{l.cta}</a>
        <button type="button" onClick={close} aria-label={l.close} className="shrink-0 p-1 opacity-80 hover:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
