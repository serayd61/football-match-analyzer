// Paylaşılan kupon yükleyici (slip-1.3): koddaki bacaklara takım/lig/saat/skor eklenir (resmi sürüm).
// page.tsx ve opengraph-image.tsx ortak kullanır; sayfa modülünden dışa aktarılamaz (Next page export kuralı).
import { getPrediction, type SitePrediction } from '@/lib/site/predictions';
import { decodeSlip, type SharedLeg } from './slip-share';
import type { SlipLeg, SlipResult } from './slip-rule';

export const asLeg = (l: SharedLeg): SlipLeg => ({ ...l, kickoff: '1970-01-01T00:00:00.000Z', leagueLabel: '', homeName: '', awayName: '', addedAt: '' });

export async function loadShared(code: string) {
  const legs = decodeSlip(code);
  const ids = [...new Set(legs.map((l) => l.fixtureId))];
  const preds = await Promise.all(ids.map((id) => getPrediction(id).catch(() => null)));
  const byId = new Map<number, SitePrediction>();
  ids.forEach((id, i) => { const p = preds[i]; if (p) byId.set(id, p); });
  const full: SlipLeg[] = legs.filter((l) => byId.has(l.fixtureId)).map((l) => { const p = byId.get(l.fixtureId)!; return { ...l, kickoff: p.kickoff, leagueLabel: p.leagueName, homeName: p.homeName, awayName: p.awayName, addedAt: '' }; });
  full.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.fixtureId - b.fixtureId);
  const results: Record<number, SlipResult> = {};
  for (const p of byId.values()) results[p.fixtureId] = { homeScore: p.homeScore, awayScore: p.awayScore, settled: p.settled && p.homeScore != null && p.awayScore != null, status: p.settled ? 'finished' : Date.parse(p.kickoff) <= Date.now() ? 'started' : 'scheduled' };
  return { legs: full, missing: legs.length - full.length, results };
}

