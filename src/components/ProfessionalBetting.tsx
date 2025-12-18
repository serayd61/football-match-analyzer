'use client';

import React, { useState } from 'react';

interface MarketPrediction {
  market: string;
  selection: string;
  confidence: number;
  reasoning?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  recommendation?: string;
  odds?: number;
}

interface ProfessionalMarketsData {
  enabled: boolean;
  matchResult?: MarketPrediction;
  overUnder25?: MarketPrediction;
  overUnder15?: MarketPrediction;
  overUnder35?: MarketPrediction;
  btts?: MarketPrediction;
  firstHalf?: {
    result?: MarketPrediction;
    over05?: MarketPrediction;
    over15?: MarketPrediction;
    btts?: MarketPrediction;
  };
  htft?: MarketPrediction;
  asianHandicap?: MarketPrediction;
  europeanHandicap?: MarketPrediction;
  teamGoals?: {
    homeOver05?: MarketPrediction;
    awayOver05?: MarketPrediction;
    homeOver15?: MarketPrediction;
    awayOver15?: MarketPrediction;
  };
  teamToScoreFirst?: MarketPrediction;
  comboBets?: {
    homeWinAndOver15?: MarketPrediction;
    awayWinAndOver15?: MarketPrediction;
    drawAndUnder25?: MarketPrediction;
    bttsAndOver25?: MarketPrediction;
  };
  corners?: MarketPrediction;
  cards?: MarketPrediction;
  exactGoals?: MarketPrediction;
  bestBets?: MarketPrediction[];
  safeBets?: MarketPrediction[];
  valueBets?: MarketPrediction[];
  riskyBets?: MarketPrediction[];
}

interface Props {
  data: ProfessionalMarketsData;
  homeTeam: string;
  awayTeam: string;
  language?: 'tr' | 'en' | 'de';
}

const labels = {
  tr: {
    title: 'Profesyonel Bahis Analizi',
    subtitle: 'AI destekli detaylı market analizi',
    mainMarkets: 'Ana Marketler',
    firstHalfMarkets: 'İlk Yarı Marketleri',
    specialMarkets: 'Özel Marketler',
    comboBets: 'Kombine Bahisler',
    teamGoals: 'Takım Golleri',
    bestBets: '🎯 En İyi Bahisler',
    safeBets: '🛡️ Güvenli Bahisler',
    valueBets: '💰 Value Bahisler',
    riskyBets: '⚠️ Riskli Bahisler',
    confidence: 'Güven',
    risk: 'Risk',
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    showAll: 'Tüm Marketleri Göster',
    hideDetails: 'Detayları Gizle',
  },
  en: {
    title: 'Professional Betting Analysis',
    subtitle: 'AI-powered detailed market analysis',
    mainMarkets: 'Main Markets',
    firstHalfMarkets: 'First Half Markets',
    specialMarkets: 'Special Markets',
    comboBets: 'Combo Bets',
    teamGoals: 'Team Goals',
    bestBets: '🎯 Best Bets',
    safeBets: '🛡️ Safe Bets',
    valueBets: '💰 Value Bets',
    riskyBets: '⚠️ Risky Bets',
    confidence: 'Confidence',
    risk: 'Risk',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    showAll: 'Show All Markets',
    hideDetails: 'Hide Details',
  },
  de: {
    title: 'Professionelle Wett-Analyse',
    subtitle: 'KI-gestützte detaillierte Marktanalyse',
    mainMarkets: 'Hauptmärkte',
    firstHalfMarkets: 'Halbzeitmärkte',
    specialMarkets: 'Spezialmärkte',
    comboBets: 'Kombi-Wetten',
    teamGoals: 'Teamtore',
    bestBets: '🎯 Beste Wetten',
    safeBets: '🛡️ Sichere Wetten',
    valueBets: '💰 Value Wetten',
    riskyBets: '⚠️ Riskante Wetten',
    confidence: 'Konfidenz',
    risk: 'Risiko',
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    showAll: 'Alle Märkte anzeigen',
    hideDetails: 'Details ausblenden',
  }
};

