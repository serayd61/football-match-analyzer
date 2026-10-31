// Liste satırı için AI özeti (24 Eki): maç detayına girmeden "AI ne diyor, ajanlar ne karar
// verdi" tek satırda okunur. Saf modül (server-only değil) — birim testlenir; veri
// erişimi ai-analysis.ts'te. Pazar/seçim kodları yerelden bağımsızdır, etiket bileşende.

export type AiMarket = 'x12' | 'ou25' | 'btts';
export type AiSel = '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no';

export interface AiPick { market: AiMarket; sel: AiSel; conf: number }
/** Ajanların ortak kararı; `agents` = "2/3" gibi kısa uzlaşı oranı (yoksa null). */
export interface AiAgentPick extends AiPick { agents: string | null }

export interface AiListFlag {
  /** ajanların ortak kararı (survivalVerdict) var — eşik altında bilerek yok, bkz. survival-agent/verdict.ts */
  verdict: boolean;
  /** AI'nin en güvenli bahsi (analysis.bestBet) */
  pick: AiPick | null;
  /** ajan kararı ayrıntısı (analysis.survivalVerdict) */
  agent: AiAgentPick | null;
}

/** unified_analysis satırından JSON yollarıyla çekilen ham alanlar (hepsi metin ya da null). */
export interface AiListRow {
  b_market?: string | null; b_sel?: string | null; b_conf?: string | number | null;
  v_market?: string | null; v_sel?: string | null; v_conf?: string | number | null; v_agents?: string | null;
}

// Üretimde görülen değerler (24 Eki): bestBet.market "Over/Under 2.5"; survivalVerdict.market
// "OU" | "MS" | "BTTS"; seçimler "Over"/"Under", "1"/"X"/"2", "Yes"/"No". Eski kayıtlar için
// "Home/Draw/Away", "Match Result", "1X2" de tanınır.
export function aiMarketCode(v: unknown): AiMarket | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (s === 'ou' || s.includes('over') || s.includes('under') || s.includes('2.5') || s.includes('2,5')) return 'ou25';
  if (s === 'btts' || s.includes('both') || s.includes('kg')) return 'btts';
  if (s === 'ms' || s === '1x2' || s.includes('match') || s.includes('result') || s.includes('sonu')) return 'x12';
  return null;
}

export function aiSelCode(market: AiMarket, v: unknown): AiSel | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (market === 'ou25') return s.startsWith('over') || s === 'üst' || s === 'ust' ? 'over' : s.startsWith('under') || s === 'alt' ? 'under' : null;
  if (market === 'btts') return s === 'yes' || s === 'var' || s === 'evet' ? 'yes' : s === 'no' || s === 'yok' || s === 'hayır' ? 'no' : null;
  if (s === '1' || s === 'home' || s === 'ev') return '1';
  if (s === '2' || s === 'away' || s === 'deplasman') return '2';
  if (s === 'x' || s === 'draw' || s === 'beraberlik') return 'X';
  return null;
}

const conf = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };

/** "2/3 ajan aynı fikirde" → "2/3"; oran yoksa null. */
export function agentsShort(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/\d+\s*\/\s*\d+/);
  return m ? m[0].replace(/\s+/g, '') : null;
}

function pickOf(market: unknown, sel: unknown, c: unknown): AiPick | null {
  const m = aiMarketCode(market);
  if (!m) return null;
  const s = aiSelCode(m, sel);
  return s ? { market: m, sel: s, conf: conf(c) } : null;
}

export function toAiListFlag(r: AiListRow): AiListFlag {
  const agentPick = pickOf(r.v_market, r.v_sel, r.v_conf);
  return {
    verdict: typeof r.v_market === 'string' && r.v_market.length > 0,
    pick: pickOf(r.b_market, r.b_sel, r.b_conf),
    agent: agentPick ? { ...agentPick, agents: agentsShort(r.v_agents) } : null,
  };
}

// ── Maç sayfası "ajanların ortak kararı" (31 Eki) ────────────────────────────
// Canlıda görülen hata: kartlar "2.5 goals: Over %62" derken hüküm "Alt 2.5 Gol %60"
// yazıyordu — hüküm (survivalVerdict) ayrı bir oylamadır ve konsensüsle ters düşebilir.
// Ayrıca hüküm metinleri DB'de Türkçe şablondur ("2/3 ajan aynı fikirde",
// "50 benzer maçın %52'i bu yönde") ve EN/DE/IT sayfaya olduğu gibi sızıyordu.
// Çözüm: kodlara indir (bileşen yerel etiket basar), konsensüsle kıyasla.

export interface AiConsensusCodes { x12: '1' | 'X' | '2'; ou25: 'over' | 'under'; btts: 'yes' | 'no' }

/** Hüküm, aynı pazardaki konsensüs seçimiyle çelişiyor mu? Pazar tanınmıyorsa false. */
export function verdictConflicts(market: AiMarket, sel: AiSel, c: AiConsensusCodes): boolean {
  return c[market] !== sel;
}

/** "50 benzer maçın %52'i bu yönde" → { n: 50, pct: 52 }; tanınmazsa null. */
export function historyShort(v: unknown): { n: number; pct: number } | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+)\s*benzer maçın\s*%\s*(\d+)/);
  return m ? { n: Number(m[1]), pct: Number(m[2]) } : null;
}
