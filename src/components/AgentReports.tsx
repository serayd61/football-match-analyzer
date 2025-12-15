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
const ConfidenceBar = ({ value }: { value: number }) => {
  const getColor = () => {
    if (value >= 75) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${getColor()}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
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
      <span className="text-sm text-gray-400">%{confidence} güven</span>
    </div>
  );
};

// ============================================================================
// HELPER: Risk level'ı normalize et (string veya obje olabilir)
// ============================================================================
function getRiskLevel(riskAssessment: any): string {
  if (!riskAssessment) return 'Unknown';
  
  // Eğer string ise direkt döndür
  if (typeof riskAssessment === 'string') {
    return riskAssessment;
  }
  
  // Eğer obje ise level'ı al
  if (typeof riskAssessment === 'object' && riskAssessment.level) {
    return riskAssessment.level;
  }
  
  return 'Unknown';
}

function getRiskScore(riskAssessment: any): number | null {
  if (!riskAssessment) return null;
  
  if (typeof riskAssessment === 'object' && riskAssessment.score !== undefined) {
    return riskAssessment.score;
  }
  
  return null;
}

function getRiskFactors(riskAssessment: any): string[] {
  if (!riskAssessment) return [];
  
  if (typeof riskAssessment === 'object' && Array.isArray(riskAssessment.factors)) {
    return riskAssessment.factors;
  }
  
  return [];
}

function isLowRisk(level: string): boolean {
  const l = level.toLowerCase();
  return l === 'low' || l === 'düşük' || l === 'niedrig';
}

function isMediumRisk(level: string): boolean {
  const l = level.toLowerCase();
  return l === 'medium' || l === 'orta' || l === 'mittel';
}

