// 1X2 güveni = motor olasılığı (saf, testli).
// 2026-10-25: LLM kaynakları maç sonucu için ~%50 basıyor, ağırlıklı ortalama 50'ye çöküyordu
// (24 Eki: 36 analizin 27'sinde tam %50). Dixon-Coles ya da piyasa modeli varsa gösterilen güven
// o modelin SEÇİLEN sonuç için olasılığıdır; konsensüs motorla ters düşerse düşük çıkar (dürüst).
export interface EngineProbs { home: number; draw: number; away: number }

export function anchorMatchResultConfidence(prediction: string, probs: EngineProbs | null | undefined): number | null {
  if (!probs) return null;
  const p = prediction === '1' ? probs.home : prediction === '2' ? probs.away : prediction === 'X' ? probs.draw : null;
  if (p == null || !Number.isFinite(p)) return null;
  return Math.round(Math.min(95, Math.max(20, p * 100)));
}
