'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BarChart3, ShieldCheck, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

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
  },
  en: {
    title: 'Track Record',
    subtitle: 'Real performance of the Dixon-Coles engine on historical data (walk-forward, no data leakage).',
    honesty: 'Honesty note: These are real backtest figures, not inflated. In football a 50-55% range for 1X2 is normal and good (bookmaker margin ~53%). No guaranteed-profit claims — betting carries risk.',
    league: 'League', matches: 'Test Matches', mr: '1X2', ou: 'Over/Under 2.5', btts: 'BTTS',
    weighted: 'Weighted average', leagues: 'Leagues', tested: 'Matches tested',
    method: 'Method: for each match the model is re-fit using only matches up to that date (no future leakage). 2 seasons of data, football-data.org.',
    loading: 'Loading...', empty: 'No backtest results yet.', back: '← Home',
  },
  de: {
    title: 'Erfolgsbilanz',
    subtitle: 'Echte Leistung der Dixon-Coles-Engine mit historischen Daten (Walk-forward, kein Datenleck).',
    honesty: 'Ehrlichkeitshinweis: Dies sind echte Backtest-Werte, nicht aufgebläht. Im Fussball ist ein Bereich von 50-55% bei 1X2 normal und gut (Buchmacher-Marge ~53%). Keine Gewinngarantie — Wetten sind riskant.',
    league: 'Liga', matches: 'Testspiele', mr: '1X2', ou: 'Über/Unter 2.5', btts: 'BTTS',
    weighted: 'Gewichteter Durchschnitt', leagues: 'Ligen', tested: 'Getestete Spiele',
    method: 'Methode: Für jedes Spiel wird das Modell nur mit Spielen bis zu diesem Datum neu angepasst (kein Zukunftsleck). 2 Saisons, football-data.org.',
    loading: 'Laden...', empty: 'Noch keine Backtest-Ergebnisse.', back: '← Startseite',
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition">{t.back}</Link>

        <div className="flex items-center gap-3 mt-4 mb-2">
          <div className="p-2 rounded-xl bg-[#00f0ff]/15 border border-[#00f0ff]/30">
            <BarChart3 className="w-6 h-6 text-[#00f0ff]" />
          </div>
          <h1 className="text-3xl font-bold">{t.title}</h1>
        </div>
        <p className="text-gray-400 mb-6 max-w-2xl">{t.subtitle}</p>

        {/* Özet kartları */}
        {summary && summary.leagues > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-xs text-gray-400">{t.leagues}</p>
              <p className="text-2xl font-bold text-[#00f0ff]">{summary.leagues}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-xs text-gray-400">{t.tested}</p>
              <p className="text-2xl font-bold text-[#00f0ff]">{summary.totalTested.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-xs text-gray-400">{t.mr} ({t.weighted})</p>
              <p className="text-2xl font-bold text-emerald-400">{pct(summary.mrAccuracy)}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-xs text-gray-400">{t.ou} / {t.btts}</p>
              <p className="text-2xl font-bold text-emerald-400">{pct(summary.ouAccuracy)} / {pct(summary.bttsAccuracy)}</p>
            </div>
          </div>
        )}

        {/* Dürüstlük notu */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-100/90">{t.honesty}</p>
        </div>

        {/* Tablo */}
        {loading ? (
          <p className="text-gray-400">{t.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-left">
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
                      className="border-t border-white/5 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium">
                        <span className="mr-2">{lg.flag}</span>{lg.name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{r.tested_matches.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{pct(r.mr_accuracy)}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{pct(r.ou_accuracy)}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{pct(r.btts_accuracy)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Yöntem */}
        <div className="flex items-start gap-3 mt-6 text-xs text-gray-500">
          <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{t.method}</p>
        </div>
      </div>
    </div>
  );
}