// Deep Analysis Agent Card
const DeepAnalysisCard = ({ data, homeTeam, awayTeam }: { data: any; homeTeam: string; awayTeam: string }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  const riskLevel = getRiskLevel(data.riskLevel);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-6 border border-purple-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🔬</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Deep Analysis Agent</h3>
            <p className="text-sm text-purple-400">Çok Katmanlı Derin Analiz</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-purple-400 hover:text-purple-300 text-xl"
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Match Analysis */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              <span>📋</span> Maç Analizi
            </h4>
            <p className="text-gray-300">{data.matchAnalysis}</p>
          </div>

          {/* Critical Factors */}
          {data.criticalFactors && data.criticalFactors.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <span>⚡</span> Kritik Faktörler
              </h4>
              <ul className="space-y-2">
                {data.criticalFactors.map((factor: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300">
                    <span className="text-purple-400 mt-1">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Probabilities */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span>📊</span> Olasılıklar
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">%{data.probabilities?.homeWin || 0}</div>
                <div className="text-sm text-gray-400">{homeTeam}</div>
                <ConfidenceBar value={data.probabilities?.homeWin || 0} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">%{data.probabilities?.draw || 0}</div>
                <div className="text-sm text-gray-400">Beraberlik</div>
                <ConfidenceBar value={data.probabilities?.draw || 0} />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">%{data.probabilities?.awayWin || 0}</div>
                <div className="text-sm text-gray-400">{awayTeam}</div>
                <ConfidenceBar value={data.probabilities?.awayWin || 0} />
              </div>
            </div>
          </div>

          {/* Score Prediction */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              <span>⚽</span> Skor Tahmini
            </h4>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-purple-400">{data.scorePrediction?.score || 'N/A'}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-300">{data.scorePrediction?.reasoning}</p>
                {data.expectedScores && (
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-gray-500">Diğer olası skorlar:</span>
                    {data.expectedScores.map((score: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
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
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-400 mb-2">Toplam Gol</h5>
              <PredictionBadge prediction={data.overUnder?.prediction || 'N/A'} confidence={data.overUnder?.confidence || 0} />
              <p className="text-xs text-gray-500 mt-2">{data.overUnder?.reasoning}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-400 mb-2">KG VAR</h5>
              <PredictionBadge prediction={data.btts?.prediction || 'N/A'} confidence={data.btts?.confidence || 0} />
              <p className="text-xs text-gray-500 mt-2">{data.btts?.reasoning}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h5 className="text-sm font-medium text-gray-400 mb-2">Maç Sonucu</h5>
              <PredictionBadge prediction={data.matchResult?.prediction || 'N/A'} confidence={data.matchResult?.confidence || 0} />
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
            <span className="text-sm text-gray-400">Risk Seviyesi:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isLowRisk(riskLevel) ? 'bg-green-500/20 text-green-400' :
              isMediumRisk(riskLevel) ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {isLowRisk(riskLevel) ? '🟢 Düşük' : isMediumRisk(riskLevel) ? '🟡 Orta' : '🔴 Yüksek'}
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
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Stats Agent</h3>
            <p className="text-sm text-blue-400">İstatistiksel Analiz</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-400 hover:text-blue-300 text-xl">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">⚽ Gol Beklentisi</h4>
            <div className="flex items-center justify-center">
              <div className="text-5xl font-bold text-blue-400">{data.goalExpectancy?.toFixed(2) || data._calculatedStats?.expectedTotal || 'N/A'}</div>
              <div className="ml-4 text-left">
                <div className="text-sm text-gray-400">Toplam Beklenen Gol</div>
                <div className="text-xs text-gray-500">
                  {homeTeam}: {data._calculatedStats?.homeExpected || 'N/A'} | {awayTeam}: {data._calculatedStats?.awayExpected || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {data._calculatedStats && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-orange-400">%{data._calculatedStats.avgOver25}</div>
                <div className="text-sm text-gray-400">Over 2.5 Oranı</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">%{data._calculatedStats.avgBtts}</div>
                <div className="text-sm text-gray-400">KG VAR Oranı</div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Toplam Gol:</span>
                <PredictionBadge prediction={data.overUnder || 'N/A'} confidence={data.overUnderConfidence || 0} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.overUnderReasoning}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Maç Sonucu:</span>
                <PredictionBadge prediction={data.matchResult || 'N/A'} confidence={data.matchResultConfidence || 0} />
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">KG VAR:</span>
                <PredictionBadge prediction={data.btts || 'N/A'} confidence={data.bttsConfidence || 0} />
              </div>
            </div>
          </div>

          {data._calculatedStats?.dataQuality && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-400">Veri Kalitesi:</span>
              <div className="flex-1 max-w-32"><ConfidenceBar value={data._calculatedStats.dataQuality} /></div>
              <span className="text-sm font-medium text-white">%{data._calculatedStats.dataQuality}</span>
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
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Odds Agent</h3>
            <p className="text-sm text-green-400">Oran & Değer Analizi</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-green-400 hover:text-green-300 text-xl">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">📋 Oran Analizi</h4>
            <p className="text-gray-300">{data.oddsAnalysis}</p>
          </div>

          {data._valueAnalysis && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">📈 Değer Analizi</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Ev Sahibi Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.homeValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data._valueAnalysis.homeValue > 0 ? '+' : ''}{data._valueAnalysis.homeValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Over Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.overValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data._valueAnalysis.overValue > 0 ? '+' : ''}{data._valueAnalysis.overValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">BTTS Değeri</div>
                  <div className={`text-xl font-bold ${data._valueAnalysis.bttsValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data._valueAnalysis.bttsValue > 0 ? '+' : ''}{data._valueAnalysis.bttsValue}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">En İyi Değer</div>
                  <div className="text-xl font-bold text-green-400 uppercase">{data._valueAnalysis.bestValue}</div>
                </div>
              </div>
            </div>
          )}

          {data.valueBets && data.valueBets.length > 0 && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 mb-4 text-white">
              <h5 className="text-sm opacity-80 mb-2">💎 Değerli Bahisler</h5>
              <div className="flex flex-wrap gap-2">
                {data.valueBets.map((bet: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{bet}</span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Öneri:</span>
                <PredictionBadge prediction={data.recommendation || 'N/A'} confidence={data.confidence || 0} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-gray-400">Değer Derecesi:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.valueRating === 'High' ? 'bg-green-500/20 text-green-400' :
              data.valueRating === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
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
    if (sentiment === 'positive') return 'text-green-400 bg-green-500/20';
    if (sentiment === 'negative') return 'text-red-400 bg-red-500/20';
    return 'text-yellow-400 bg-yellow-500/20';
  };

  const getSentimentEmoji = (sentiment: string) => {
    if (sentiment === 'positive') return '🟢';
    if (sentiment === 'negative') return '🔴';
    return '🟡';
  };

  return (
    <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-2xl p-6 border border-pink-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🎭</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Sentiment Agent</h3>
            <p className="text-sm text-pink-400">Psikolojik Analiz</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-pink-400 hover:text-pink-300 text-xl">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏠</span>
                <h5 className="font-bold text-white">{homeTeam}</h5>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Moral</span>
                  <span className="text-white font-bold">{data.homeTeam?.morale || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.homeTeam?.morale || 0) * 10} />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Motivasyon</span>
                  <span className="text-white font-bold">{data.homeTeam?.motivation || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.homeTeam?.motivation || 0) * 10} />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Hazırlık</span>
                  <span className="text-white font-bold">{data.homeTeam?.preparation || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.homeTeam?.preparation || 0) * 10} />
              </div>
              <div className={`mt-3 px-2 py-1 rounded text-center text-sm font-medium ${getSentimentColor(data.homeTeam?.news_sentiment || 'neutral')}`}>
                {getSentimentEmoji(data.homeTeam?.news_sentiment || 'neutral')} {(data.homeTeam?.news_sentiment || 'neutral').toUpperCase()}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🚌</span>
                <h5 className="font-bold text-white">{awayTeam}</h5>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Moral</span>
                  <span className="text-white font-bold">{data.awayTeam?.morale || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.awayTeam?.morale || 0) * 10} />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Motivasyon</span>
                  <span className="text-white font-bold">{data.awayTeam?.motivation || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.awayTeam?.motivation || 0) * 10} />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Hazırlık</span>
                  <span className="text-white font-bold">{data.awayTeam?.preparation || 0}/10</span>
                </div>
                <ConfidenceBar value={(data.awayTeam?.preparation || 0) * 10} />
              </div>
              <div className={`mt-3 px-2 py-1 rounded text-center text-sm font-medium ${getSentimentColor(data.awayTeam?.news_sentiment || 'neutral')}`}>
                {getSentimentEmoji(data.awayTeam?.news_sentiment || 'neutral')} {(data.awayTeam?.news_sentiment || 'neutral').toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h5 className="font-semibold text-white mb-2">📰 {homeTeam} Haberleri</h5>
              <ul className="space-y-1">
                {data.homeTeam?.key_factors?.map((factor: string, idx: number) => (
                  <li key={idx} className="text-xs text-gray-400 flex items-start gap-1">
                    <span className="text-pink-400">•</span> {factor}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h5 className="font-semibold text-white mb-2">📰 {awayTeam} Haberleri</h5>
              <ul className="space-y-1">
                {data.awayTeam?.key_factors?.map((factor: string, idx: number) => (
                  <li key={idx} className="text-xs text-gray-400 flex items-start gap-1">
                    <span className="text-pink-400">•</span> {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>

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

          {data.warnings && data.warnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <h5 className="font-semibold text-yellow-400 mb-2">⚠️ Uyarılar</h5>
              <ul className="space-y-1">
                {data.warnings.map((warning: string, idx: number) => (
                  <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2"><span>•</span> {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// Strategy Agent Card - FIXED: riskAssessment obje desteği
// ============================================================================
const StrategyAgentCard = ({ data }: { data: any }) => {
  const [expanded, setExpanded] = useState(true);
  if (!data) return null;

  // ✅ FIX: riskAssessment string veya obje olabilir
  const riskLevel = getRiskLevel(data.riskAssessment);
  const riskScore = getRiskScore(data.riskAssessment);
  const riskFactors = getRiskFactors(data.riskAssessment);

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-6 border border-amber-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Strategy Agent</h3>
            <p className="text-sm text-amber-400">Strateji & Konsensüs</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-amber-400 hover:text-amber-300 text-xl">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          {/* ✅ FIX: Risk Assessment - obje desteği */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-white flex items-center gap-2">⚠️ Risk Değerlendirmesi</h4>
              <div className="flex items-center gap-2">
                {riskScore !== null && (
                  <span className="text-sm text-gray-400">{riskScore}/100</span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isLowRisk(riskLevel) ? 'bg-green-500/20 text-green-400' :
                  isMediumRisk(riskLevel) ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {isLowRisk(riskLevel) ? '🟢 Düşük' : isMediumRisk(riskLevel) ? '🟡 Orta' : '🔴 Yüksek'}
                </span>
              </div>
            </div>
            
            {/* Risk Score Bar */}
            {riskScore !== null && (
              <div className="mb-2">
                <ConfidenceBar value={100 - riskScore} />
              </div>
            )}
            
            {/* Risk Factors */}
            {riskFactors.length > 0 && (
              <ul className="space-y-1 mt-2">
                {riskFactors.map((factor: string, idx: number) => (
                  <li key={idx} className="text-xs text-gray-400 flex items-start gap-1">
                    <span className="text-amber-400">•</span> {factor}
                  </li>
                ))}
              </ul>
            )}
            
            {/* Legacy riskReasoning */}
            {data.riskReasoning && (
              <p className="text-sm text-gray-300 mt-2">{data.riskReasoning}</p>
            )}
          </div>

          {data._consensus && (
            <div className="space-y-3 mb-4">
              <h4 className="font-semibold text-white flex items-center gap-2">🤝 Agent Konsensüsü</h4>
              {data._consensus.overUnderConsensus && (
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">Toplam Gol</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                        {data._consensus.overUnderConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge prediction={data._consensus.overUnderConsensus.prediction} confidence={data._consensus.overUnderConsensus.confidence} />
                    </div>
                  </div>
                </div>
              )}
              {data._consensus.matchResultConsensus && (
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">Maç Sonucu</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                        {data._consensus.matchResultConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge prediction={data._consensus.matchResultConsensus.prediction} confidence={data._consensus.matchResultConsensus.confidence} />
                    </div>
                  </div>
                </div>
              )}
              {data._consensus.bttsConsensus && (
                <div className="bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">KG VAR</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                        {data._consensus.bttsConsensus.agree}/3 hemfikir
                      </span>
                      <PredictionBadge prediction={data._consensus.bttsConsensus.prediction} confidence={data._consensus.bttsConsensus.confidence} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {data.avoidBets && data.avoidBets.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <h5 className="font-semibold text-red-400 mb-2">❌ Kaçınılması Gerekenler</h5>
              <div className="flex flex-wrap gap-2">
                {data.avoidBets.map((bet: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">{bet}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Stake Önerisi:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              data.stakeSuggestion === 'Düşük' || data.stakeSuggestion === 'Low' ? 'bg-green-500/20 text-green-400' :
              data.stakeSuggestion === 'Orta' || data.stakeSuggestion === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>{data.stakeSuggestion || 'N/A'}</span>
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
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
          <span className="text-3xl">🏆</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">Final Konsensüs</h3>
          <p className="text-gray-400">5 Agent Ağırlıklı Analiz</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Toplam Gol</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white">{data.overUnder?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.overUnder?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.overUnder?.agreement}/4 agent</div>
          <ConfidenceBar value={data.overUnder?.confidence || 0} />
        </div>
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Maç Sonucu</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white">{data.matchResult?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.matchResult?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.matchResult?.agreement}/5 agent</div>
          <ConfidenceBar value={data.matchResult?.confidence || 0} />
        </div>
        <div className="bg-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">KG VAR</div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white">{data.btts?.prediction}</span>
            <span className="text-sm text-gray-400">%{data.btts?.confidence}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.btts?.agreement}/4 agent</div>
          <ConfidenceBar value={data.btts?.confidence || 0} />
        </div>
      </div>

      <div className="bg-white/10 rounded-xl p-4 mb-6 text-center">
        <div className="text-sm text-gray-400 mb-2">Tahmini Skor</div>
        <div className="text-5xl font-bold text-yellow-400">{data.scorePrediction?.score || 'N/A'}</div>
        <div className="text-sm text-gray-400 mt-2">{data.scorePrediction?.reasoning}</div>
      </div>

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
    </div>
  );
};

// Main Component
export default function AgentReports({ reports, homeTeam, awayTeam, language = 'tr' }: AgentReportsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'consensus'>('all');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-gray-700/30 rounded-xl">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          📊 Tüm Agentlar
        </button>
        <button
          onClick={() => setActiveTab('consensus')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
            activeTab === 'consensus'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
          }`}
        >
          🏆 Final Konsensüs
        </button>
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
