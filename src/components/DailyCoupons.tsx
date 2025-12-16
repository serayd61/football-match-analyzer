'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';

interface Match {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  kick_off: string;
  bet_type: string;
  selection: string;
  odds: number;
  confidence: number;
  aiVotes: number;
  agentVotes: number;
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
  balanced: Coupon | null;
  risky: Coupon | null;
  date: string;
}

export default function DailyCoupons() {
  const [data, setData] = useState<DailyCouponsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lang} = useLanguage();

  const labels = {
    tr: {
      title: "🎯 Günün Kuponları",
      safe: "💚 GÜVENLİ KUPON",
      balanced: "🟡 DENGELİ KUPON", 
      risky: "🔴 RİSKLİ KUPON",
      odds: "Oran",
      confidence: "Güven",
      stake: "Önerilen Bahis",
      potential: "Potansiyel Kazanç",
      copy: "Kuponu Kopyala",
      noData: "Bugün için kupon henüz oluşturulmadı",
      ai: "AI",
      agent: "Agent",
      consensus: "Konsensüs"
    },
    en: {
      title: "🎯 Daily Coupons",
      safe: "💚 SAFE COUPON",
      balanced: "🟡 BALANCED COUPON",
      risky: "🔴 RISKY COUPON", 
      odds: "Odds",
      confidence: "Confidence",
      stake: "Suggested Stake",
      potential: "Potential Win",
      copy: "Copy Coupon",
      noData: "No coupons created for today yet",
      ai: "AI",
      agent: "Agent",
      consensus: "Consensus"
    },
    de: {
      title: "🎯 Tages-Tipps",
      safe: "💚 SICHERER TIPP",
      balanced: "🟡 AUSGEWOGENER TIPP",
      risky: "🔴 RISKANTER TIPP",
      odds: "Quote",
      confidence: "Vertrauen",
      stake: "Empfohlener Einsatz",
      potential: "Möglicher Gewinn",
      copy: "Tipp kopieren",
      noData: "Heute noch keine Tipps erstellt",
      ai: "KI",
      agent: "Agent",
      consensus: "Konsens"
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

  const copyCoupon = (coupon: Coupon, type: string) => {
    const text = coupon.matches.map(m => 
      `${m.home_team} vs ${m.away_team} → ${m.selection} (${m.odds})`
    ).join('\n');
    
    const fullText = `${type}\n${text}\nToplam Oran: ${coupon.total_odds}\nGüven: %${coupon.confidence}`;
    
    navigator.clipboard.writeText(fullText);
    alert('Kupon kopyalandı! ✅');
  };

  const getBetTypeLabel = (betType: string, selection: string) => {
    const betLabels = {
      tr: {
        home: 'MS 1', draw: 'MS X', away: 'MS 2',
        over: 'Üst 2.5', under: 'Alt 2.5',
        bttsYes: 'KG Var', bttsNo: 'KG Yok'
      },
      en: {
        home: 'Home', draw: 'Draw', away: 'Away',
        over: 'Over 2.5', under: 'Under 2.5',
        bttsYes: 'BTTS Yes', bttsNo: 'BTTS No'
      },
      de: {
        home: 'Heim', draw: 'Unent.', away: 'Ausw.',
        over: 'Über 2.5', under: 'Unter 2.5',
        bttsYes: 'Beide Ja', bttsNo: 'Beide Nein'
      }
    };
    const bl = betLabels[lang as keyof typeof betLabels] || betLabels.en;
    
    if (betType === 'MATCH_RESULT') {
      if (selection === '1') return bl.home;
      if (selection === 'X') return bl.draw;
      if (selection === '2') return bl.away;
    }
    if (betType === 'OVER_UNDER') {
      return selection === 'Over' ? bl.over : bl.under;
    }
    if (betType === 'BTTS') {
      return selection === 'Yes' ? bl.bttsYes : bl.bttsNo;
    }
    return selection;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
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

  const hasCoupons = data && (data.safe || data.balanced || data.risky);

  if (!hasCoupons) {
    return (
      <div className="bg-gray-800/50 rounded-2xl p-6 text-center">
        <p className="text-gray-400">{l.noData}</p>
        <p className="text-sm text-gray-500 mt-2">
  {lang === 'tr' ? "Kuponlar her gün 08:00'de oluşturulur" : 
   lang === 'de' ? "Tipps werden täglich um 08:00 Uhr erstellt" :
   "Coupons are generated daily at 08:00"}
</p>
      </div>
    );
  }

  const renderCoupon = (coupon: Coupon | null, type: 'safe' | 'balanced' | 'risky') => {
    if (!coupon) return null;

    const colors = {
      safe: 'from-green-600/20 to-green-900/20 border-green-500/30',
      balanced: 'from-yellow-600/20 to-yellow-900/20 border-yellow-500/30',
      risky: 'from-red-600/20 to-red-900/20 border-red-500/30'
    };

    const labelKey = type as keyof typeof l;

    return (
      <div className={`bg-gradient-to-br ${colors[type]} border rounded-xl p-4 mb-4`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white">{l[labelKey]}</h3>
          <div className="flex items-center gap-2">
            <span className="bg-white/10 px-2 py-1 rounded text-sm">
              {l.odds}: <span className="text-green-400 font-bold">{coupon.total_odds}</span>
            </span>
            <span className="bg-white/10 px-2 py-1 rounded text-sm">
              {l.confidence}: <span className="text-blue-400 font-bold">%{coupon.confidence}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {coupon.matches.map((match, idx) => (
            <div key={idx} className="bg-black/20 rounded-lg p-3 flex justify-between items-center">
              <div className="flex-1">
                <p className="text-white font-medium">{match.home_team} vs {match.away_team}</p>
                <p className="text-gray-400 text-xs">{match.league}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-bold">
                  {getBetTypeLabel(match.bet_type, match.selection)}
                </span>
                <span className="text-yellow-400 font-bold">{match.odds}</span>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-blue-400" title="AI Votes">🤖{match.aiVotes}/4</span>
                  <span className="text-purple-400" title="Agent Votes">🕵️{match.agentVotes}/3</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-white/10 pt-3">
          <div className="text-sm text-gray-400">
            <span>{l.stake}: <span className="text-white font-bold">{coupon.suggested_stake} CHF</span></span>
            <span className="mx-2">→</span>
            <span>{l.potential}: <span className="text-green-400 font-bold">{coupon.potential_win} CHF</span></span>
          </div>
          <button
            onClick={() => copyCoupon(coupon, l[labelKey] as string)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            📋 {l.copy}
          </button>
        </div>

        {coupon.ai_reasoning && (
          <p className="text-xs text-gray-500 mt-2 italic">{coupon.ai_reasoning}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">{l.title}</h2>
        <span className="text-gray-400 text-sm">📅 {data?.date}</span>
      </div>

      {renderCoupon(data?.safe || null, 'safe')}
      {renderCoupon(data?.balanced || null, 'balanced')}
      {renderCoupon(data?.risky || null, 'risky')}
    </div>
  );
}
