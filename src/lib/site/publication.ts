// ---------------------------------------------------------------------------
// Değişmez yayın kaydı — "o gün kullanıcının gördüğü tahmin" (denetim B06).
// ---------------------------------------------------------------------------
// engine_predictions upsert ile DEĞİŞİR (aynı sürüm yeniden ingest edilir) ve
// karne eskiden bugünkü aktif sürümle filtreleniyordu: model terfi edince geçmiş
// aylar sessizce yeni sürümün rakamlarına dönüyordu. engine_prediction_history
// (trigger, 2026-09-06'dan beri) her insert/update'i değişmez satır olarak tutar.
//
// Kural (saf, test edilebilir):
//   1. Maçın resmî sürümü = başlama anında aktif olan sürüm (aktivasyon zaman çizgisi).
//   2. Yayımlanan tahmin = o sürümün başlama ÖNCESİ son history satırı.
//   3. History yoksa (6 Eylül öncesi / trigger kaçırdıysa) null → çağıran mevcut
//      satıra düşer; bu kayıtlar "arşiv" sayılır, uydurma zaman üretilmez.
// ---------------------------------------------------------------------------

export interface Activation { version: string; at: string }
export interface HistoryRow {
  fixture_id: number;
  model_version: string | null;
  issued_at: string;
  p_raw: Record<string, unknown> | null;
}

/** Aktivasyonları zamana göre sıralar; aynı anda iki kayıt varsa sonuncusu kazanır. */
export function buildTimeline(acts: Activation[]): Activation[] {
  return [...acts].filter((a) => a.version && Number.isFinite(Date.parse(a.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** `t` anında aktif sürüm; çizgi boşsa ya da `t` ilk aktivasyondan önceyse null. */
export function officialAt(timeline: Activation[], t: string): string | null {
  const ts = Date.parse(t);
  let cur: string | null = null;
  for (const a of timeline) { if (Date.parse(a.at) <= ts) cur = a.version; else break; }
  return cur;
}

/** Bir maçın history satırlarından yayımlanan tahmini seçer (başlama öncesi son satır). */
export function pickPublished(rows: HistoryRow[], kickoff: string, version: string | null): HistoryRow | null {
  const ko = Date.parse(kickoff);
  let best: HistoryRow | null = null;
  for (const r of rows) {
    if (version && r.model_version !== version) continue;
    const at = Date.parse(r.issued_at);
    if (!(at < ko)) continue; // başladıktan sonra yazılan satır karneye girmez
    if (!best || at > Date.parse(best.issued_at)) best = r;
  }
  return best;
}

const n = (v: unknown): number | null => { const x = typeof v === 'number' ? v : parseFloat(String(v)); return Number.isFinite(x) ? x : null; };

/** p_raw jsonb → karne alanları; 1X2 eksikse null (çağıran mevcut satırı korur). */
export function publishedFields(h: HistoryRow): { p_home: number; p_draw: number; p_away: number; p_over25: number | null; p_btts_yes: number | null; pick: '1' | 'X' | '2' | null; confidence: number | null } | null {
  const p = h.p_raw || {};
  const ph = n(p.p_home), pd = n(p.p_draw), pa = n(p.p_away);
  if (ph == null || pd == null || pa == null) return null;
  const pick = p.pick === '1' || p.pick === 'X' || p.pick === '2' ? p.pick : null;
  return { p_home: ph, p_draw: pd, p_away: pa, p_over25: n(p.p_over25), p_btts_yes: n(p.p_btts_yes), pick, confidence: n(p.confidence) };
}
