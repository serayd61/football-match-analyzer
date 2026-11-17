'use client';

// Bölgesel fiyat bayrağı, istemci tarafı (2026-11-17). Metnini kendi sözlüğünden
// üreten istemci bileşenleri (MatchIntelligence, RegionalStrip) için; sunucu
// bileşenleri <Regional/> kullanır. İlk boyamada standart fiyat, mount sonrası
// çerezdeki bayrak.
import { useEffect, useState } from 'react';
import { pricesFromFlags, regionFlagsFromCookie, type RegionFlags } from '@/lib/site/regional';

export function useRegionFlags(): RegionFlags {
  const [flags, setFlags] = useState<RegionFlags>('');
  useEffect(() => { try { setFlags(regionFlagsFromCookie(document.cookie)); } catch { /* cookies may be blocked */ } }, []);
  return flags;
}

export function useRegionalPrices() {
  return pricesFromFlags(useRegionFlags());
}
