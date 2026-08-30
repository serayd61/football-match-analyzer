'use client';

// ============================================================================
// useProof — landing'in kanıt verisi (/api/v2/proof) için tek çağrı noktası.
// Hero rozeti ve LiveProof bloğu AYNI veriyi kullanır; hook olmasaydı sayfa
// aynı ucu iki kez çağırırdı. Hata/veri yokluğunda null döner — çağıranlar
// hiç render etmez (landing asla boş kutu göstermez).
// ============================================================================

import { useEffect, useState } from 'react';

export interface ProofScope { total: number; correct: number; accuracy: number }

export interface ProofPick {
  fixtureId: number;
  home: string; away: string;
  league: string; ccode: string;
  homeScore: number | null; awayScore: number | null;
  dcPick: string; dcExcludes: 'H' | 'D' | 'A';
  probability: number; correct: boolean;
}

export interface ProofData {
  ok: boolean;
  record: {
    doubleChance: ProofScope | null;
    doubleChance30d: ProofScope | null;
    doubleChanceHigh: ProofScope | null;
    matchResult: ProofScope | null;
  };
  yesterday: { date: string | null; picks: ProofPick[]; total: number; correct: number };
}

export function useProof(): ProofData | null {
  const [data, setData] = useState<ProofData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v2/proof')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return data;
}

/** Yüzde biçimi: TR "%76,2" · DE "76,2%" · EN "76.2%" */
export function formatAccuracy(x: number, lang: string): string {
  if (lang === 'tr') return `%${String(x).replace('.', ',')}`;
  if (lang === 'de') return `${String(x).replace('.', ',')}%`;
  return `${x}%`;
}