// Confidence color
function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-green-400';
  if (confidence >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 70) return 'bg-green-500/20 border-green-500/30';
  if (confidence >= 55) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function getRiskBadge(risk: string | undefined, l: typeof labels.tr): JSX.Element {
  const riskColors: Record<string, string> = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400',
  };
  const riskLabels: Record<string, string> = {
    low: l.low,
    medium: l.medium,
    high: l.high,
  };
  
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${riskColors[risk || 'medium']}`}>
      {riskLabels[risk || 'medium']}
    </span>
  );
}

// Market Card Component
function MarketCard({ prediction, showReasoning = false }: { prediction: MarketPrediction; showReasoning?: boolean }) {
  if (!prediction || !prediction.market) return null;
  
  // Güven değerini yuvarlayıp sınırla
  const confidence = Math.min(100, Math.max(0, Math.round(Number(prediction.confidence) || 50)));
  
  return (
    <div className={`p-4 rounded-xl border ${getConfidenceBg(confidence)} min-h-[100px]`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate max-w-[70%]">
          {prediction.market}
        </span>
        <span className={`font-bold text-lg ${getConfidenceColor(confidence)}`}>
          {confidence}%
        </span>
      </div>
      <div className="text-white font-bold text-xl">
        {prediction.selection || '-'}
      </div>
      {showReasoning && prediction.reasoning && (
        <p className="text-gray-400 text-xs mt-2 line-clamp-2">{prediction.reasoning}</p>
      )}
    </div>
  );
}

// Best Bet Card (Featured)
function BestBetCard({ prediction, index }: { prediction: MarketPrediction; index: number }) {
  if (!prediction || !prediction.market) return null;
  
  const medals = ['🥇', '🥈', '🥉'];
  const medal = medals[index] || `${index + 1}.`;
  const confidence = Math.min(100, Math.max(0, Math.round(Number(prediction.confidence) || 50)));
  
  return (
    <div className={`p-4 rounded-xl border-2 ${getConfidenceBg(confidence)} relative overflow-hidden`}>
      <div className="absolute -top-2 -right-2 text-4xl opacity-20">{medal}</div>
      <div className="flex items-center gap-4">
        <span className="text-3xl">{medal}</span>
        <div className="flex-1">
          <p className="text-gray-400 text-sm">{prediction.market}</p>
          <p className="text-white font-bold text-xl">{prediction.selection || '-'}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${getConfidenceColor(confidence)}`}>
            {confidence}%
          </p>
          {prediction.riskLevel && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              prediction.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
              prediction.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {prediction.riskLevel}
            </span>
          )}
        </div>
      </div>
      {prediction.reasoning && (
        <p className="text-gray-300 text-sm mt-3 line-clamp-2">{prediction.reasoning}</p>
      )}
    </div>
  );
}

