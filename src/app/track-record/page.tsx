'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BarChart3, ShieldCheck, TrendingUp, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';

// ============================================================================
// TRACK RECORD — Dixon-Coles backtest doğruluk vitrini (DÜRÜST)
// dc_backtest_results'tan gerçek walk-forward sonuçları. Şişirme yok.
// ============================================================================

const LEAGUE_NAMES: Record<string, { name: string; flag: string }> = {
  PL: { name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  PD: { name: 'La Liga', flag: '🇪🇸' },
  SA: { name: 'Serie A', flag: '🇮🇹' },
  BL1: { name: 'Bundesliga', flag: '🇩🇪' },
  FL1: { name: 'Ligue 1', flag: '🇫🇷' },
  CL: { name: 'Champions League', flag: '🏆' },
  ELC: { name: 'Championship', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  DED: { name: 'Eredivisie', flag: '🇳🇱' },
  PPL: { name: 'Primeira Liga', flag: '🇵🇹' },
  BSA: { name: 'Brasileirão', flag: '🇧🇷' },
};

const L = {
  tr: {
    title: 'Doğruluk Karnesi',
    subtitle: 'Dixon-Coles istatistik motorunun GERÇEK geçmiş verilerdeki performansı (walk-forward, data sızıntısı yok).',
    honesty: 'Dürüstlük notu: Bu sayılar gerçek backtest çıktısıdır, şişirilmemiştir. Futbolda 1X2 için %50-55 bandı normal ve iyidir (bahisçi marjı ~%53). Garanti kazanç iddiası yoktur — bahis risk içerir.',
    league: 'Lig', matches: 'Test Maçı', mr: '1X2', ou: 'Üst/Alt 2.5', btts: 'KG',
    weighted: 'Ağırlıklı ortalama', leagues: 'Lig', tested: 'Test edilen maç',
    method: 'Yöntem: Her maç için yalnızca o tarihe kadarki maçlarla model yeniden fit edilir (gelecek bilgisi sızmaz). 2 sezon veri, football-data.org.',
    loading: 'Yükleniyor...', empty: 'Henüz backtest sonucu yok.', back: '← Ana sayfa',
    anchorTitle: 'Piyasa Çıpası (v2 motor)',
    anchorDesc: 'Motor artık tahminleri bahisçi kapanış oranına çıpalıyor. Kapanış oranı futbolun en güçlü tek tahmincisidir; modeli ona doğru çekmek hem isabeti hem kalibrasyonu (olasılık doğruluğu) iyileştirir.',
    anchorBefore: 'İzole DC', anchorAfter: 'Piyasa-çıpalı (v2)', anchorMetric: '1X2 isabet (backtest)',
    anchorProof: '3 büyük lig · ~2000 maç · gerçek kapanış oranı (walk-forward). İzole modele göre log-loss ~%4-6 daha düşük (daha iyi kalibrasyon).',
    anchorHonest: 'Şeffaflık: Bu, motoru piyasa verimliliğine HİZALAR — piyasayı YENME iddiası değildir. Kapanış oranına karşı value-betting backtest\'i marj sonrası kabaca başabaş/negatiftir. Garanti kazanç yoktur.',
  },
  en: {
    title: 'Track Record',
    subtitle: 'Real performance of the Dixon-Coles engine on historical data (walk-forward, no data leakage).',
    honesty: 'Honesty note: These are real backtest figures, not inflated. In football a 50-55% range for 1X2 is normal and good (bookmaker margin ~53%). No guaranteed-profit claims — betting carries risk.',
    league: 'League', matches: 'Test Matches', mr: '1X2', ou: 'Over/Under 2.5', btts: 'BTTS',
    weighted: 'Weighted average', leagues: 'Leagues', tested: 'Matches tested',
    method: 'Method: for each match the model is re-fit using only matches up to that date (no future leakage). 2 seasons of data, football-data.org.',
    loading: 'Loading...', empty: 'No backtest results yet.', back: '← Home',
    anchorTitle: 'Market Anchoring (v2 engine)',
    anchorDesc: 'The engine now anchors its predictions to bookmaker closing odds. The closing line is the single strongest predictor in football; pulling the model toward it improves both accuracy and calibration (probability quality).',
    anchorBefore: 'DC alone', anchorAfter: 'Market-anchored (v2)', anchorMetric: '1X2 accuracy (backtest)',
    anchorProof: '3 major leagues · ~2000 matches · real closing odds (walk-forward). ~4-6% lower log-loss vs the isolated model (better calibration).',
    anchorHonest: 'Transparency: this ALIGNS the engine with market efficiency — it is not a claim to BEAT the market. Value-betting backtest vs the closing line is roughly break-even/negative after margin. No guaranteed profit.',
  },
  de: {
    title: 'Erfolgsbilanz',
    subtitle: 'Echte Leistung der Dixon-Coles-Engine mit historischen Daten (Walk-forward, kein Datenleck).',
    honesty: 'Ehrlichkeitshinweis: Dies sind echte Backtest-Werte, nicht aufgebläht. Im Fussball ist ein Bereich von 50-55% bei 1X2 normal und gut (Buchmacher-Marge ~53%). Keine Gewinngarantie — Wetten sind riskant.',
    league: 'Liga', matches: 'Testspiele', mr: '1X2', ou: 'Über/Unter 2.5', btts: 'BTTS',
    weighted: 'Gewichteter Durchschnitt', leagues: 'Ligen', tested: 'Getestete Spiele',
    method: 'Methode: Für jedes Spiel wird das Modell nur mit Spielen bis zu diesem Datum neu angepasst (kein Zukunftsleck). 2 Saisons, football-data.org.',
    loading: 'Laden...', empty: 'Noch keine Backtest-Ergebnisse.', back: '← Startseite',
    anchorTitle: 'Markt-Verankerung (v2-Engine)',
    anchorDesc: 'Die Engine verankert ihre Vorhersagen jetzt an den Schlussquoten der Buchmacher. Die Schlussquote ist der stärkste Einzelprädiktor im Fussball; das Modell darauf zuzuziehen verbessert Genauigkeit und Kalibrierung.',
    anchorBefore: 'Nur DC', anchorAfter: 'Markt-verankert (v2)', anchorMetric: '1X2-Genauigkeit (Backtest)',
    anchorProof: '3 grosse Ligen · ~2000 Spiele · echte Schlussquoten (Walk-forward). ~4-6% niedrigerer Log-Loss als das isolierte Modell (bessere Kalibrierung).',
    anchorHonest: 'Transparenz: Dies RICHTET die Engine an der Markteffizienz AUS — kein Anspruch, den Markt zu SCHLAGEN. Value-Betting-Backtest gegen die Schlussquote ist nach Marge etwa ausgeglichen/negativ. Kein garantierter Gewinn.',
  },
} as const;

interface Row {
  league_code: string;
  tested_matches: number;
  mr_accuracy: number;
  ou_accuracy: number;
  btts_accuracy: number;
  log_loss: number;
  brier: number;
}
interface Summary {
  leagues: number; totalTested: number; mrAccuracy: number; ouAccuracy: number; bttsAccuracy: number;
}

export default function TrackRecordPage() {
  const { lang } = useLanguage();
  const t = L[(lang as keyof typeof L)] || L.en;
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v2/dc-backtest')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRows(d.results || []);
          setSummary(d.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content transition-colors"><ArrowLeft size={15} /> {t.back.replace('← ', '')}</Link>

        <div className="flex items-center gap-3 mt-4 mb-2">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/25">
            <BarChart3 className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold text-content tracking-tight">{t.title}</h1>
        </div>
        <p className="text-content-muted mb-6 max-w-2xl">{t.subtitle}</p>

        {/* Özet kartları */}
        {summary && summary.leagues > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="fa-card p-4">
              <p className="text-xs text-content-muted">{t.leagues}</p>
              <p className="text-2xl font-bold text-brand-400 tabular-nums">{summary.leagues}</p>
            </div>
            <div className="fa-card p-4">
              <p className="text-xs text-content-muted">{t.tested}</p>
              <p className="text-2xl font-bold text-brand-400 tabular-nums">{summary.totalTested.toLocaleString()}</p>
            </div>
            <div className="fa-card p-4">
              <p className="text-xs text-content-muted">{t.mr} ({t.weighted})</p>
              <p className="text-2xl font-bold text-positive tabular-nums">{pct(summary.mrAccuracy)}</p>
            </div>
            <div className="fa-card p-4">
              <p className="text-xs text-content-muted">{t.ou} / {t.btts}</p>
              <p className="text-2xl font-bold text-positive tabular-nums">{pct(summary.ouAccuracy)} / {pct(summary.bttsAccuracy)}</p>
            </div>
          </div>
        )}

        {/* Piyasa Çıpası (v2) — gerçek ve ispatlanabilir iyileşme */}
        <div className="fa-card p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/25">
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <h2 className="text-base font-semibold text-content tracking-tight">{(t as any).anchorTitle}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">v2</span>
          </div>
          <p className="text-sm text-content-muted mb-4">{(t as any).anchorDesc}</p>

          <div className="flex items-stretch gap-3 mb-3">
            <div className="flex-1 rounded-xl border border-line bg-surface-2 p-3 text-center">
              <p className="text-[11px] text-content-subtle mb-1">{(t as any).anchorBefore}</p>
              <p className="text-2xl font-bold text-content-muted tabular-nums">49.7%</p>
            </div>
            <div className="flex items-center text-content-subtle text-xl">→</div>
            <div className="flex-1 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-center">
              <p className="text-[11px] text-brand-300 mb-1">{(t as any).anchorAfter}</p>
              <p className="text-2xl font-bold text-brand-400 tabular-nums">52.7%</p>
            </div>
          </div>
          <p className="text-[11px] text-content-subtle">{(t as any).anchorMetric} · {(t as any).anchorProof}</p>
        </div>

        {/* Dürüstlük notu */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-3">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90">{t.honesty}</p>
        </div>
        {/* Şeffaflık: piyasayı yenme iddiası YOK */}
        <div className="flex items-start gap-3 bg-surface-2 border border-line rounded-2xl p-4 mb-6">
          <ShieldCheck className="w-5 h-5 text-content-subtle shrink-0 mt-0.5" />
          <p className="text-sm text-content-muted">{(t as any).anchorHonest}</p>
        </div>

        {/* Tablo */}
        {loading ? (
          <p className="text-content-muted">{t.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-content-muted">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-content-subtle text-left">
                  <th className="px-4 py-3 font-medium">{t.league}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.matches}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.mr}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.ou}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.btts}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const lg = LEAGUE_NAMES[r.league_code] || { name: r.league_code, flag: '⚽' };
                  return (
                    <motion.tr
                      key={r.league_code}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-t border-line hover:bg-surface-2"
                    >
                      <td className="px-4 py-3 font-medium text-content">
                        <span className="mr-2">{lg.flag}</span>{lg.name}
                      </td>
                      <td className="px-4 py-3 text-right text-content-muted tabular-nums">{r.tested_matches.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-positive tabular-nums">{pct(r.mr_accuracy)}</td>
                      <td className="px-4 py-3 text-right text-content-muted tabular-nums">{pct(r.ou_accuracy)}</td>
                      <td className="px-4 py-3 text-right text-content-muted tabular-nums">{pct(r.btts_accuracy)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Yöntem */}
        <div className="flex items-start gap-3 mt-6 text-xs text-content-subtle">
          <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{t.method}</p>
        </div>
      </div>
    </div>
  );
}
