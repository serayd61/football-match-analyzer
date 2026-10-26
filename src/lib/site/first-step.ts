// Deneme kullanıcısı için "buradan başla" seçimi (2026-10-26).
//
// Google girişi düzelince yeni kayıtlar arttı ama ilk 48 saatte kimse bir maç
// sayfası açmadı: dashboard 50+ satırlık liste ile açılıyor, tek bir net adım yok.
// Bu seçici, deneme süresinde panelin tepesine koyulacak TEK maçı belirler.
// Öncelik: güçlü pazar bölgesi (lig karnesi var) → günün seçimi (doğrulanmış
// kural) → bugünün en yüksek güvenli model seçimi → yarının. Başlamış/bitmiş
// maçlar atlanır. Saf fonksiyon; testte sahte satırlarla çalışır.

export interface FirstStepRow {
  fixtureId: number;
  homeName: string;
  awayName: string;
  kickoff: string;
  leagueName: string;
  hasModel: boolean;
  settled: boolean;
  pick: '1' | 'X' | '2' | null;
  confidence: number | null;
  confidenceRaw: number | null;
}

export interface FirstStepStrong<R extends FirstStepRow> {
  row: R;
  leagueName: string;
  pick: { market: 'x12' | 'ou25' | 'under25' | 'btts'; selection: '1' | 'X' | '2' | 'over' | 'under' | 'yes'; p: number; sm: { won: number; n: number } };
}

export interface FirstStepPick {
  fixtureId: number;
  homeName: string;
  awayName: string;
  kickoff: string;
  leagueSlug: string;
  market: string;
  modelP: number;
}

export type FirstStep<R extends FirstStepRow> =
  | { kind: 'strong'; row: R; market: FirstStepStrong<R>['pick']['market']; selection: FirstStepStrong<R>['pick']['selection']; p: number; won: number; n: number; leagueName: string }
  | { kind: 'pick'; fixtureId: number; homeName: string; awayName: string; kickoff: string; leagueName: string; market: string; p: number }
  | { kind: 'model'; row: R; p: number; leagueName: string };

const upcoming = (kickoff: string, now: number) => {
  const t = Date.parse(kickoff);
  return Number.isFinite(t) && t > now;
};

export function pickFirstStep<R extends FirstStepRow>(
  input: { strong: FirstStepStrong<R>[]; picks: FirstStepPick[]; today: R[]; tomorrow: R[] },
  opts: { now?: number } = {},
): FirstStep<R> | null {
  const now = opts.now ?? Date.now();

  const s = input.strong.find((x) => !x.row.settled && upcoming(x.row.kickoff, now));
  if (s) return { kind: 'strong', row: s.row, market: s.pick.market, selection: s.pick.selection, p: s.pick.p, won: s.pick.sm.won, n: s.pick.sm.n, leagueName: s.leagueName || s.row.leagueName };

  const p = input.picks.find((x) => upcoming(x.kickoff, now));
  if (p) return { kind: 'pick', fixtureId: p.fixtureId, homeName: p.homeName, awayName: p.awayName, kickoff: p.kickoff, leagueName: p.leagueSlug.replace(/-/g, ' '), market: p.market, p: p.modelP };

  // Bugün + yarın tek havuz: etiket "48 saat" diyor; pazartesi %49'luk bugün yerine
  // yarının %72'si gösterilmeli (canlı kontrol, 2026-10-26).
  let best: R | null = null; let bestP = -1;
  for (const r of [...input.today, ...input.tomorrow]) {
    if (!r.hasModel || r.settled || !r.pick || !upcoming(r.kickoff, now)) continue;
    const c = r.confidence ?? r.confidenceRaw;
    if (c != null && c > bestP) { best = r; bestP = c; }
  }
  if (best) return { kind: 'model', row: best, p: bestP, leagueName: best.leagueName };
  return null;
}
