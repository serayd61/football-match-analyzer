'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';

interface Match {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  kick_off: string;
  selection: string;
  odds: number;
  ai_agreement?: number;
  ai_reasoning?: {
    claude?: string;
    gpt4?: string;
    gemini?: string;
  };
}

interface Coupon {
  id: string;
  matches: Match[];
  total_odds: number;
  confidence: number;
  suggested_stake: number;
  potential_win: number;
  ai_reasoning: string;
  status: string;
}

interface DailyCouponsData {
  safe: Coupon | null;
  date: string;
}

export default function DailyCoupons() {
  const [data, setData] = useState<DailyCouponsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<number | null>(null);
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: "🧠 AI Konsensüs Kuponu",
      subtitle: "3 AI Modeli Ortak Kararı",
      odds: "Oran",
      confidence: "Güven",
      stake: "Önerilen Bahis",
      potential: "Potansiyel Kazanç",
      copy: "Kuponu Kopyala",
      noData: "Bugün için AI konsensüs kuponu henüz oluşturulmadı",
      aiAgree: "AI Uzlaşısı",
      of3: "/3 AI",
      home: "MS 1",
      draw: "MS X", 
      away: "MS 2",
      showAI: "AI Yorumlarını Gör",
      hideAI: "AI Yorumlarını Gizle",
    },
    en: {
      title: "🧠 AI Consensus Coupon",
      subtitle: "3 AI Models Joint Decision",
      odds: "Odds",
      confidence: "Confidence",
      stake: "Suggested Stake",
      potential: "Potential Win",
      copy: "Copy Coupon",
      noData: "No AI consensus coupon created for today yet",
      aiAgree: "AI Agreement",
      of3: "/3 AI",
      home: "Home",
      draw: "Draw",
      away: "Away",
      showAI: "Show AI Comments",
      hideAI: "Hide AI Comments",
    },
    de: {
      title: "🧠 KI-Konsens-Tipp",
      subtitle: "3 KI-Modelle gemeinsame Entscheidung",
      odds: "Quote",
      confidence: "Vertrauen",
      stake: "Empfohlener Einsatz",
      potential: "Möglicher Gewinn",
      copy: "Tipp kopieren",
      noData: "Heute noch kein KI-Konsens-Tipp erstellt",
      aiAgree: "KI-Übereinstimmung",
      of3: "/3 KI",
      home: "Heim",
      draw: "Unent.",
      away: "Ausw.",
      showAI: "KI-Kommentare anzeigen",
      hideAI: "KI-Kommentare ausblenden",
    }
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  useEffect(() => {
    fetchDailyCoupons();
  }, []);

  const fetchDailyCoupons = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/daily-coupons');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCoupon = (coupon: Coupon) => {
    const text = coupon.matches.map(m => 
      `${m.home_team} vs ${m.away_team} → ${getSelectionLabel(m.selection)} (${m.odds})`
    ).join('\n');
    
    const fullText = `🧠 AI Konsensüs Kuponu\n${text}\n\nToplam Oran: ${coupon.total_odds}\nGüven: %${coupon.confidence}`;
    
    navigator.clipboard.writeText(fullText);
    alert('Kupon kopyalandı! ✅');
  };

  const getSelectionLabel = (selection: string) => {
    if (selection === '1') return l.home;
    if (selection === 'X') return l.draw;
    if (selection === '2') return l.away;
    return selection;
  };

  const getAgreementColor = (agreement: number) => {
    if (agreement >= 3) return 'text-green-400 bg-green-500/20';
    if (agreement >= 2) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-64 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-48 mb-6"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-6">
        <p className="text-red-400">Hata: {error}</p>
      </div>
    );
  }

  const coupon = data?.safe;

  if (!coupon || !coupon.matches || coupon.matches.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-4">🧠</div>
        <p className="text-gray-400">{l.noData}</p>
        <p className="text-sm text-gray-500 mt-2">
          {lang === 'tr' ? "AI konsensüs kuponu her gün 10:00'da oluşturulur" : 
           lang === 'de' ? "KI-Konsens-Tipp wird täglich um 10:00 Uhr erstellt" :
           "AI consensus coupon is generated daily at 10:00"}
        </p>
      </div>
    );
  }

  // Parse AI reasoning if it's a JSON string
  let aiReasoning: any = {};
  try {
    aiReasoning = typeof coupon.ai_reasoning === 'string' 
      ? JSON.parse(coupon.ai_reasoning) 
      : coupon.ai_reasoning || {};
  } catch {
    aiReasoning = { tr: coupon.ai_reasoning, en: coupon.ai_reasoning, de: coupon.ai_reasoning };
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {l.title}
          </h2>
          <p className="text-purple-300 text-sm mt-1">{l.subtitle}</p>
        </div>
        <div className="text-right">
          <span className="text-gray-400 text-sm">📅 {data?.date}</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-purple-500/20 px-3 py-1 rounded-full text-sm">
              {l.odds}: <span className="text-green-400 font-bold">{coupon.total_odds}</span>
            </span>
            <span className="bg-purple-500/20 px-3 py-1 rounded-full text-sm">
              {l.confidence}: <span className="text-blue-400 font-bold">%{coupon.confidence}</span>
            </span>
          </div>
        </div>
      </div>

      {/* AI Models Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-gray-900" title="Claude">C</span>
          <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-gray-900" title="GPT-4">G</span>
          <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold border-2 border-gray-900" title="Gemini">M</span>
        </div>
        <span className="text-gray-400 text-sm">Claude + GPT-4 + Gemini</span>
      </div>

      {/* Matches */}
      <div className="space-y-3 mb-4">
        {coupon.matches.map((match, idx) => (
          <div key={idx} className="bg-black/30 rounded-xl overflow-hidden">
            <div className="p-4 flex justify-between items-center">
              <div className="flex-1">
                <p className="text-white font-semibold">{match.home_team} vs {match.away_team}</p>
                <p className="text-gray-400 text-xs">{match.league}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* AI Agreement Badge */}
                <span className={`px-2 py-1 rounded text-xs font-bold ${getAgreementColor(match.ai_agreement || 0)}`}>
                  🤖 {match.ai_agreement || '?'}{l.of3}
                </span>
                {/* Selection */}
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded font-bold">
                  {getSelectionLabel(match.selection)}
                </span>
                {/* Odds */}
                <span className="text-yellow-400 font-bold text-lg">{match.odds}</span>
              </div>
            </div>
            
            {/* AI Reasoning Toggle */}
            {match.ai_reasoning && (
              <div className="border-t border-white/10">
                <button
                  onClick={() => setShowDetails(showDetails === idx ? null : idx)}
                  className="w-full px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                >
                  {showDetails === idx ? l.hideAI : l.showAI}
                  <svg className={`w-4 h-4 transition-transform ${showDetails === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showDetails === idx && (
                  <div className="px-4 pb-4 space-y-2">
                    {match.ai_reasoning.claude && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">Claude</span>
                        <span className="text-gray-400">{match.ai_reasoning.claude}</span>
                      </div>
                    )}
                    {match.ai_reasoning.gpt4 && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">GPT-4</span>
                        <span className="text-gray-400">{match.ai_reasoning.gpt4}</span>
                      </div>
                    )}
                    {match.ai_reasoning.gemini && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">Gemini</span>
                        <span className="text-gray-400">{match.ai_reasoning.gemini}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center border-t border-white/10 pt-4">
        <div className="text-sm text-gray-400">
          <span>{l.stake}: <span className="text-white font-bold">{coupon.suggested_stake} CHF</span></span>
          <span className="mx-2">→</span>
          <span>{l.potential}: <span className="text-green-400 font-bold">{coupon.potential_win} CHF</span></span>
        </div>
        <button
          onClick={() => copyCoupon(coupon)}
          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          📋 {l.copy}
        </button>
      </div>

      {/* AI Summary */}
      <p className="text-xs text-gray-500 mt-4 italic">
        {aiReasoning[lang] || aiReasoning.en || aiReasoning.tr}
      </p>
    </div>
  );
}
