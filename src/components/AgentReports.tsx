// src/components/AgentReports.tsx
'use client';

import React, { useState } from 'react';

interface AgentReportsProps {
  reports: {
    deepAnalysis?: any;
    stats?: any;
    odds?: any;
    strategy?: any;
    sentiment?: any;
    weightedConsensus?: any;
  };
  homeTeam: string;
  awayTeam: string;
  language?: 'tr' | 'en' | 'de';
}

// Confidence bar component
const ConfidenceBar = ({ value, color = 'blue' }: { value: number; color?: string }) => {
  const getColor = () => {
    if (value >= 75) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${getColor()}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
};

// Score badge component
const ScoreBadge = ({ value, max = 10, label }: { value: number; max?: number; label: string }) => {
  const percentage = (value / max) * 100;
  const getColor = () => {
    if (percentage >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (percentage >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColor()}`}>
      {label}: {value}/{max}
    </div>
  );
};

// Prediction badge
const PredictionBadge = ({ prediction, confidence }: { prediction: string; confidence: number }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold text-lg">
        {prediction}
      </span>
      <span className="text-sm text-gray-500">%{confidence} güven</span>
    </div>
  );
};

// Deep Analysis Agent Card
const DeepAnalysisCard = ({ data, homeTeam, awayTeam }: { data: any; homeTeam: string; awayTeam: string }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🔬</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">Deep Analysis Agent</h3>
            <p className="text-sm text-purple-600 dark:text-purple-400">Çok Katmanlı Derin Analiz</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-purple-600 hover:text-purple-800"
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Match Analysis */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Maç Analizi</h4>
            <p className="text-gray-600 dark:text-gray-400">{data.matchAnalysis}</p>
          </div>

          {/* Critical Factors */}
          {data.criticalFactors && data.criticalFactors.length > 0 && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">⚡ Kritik Faktörler</h4>
              <ul className="space-y-2">
                {data.criticalFactors.map((factor: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <span className="text-purple-500 mt-1">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Probabilities */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📊 Olasılıklar</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">%{data.probabilities?.homeWin || 0}</div>
                <div className="text-sm text-gray-500">{homeTeam}</div>
                <ConfidenceBar value={data.probabilities?.homeWin || 0} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">%{data.probabilities?.draw || 0}</div>
                <div className="text-sm text-gray-500">Beraberlik</div>
                <ConfidenceBar value={data.probabilities?.draw || 0} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">%{data.probabilities?.awayWin || 0}</div>
                <div className="text-sm text-gray-500">{awayTeam}</div>
                <ConfidenceBar value={data.probabilities?.awayWin || 0} />
              </div>
            </div>
          </div>

          {/* Score Prediction */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">⚽ Skor Tahmini</h4>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-purple-600">{data.scorePrediction?.score || 'N/A'}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">{data.scorePrediction?.reasoning}</p>
                {data.expectedScores && (
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-gray-500">Diğer olası skorlar:</span>
                    {data.expectedScores.map((score: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                        {score}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Predictions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Over/Under */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-500 mb-2">Toplam Gol</h5>
              <PredictionBadge 
                prediction={data.overUnder?.prediction || 'N/A'} 
                confidence={data.overUnder?.confidence || 0} 
              />
              <p className="text-xs text-gray-500 mt-2">{data.overUnder?.reasoning}</p>
            </div>

            {/* BTTS */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-500 mb-2">KG VAR</h5>
              <PredictionBadge 
                prediction={data.btts?.prediction || 'N/A'} 
                confidence={data.btts?.confidence || 0} 
              />
              <p className="text-xs text-gray-500 mt-2">{data.btts?.reasoning}</p>
            </div>

            {/* Match Result */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-500 mb-2">Maç Sonucu</h5>
              <PredictionBadge 
                prediction={data.matchResult?.prediction || 'N/A'} 
                confidence={data.matchResult?.confidence || 0} 
              />
              <p className="text-xs text-gray-500 mt-2">{data.matchResult?.reasoning}</p>
            </div>
          </div>

          {/* Best Bet */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm opacity-80">🎯 En İyi Bahis Önerisi</h5>
                <div className="text-xl font-bold">{data.bestBet?.type}: {data.bestBet?.selection}</div>
                <p className="text-sm opacity-80 mt-1">{data.bestBet?.reasoning}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">%{data.bestBet?.confidence || 0}</div>
                <div className="text-sm opacity-80">Güven</div>
              </div>
            </div>
          </div>

          {/* Risk Level */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">Risk Seviyesi:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
              data.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {data.riskLevel === 'Low' ? '🟢 Düşük' : data.riskLevel === 'Medium' ? '🟡 Orta' : '🔴 Yüksek'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// Stats Agent Card
const StatsAgentCard = ({ data, homeTeam, awayTeam }: { data: any; homeTeam: string; awayTeam: string }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">Stats Agent</h3>
            <p className="text-sm text-blue-600 dark:text-blue-400">İstatistiksel Analiz</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-600 hover:text-blue-800">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Goal Expectancy */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">⚽ Gol Beklentisi</h4>
            <div className="flex items-center justify-center">
              <div className="text-5xl font-bold text-blue-600">{data.goalExpectancy?.toFixed(2) || data._calculatedStats?.expectedTotal || 'N/A'}</div>
              <div className="ml-4 text-left">
                <div className="text-sm text-gray-500">Toplam Beklenen Gol</div>
                <div className="text-xs text-gray-400">
                  {homeTeam}: {data._calculatedStats?.homeExpected || 'N/A'} | {awayTeam}: {data._calculatedStats?.awayExpected || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          {data._calculatedStats && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-orange-500">%{data._calculatedStats.avgOver25}</div>
                <div className="text-sm text-gray-500">Over 2.5 Oranı</div>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-500">%{data._calculatedStats.avgBtts}</div>
                <div className="text-sm text-gray-500">KG VAR Oranı</div>
              </div>
            </div>
          )}

          {/* Predictions */}
          <div className="space-y-3">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Toplam Gol:</span>
                <PredictionBadge prediction={data.overUnder || 'N/A'} confidence={data.overUnderConfidence || 0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.overUnderReasoning}</p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Maç Sonucu:</span>
                <PredictionBadge prediction={data.matchResult || 'N/A'} confidence={data.matchResultConfidence || 0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.matchResultReasoning}</p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">KG VAR:</span>
                <PredictionBadge prediction={data.btts || 'N/A'} confidence={data.bttsConfidence || 0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.bttsReasoning}</p>
            </div>
          </div>

          {/* Data Quality */}
          {data._calculatedStats?.dataQuality && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-500">Veri Kalitesi:</span>
              <div className="flex-1 max-w-32">
                <ConfidenceBar value={data._calculatedStats.dataQuality} />
              </div>
              <span className="text-sm font-medium">%{data._calculatedStats.dataQuality}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Odds Agent Card
const OddsAgentCard = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-green-900 dark:text-green-100">Odds Agent</h3>
            <p className="text-sm text-green-600 dark:text-green-400">Oran & Değer Analizi</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-green-600 hover:text-green-800">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Analysis */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Oran Analizi</h4>
            <p className="text-gray-600 dark:text-gray-400">{data.oddsAnalysis}</p>
          </div>

          {/* Value Analysis */}
          {data._valueAnalysis && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📈 Değer Analizi</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Ev Sahibi Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.homeValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data._valueAnalysis.homeValue > 0 ? '+' : ''}{data._valueAnalysis.homeValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Over Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.overValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data._valueAnalysis.overValue > 0 ? '+' : ''}{data._valueAnalysis.overValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">BTTS Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.bttsValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data._valueAnalysis.bttsValue > 0 ? '+' : ''}{data._valueAnalysis.bttsValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">En İyi Değer</div>
                  <div className="text-xl font-bold text-green-600 uppercase">{data._valueAnalysis.bestValue}</div>
                </div>
              </div>
            </div>
          )}

          {/* Value Bets */}
          {data.valueBets && data.valueBets.length > 0 && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 mb-4 text-white">
              <h5 className="text-sm opacity-80 mb-2">💎 Değerli Bahisler</h5>
              <div className="flex flex-wrap gap-2">
                {data.valueBets.map((bet: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    {bet}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-3">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Öneri:</span>
                <PredictionBadge prediction={data.recommendation || 'N/A'} confidence={data.confidence || 0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.recommendationReasoning}</p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">MS Değer:</span>
                <span className="font-bold uppercase">{data.matchWinnerValue || 'N/A'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.matchWinnerReasoning}</p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">KG Değer:</span>
                <span className="font-bold uppercase">{data.bttsValue || 'N/A'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.bttsReasoning}</p>
            </div>
          </div>

          {/* Value Rating */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">Değer Derecesi:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.valueRating === 'High' ? 'bg-green-100 text-green-800' :
              data.valueRating === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {data.valueRating === 'High' ? '🟢 Yüksek' : data.valueRating === 'Medium' ? '🟡 Orta' : '🔴 Düşük'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// Sentiment Agent Card
const SentimentAgentCard = ({ data, homeTeam, awayTeam }: { data: any; homeTeam: string; awayTeam: string }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'text-green-600 bg-green-100';
    if (sentiment === 'negative') return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getSentimentEmoji = (sentiment: string) => {
    if (sentiment === 'positive') return '🟢';
    if (sentiment === 'negative') return '🔴';
    return '🟡';
  };

  return (
    <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-2xl p-6 border border-pink-200 dark:border-pink-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🎭</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-pink-900 dark:text-pink-100">Sentiment Agent</h3>
            <p className="text-sm text-pink-600 dark:text-pink-400">Psikolojik Analiz</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-pink-600 hover:text-pink-800">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Teams Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Home Team */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏠</span>
                <h5 className="font-bold text-gray-800 dark:text-gray-200">{homeTeam}</h5>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moral</span>
                  <ScoreBadge value={data.homeTeam?.morale || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.homeTeam?.morale || 0) * 10} />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Motivasyon</span>
                  <ScoreBadge value={data.homeTeam?.motivation || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.homeTeam?.motivation || 0) * 10} />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Hazırlık</span>
                  <ScoreBadge value={data.homeTeam?.preparation || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.homeTeam?.preparation || 0) * 10} />
              </div>

              <div className={`mt-3 px-2 py-1 rounded text-center text-sm font-medium ${getSentimentColor(data.homeTeam?.news_sentiment || 'neutral')}`}>
                {getSentimentEmoji(data.homeTeam?.news_sentiment || 'neutral')} {(data.homeTeam?.news_sentiment || 'neutral').toUpperCase()}
              </div>
            </div>

            {/* Away Team */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🚌</span>
                <h5 className="font-bold text-gray-800 dark:text-gray-200">{awayTeam}</h5>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moral</span>
                  <ScoreBadge value={data.awayTeam?.morale || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.awayTeam?.morale || 0) * 10} />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Motivasyon</span>
                  <ScoreBadge value={data.awayTeam?.motivation || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.awayTeam?.motivation || 0) * 10} />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Hazırlık</span>
                  <ScoreBadge value={data.awayTeam?.preparation || 0} max={10} label="" />
                </div>
                <ConfidenceBar value={(data.awayTeam?.preparation || 0) * 10} />
              </div>

              <div className={`mt-3 px-2 py-1 rounded text-center text-sm font-medium ${getSentimentColor(data.awayTeam?.news_sentiment || 'neutral')}`}>
                {getSentimentEmoji(data.awayTeam?.news_sentiment || 'neutral')} {(data.awayTeam?.news_sentiment || 'neutral').toUpperCase()}
              </div>
            </div>
          </div>

          {/* Key Factors */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">📰 {homeTeam} Haberleri</h5>
              <ul className="space-y-1">
                {data.homeTeam?.key_factors?.map((factor: string, idx: number) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                    <span className="text-pink-500">•</span> {factor}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4">
              <h5 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">📰 {awayTeam} Haberleri</h5>
              <ul className="space-y-1">
                {data.awayTeam?.key_factors?.map((factor: string, idx: number) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                    <span className="text-pink-500">•</span> {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Psychological Edge */}
          {data.psychologicalEdge && (
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl p-4 text-white mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm opacity-80">🎯 Psikolojik Üstünlük</h5>
                  <div className="text-xl font-bold">
                    {data.psychologicalEdge.team === 'home' ? homeTeam : 
                     data.psychologicalEdge.team === 'away' ? awayTeam : 'Dengeli'}
                  </div>
                  <p className="text-sm opacity-80 mt-1">{data.psychologicalEdge.reasoning}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">%{data.psychologicalEdge.confidence}</div>
                  <div className="text-sm opacity-80">Güven</div>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Uyarılar</h5>
              <ul className="space-y-1">
                {data.warnings.map((warning: string, idx: number) => (
                  <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                    <span>•</span> {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Strategy Agent Card
const StrategyAgentCard = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100">Strategy Agent</h3>
            <p className="text-sm text-amber-600 dark:text-amber-400">Strateji & Konsensüs</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-amber-600 hover:text-amber-800">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Risk Assessment */}
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">⚠️ Risk Değerlendirmesi</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.riskAssessment === 'Düşük' || data.riskAssessment === 'Low' ? 'bg-green-100 text-green-800' :
                data.riskAssessment === 'Orta' || data.riskAssessment === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {data.riskAssessment}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{data.riskReasoning}</p>
          </div>

          {/* Consensus */}
          {data._consensus && (
            <div className="space-y-3 mb-4">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">🤝 Agent Konsensüsü</h4>
              
              {data._consensus.overUnderConsensus && (
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Toplam Gol</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 rounded text-sm">
                        {data._consensus.overUnderConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge 
                        prediction={data._consensus.overUnderConsensus.prediction} 
                        confidence={data._consensus.overUnderConsensus.confidence} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {data._consensus.matchResultConsensus && (
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Maç Sonucu</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 rounded text-sm">
                        {data._consensus.matchResultConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge 
                        prediction={data._consensus.matchResultConsensus.prediction} 
                        confidence={data._consensus.matchResultConsensus.confidence} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {data._consensus.bttsConsensus && (
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">KG VAR</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 rounded text-sm">
                        {data._consensus.bttsConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge 
                        prediction={data._consensus.bttsConsensus.prediction} 
                        confidence={data._consensus.bttsConsensus.confidence} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommended Bets */}
          {data.recommendedBets && data.recommendedBets.length > 0 && (
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-4 text-white mb-4">
              <h5 className="text-sm opacity-80 mb-2">✅ Önerilen Bahisler</h5>
              {data.recommendedBets.map((bet: any, idx: number) => (
                <div key={idx} className="bg-white/10 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{bet.type}: {bet.selection}</div>
                      <div className="text-sm opacity-80">{bet.reasoning}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">%{bet.confidence}</div>
                      <div className="text-xs opacity-80">{bet.agentAgreement}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Avoid Bets */}
          {data.avoidBets && data.avoidBets.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
              <h5 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Kaçınılması Gerekenler</h5>
              <div className="flex flex-wrap gap-2">
                {data.avoidBets.map((bet: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-full text-sm">
                    {bet}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stake Suggestion */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-gray-500">Stake Önerisi:</span>
              <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                data.stakeSuggestion === 'Düşük' || data.stakeSuggestion === 'Low' ? 'bg-green-100 text-green-800' :
                data.stakeSuggestion === 'Orta' || data.stakeSuggestion === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {data.stakeSuggestion}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Final Consensus Card
const FinalConsensusCard = ({ data, homeTeam, awayTeam }: { data: any; homeTeam: string; awayTeam: string }) => {
  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
          <span className="text-3xl">🏆</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold">Final Konsensüs</h3>
          <p className="text-gray-400">5 Agent Ağırlıklı Analiz</p>
        </div>
      </div>

      {/* Main Predictions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Over/Under */}
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Toplam Gol</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{data.overUnder?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.overUnder?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.overUnder?.agreement}/4 agent</div>
          <ConfidenceBar value={data.overUnder?.confidence || 0} />
        </div>

        {/* Match Result */}
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Maç Sonucu</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{data.matchResult?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.matchResult?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.matchResult?.agreement}/5 agent</div>
          <ConfidenceBar value={data.matchResult?.confidence || 0} />
        </div>

        {/* BTTS */}
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">KG VAR</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{data.btts?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.btts?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.btts?.agreement}/4 agent</div>
          <ConfidenceBar value={data.btts?.confidence || 0} />
        </div>
      </div>

      {/* Score Prediction */}
      <div className="bg-white/10 rounded-xl p-4 mb-6 text-center">
        <div className="text-sm text-gray-400 mb-2">Tahmini Skor</div>
        <div className="text-5xl font-bold text-yellow-400">{data.scorePrediction?.score || 'N/A'}</div>
        <div className="text-sm text-gray-400 mt-2">{data.scorePrediction?.reasoning}</div>
      </div>

      {/* Best Bet */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-black/60">🎯 En İyi Bahis</div>
            <div className="text-2xl font-bold text-black">{data.bestBet?.type}</div>
            <div className="text-3xl font-black text-black">{data.bestBet?.selection}</div>
            <div className="text-sm text-black/60 mt-1">{data.bestBet?.agreement} agent hemfikir</div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-black">%{data.bestBet?.confidence}</div>
            <div className="text-sm text-black/60">Güven Oranı</div>
          </div>
        </div>
      </div>

      {/* Agent Contributions */}
      <div className="mt-6">
        <div className="text-sm text-gray-400 mb-2">Agent Katkıları</div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(data.agentContributions || {}).map(([agent, weight]) => (
            <span key={agent} className="px-3 py-1 bg-white/10 rounded-full text-xs">
              {agent}: {weight as string}
            </span>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {data.sentiment?.warnings && data.sentiment.warnings.length > 0 && (
        <div className="mt-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
          <div className="text-yellow-400 font-semibold mb-2">⚠️ Dikkat Edilmesi Gerekenler</div>
          <ul className="space-y-1">
            {data.sentiment.warnings.map((w: string, idx: number) => (
              <li key={idx} className="text-sm text-yellow-200">• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Main Component
export default function AgentReports({ reports, homeTeam, awayTeam, language = 'tr' }: AgentReportsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'consensus'>('all');

  const tabs = [
    { id: 'all', label: 'Tüm Agentlar', icon: '📊' },
    { id: 'consensus', label: 'Final Konsensüs', icon: '🏆' },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'all' | 'consensus')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'all' ? (
        <div className="space-y-6">
          <DeepAnalysisCard data={reports.deepAnalysis} homeTeam={homeTeam} awayTeam={awayTeam} />
          <StatsAgentCard data={reports.stats} homeTeam={homeTeam} awayTeam={awayTeam} />
          <OddsAgentCard data={reports.odds} />
          <SentimentAgentCard data={reports.sentiment} homeTeam={homeTeam} awayTeam={awayTeam} />
          <StrategyAgentCard data={reports.strategy} />
        </div>
      ) : (
        <FinalConsensusCard data={reports.weightedConsensus} homeTeam={homeTeam} awayTeam={awayTeam} />
      )}
    </div>
  );
}