export default function ProfessionalBetting({ data, homeTeam, awayTeam, language = 'tr' }: Props) {
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const l = labels[language];
  
  if (!data?.enabled) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 mt-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎰</span>
            {l.title}
          </h3>
          <p className="text-gray-400 text-sm">{l.subtitle}</p>
        </div>
        <button
          onClick={() => setShowAllMarkets(!showAllMarkets)}
          className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-all"
        >
          {showAllMarkets ? l.hideDetails : l.showAll}
        </button>
      </div>

      {/* Best Bets Section - Always Visible */}
      {data.bestBets && data.bestBets.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3">{l.bestBets}</h4>
          <div className="grid gap-3">
            {data.bestBets.slice(0, 3).map((bet, idx) => (
              <BestBetCard key={idx} prediction={bet} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {data.matchResult?.market && <MarketCard prediction={data.matchResult} />}
        {data.overUnder25?.market && <MarketCard prediction={data.overUnder25} />}
        {data.btts?.market && <MarketCard prediction={data.btts} />}
        {data.overUnder15?.market && <MarketCard prediction={data.overUnder15} />}
      </div>

      {/* Expanded View */}
      {showAllMarkets && (
        <div className="space-y-6 border-t border-gray-700 pt-6">
          {/* First Half Markets */}
          {data.firstHalf && (
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span>⏱️</span> {l.firstHalfMarkets}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.firstHalf.result && <MarketCard prediction={data.firstHalf.result} />}
                {data.firstHalf.over05 && <MarketCard prediction={data.firstHalf.over05} />}
                {data.firstHalf.over15 && <MarketCard prediction={data.firstHalf.over15} />}
                {data.firstHalf.btts && <MarketCard prediction={data.firstHalf.btts} />}
              </div>
            </div>
          )}

          {/* Special Markets */}
          <div>
            <h4 className="text-md font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span>⚡</span> {l.specialMarkets}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.htft && <MarketCard prediction={data.htft} />}
              {data.asianHandicap && <MarketCard prediction={data.asianHandicap} />}
              {data.teamToScoreFirst && <MarketCard prediction={data.teamToScoreFirst} />}
              {data.overUnder35 && <MarketCard prediction={data.overUnder35} />}
            </div>
          </div>

          {/* Team Goals */}
          {data.teamGoals && (
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span>⚽</span> {l.teamGoals}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.teamGoals.homeOver05 && <MarketCard prediction={data.teamGoals.homeOver05} />}
                {data.teamGoals.awayOver05 && <MarketCard prediction={data.teamGoals.awayOver05} />}
                {data.teamGoals.homeOver15 && <MarketCard prediction={data.teamGoals.homeOver15} />}
                {data.teamGoals.awayOver15 && <MarketCard prediction={data.teamGoals.awayOver15} />}
              </div>
            </div>
          )}

          {/* Combo Bets */}
          {data.comboBets && (
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span>🎲</span> {l.comboBets}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.comboBets.homeWinAndOver15 && <MarketCard prediction={data.comboBets.homeWinAndOver15} />}
                {data.comboBets.awayWinAndOver15 && <MarketCard prediction={data.comboBets.awayWinAndOver15} />}
                {data.comboBets.drawAndUnder25 && <MarketCard prediction={data.comboBets.drawAndUnder25} />}
                {data.comboBets.bttsAndOver25 && <MarketCard prediction={data.comboBets.bttsAndOver25} />}
              </div>
            </div>
          )}

          {/* Other Markets */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.corners && <MarketCard prediction={data.corners} />}
            {data.cards && <MarketCard prediction={data.cards} />}
            {data.exactGoals && <MarketCard prediction={data.exactGoals} />}
          </div>

          {/* Safe & Risky Bets */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Safe Bets */}
            {data.safeBets && data.safeBets.length > 0 && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                <h4 className="text-md font-semibold text-green-400 mb-3">{l.safeBets}</h4>
                <div className="space-y-2">
                  {data.safeBets.map((bet, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                      <div>
                        <span className="text-gray-400 text-xs">{bet.market}</span>
                        <p className="text-white font-medium">{bet.selection}</p>
                      </div>
                      <span className="text-green-400 font-bold">{bet.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Value Bets */}
            {data.valueBets && data.valueBets.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                <h4 className="text-md font-semibold text-yellow-400 mb-3">{l.valueBets}</h4>
                <div className="space-y-2">
                  {data.valueBets.map((bet, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                      <div>
                        <span className="text-gray-400 text-xs">{bet.market}</span>
                        <p className="text-white font-medium">{bet.selection}</p>
                      </div>
                      <span className="text-yellow-400 font-bold">{bet.confidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-gray-500 text-xs text-center">
          ⚠️ Bahis önerileri AI analizine dayanmaktadır. Sorumlu bahis oynayın.
        </p>
      </div>
    </div>
  );
}

