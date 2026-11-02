// ============================================================================
// Kuponum sunucu eşitleme — saf kurallar (slip-2.0, 2026-11-02)
// ----------------------------------------------------------------------------
// İstemci kuponun tamamını gönderir (PUT /api/site/slip); sunucu satırlarıyla
// fark alınır: yeni/değişen bacak upsert, listede olmayan aktif bacak removed_at.
// İlk açılışta (tarayıcıda hiç eşitlenmemişse) yerel kupon sunucuyla BİRLEŞİR:
// sunucu aynı maç-pazar yuvasında kazanır, geri kalan yerel bacaklar eklenir.
// Sonraki açılışlarda sunucu tek doğrudur (cihazlar arası silme kaybolmasın).
// ============================================================================
import { isValidLeg, legKey, slotKey, MAX_LEGS, type SlipLeg } from './slip-rule';

export interface SlipRow {
  leg_key: string; fixture_id: number; market: string; selection: string; line: number | null;
  p: number; odds: number | null; home_name: string; away_name: string; league_label: string; kickoff: string; added_at: string; removed_at: string | null;
}

export function rowToLeg(r: SlipRow): SlipLeg | null {
  const leg: Record<string, unknown> = {
    fixtureId: Number(r.fixture_id), kickoff: new Date(r.kickoff).toISOString(), leagueLabel: r.league_label ?? '', homeName: r.home_name, awayName: r.away_name,
    market: r.market, selection: r.selection, p: Number(r.p), odds: r.odds == null ? null : Number(r.odds), addedAt: new Date(r.added_at).toISOString(),
  };
  if (r.market === 'ah') leg.line = r.line == null ? 0 : Number(r.line);
  return isValidLeg(leg) ? leg : null;
}

export function legToRow(email: string, l: SlipLeg): Omit<SlipRow, 'removed_at'> & { user_email: string; removed_at: null } {
  return {
    user_email: email, leg_key: legKey(l), fixture_id: l.fixtureId, market: l.market, selection: l.selection, line: l.market === 'ah' ? (l.line ?? 0) : null,
    p: l.p, odds: l.odds, home_name: l.homeName, away_name: l.awayName, league_label: l.leagueLabel, kickoff: l.kickoff, added_at: l.addedAt, removed_at: null,
  };
}

/** Sunucudaki aktif anahtarlar ile gelen kupon arasındaki fark. */
export function planSlipSync(activeKeys: string[], incoming: SlipLeg[]): { upserts: SlipLeg[]; removeKeys: string[] } {
  const seen = new Set<string>();
  const upserts: SlipLeg[] = [];
  for (const l of incoming) { const k = legKey(l); if (seen.has(k)) continue; seen.add(k); upserts.push(l); }
  const removeKeys = activeKeys.filter((k) => !seen.has(k));
  return { upserts: upserts.slice(0, MAX_LEGS), removeKeys };
}

/** İlk eşitleme birleşimi: sunucu + yerel (yuva çakışmasında sunucu), en çok MAX_LEGS. */
export function mergeSlips(server: SlipLeg[], local: SlipLeg[]): SlipLeg[] {
  const slots = new Set(server.map(slotKey));
  const out = [...server];
  for (const l of local) { if (slots.has(slotKey(l))) continue; slots.add(slotKey(l)); out.push(l); }
  return out.slice(0, MAX_LEGS);
}

/** İki kupon aynı mı (anahtar kümesi)? */
export function sameSlip(a: SlipLeg[], b: SlipLeg[]): boolean {
  if (a.length !== b.length) return false;
  const ks = new Set(a.map(legKey));
  return b.every((l) => ks.has(legKey(l)));
}
