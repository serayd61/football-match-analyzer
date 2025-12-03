'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  date: string;
  status: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');
  
  // Analysis states
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // Agent states
  const [agentMode, setAgentMode] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentPhase, setAgentPhase] = useState('');
  
  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // Labels
  const labels: Record<string, Record<string, string>> = {
    tr: {
      dashboard: 'Dashboard',
      todayMatches: 'Günün Maçları',
      search: 'Takım ara...',
      allLeagues: 'Tüm Ligler',
      analyze: '🤖 Analiz Et',
      analyzing: '⏳ Analiz ediliyor...',
      aiAgents: '🧠 AI Ajanları',
      agentAnalysis: 'Ajan Analizi',
      runAgents: '🚀 Ajanları Çalıştır',
      runningAgents: '⏳ Ajanlar çalışıyor...',
      close: 'Kapat',
      noMatches: 'Bu tarihte maç bulunamadı',
      loading: 'Yükleniyor...',
      profile: 'Profil',
      logout: 'Çıkış',
      matchResult: 'Maç Sonucu',
      overUnder: 'Üst/Alt 2.5',
      btts: 'Karşılıklı Gol',
      doubleChance: 'Çifte Şans',
      halfTime: 'İlk Yarı',
      correctScore: 'Doğru Skor',
      bestBet: 'En İyi Bahis',
      riskLevel: 'Risk Seviyesi',
      aiStatus: 'AI Durumu',
      scoutReport: 'Scout Raporu',
      statsReport: 'İstatistik Raporu',
      oddsReport: 'Oran Raporu',
      strategyReport: 'Strateji Raporu',
      consensusReport: 'Konsensüs Raporu',
      fromCache: 'Önbellekten',
      dailyUsage: 'Günlük Kullanım',
      unanimous: 'Oybirliği',
      votes: 'oy',
      confidence: 'Güven',
      phase1: '🔍 Scout, Stats, Odds ajanları çalışıyor...',
      phase2: '🧠 Strateji ajanı çalışıyor...',
      phase3: '⚖️ Konsensüs ajanı çalışıyor...',
      complete: '✅ Tamamlandı!',
    },
    en: {
      dashboard: 'Dashboard',
      todayMatches: "Today's Matches",
      search: 'Search team...',
      allLeagues: 'All Leagues',
      analyze: '🤖 Analyze',
      analyzing: '⏳ Analyzing...',
      aiAgents: '🧠 AI Agents',
      agentAnalysis: 'Agent Analysis',
      runAgents: '🚀 Run Agents',
      runningAgents: '⏳ Agents running...',
      close: 'Close',
      noMatches: 'No matches found for this date',
      loading: 'Loading...',
      profile: 'Profile',
      logout: 'Logout',
      matchResult: 'Match Result',
      overUnder: 'Over/Under 2.5',
      btts: 'Both Teams Score',
      doubleChance: 'Double Chance',
      halfTime: 'Half Time',
      correctScore: 'Correct Score',
      bestBet: 'Best Bet',
      riskLevel: 'Risk Level',
      aiStatus: 'AI Status',
      scoutReport: 'Scout Report',
      statsReport: 'Stats Report',
      oddsReport: 'Odds Report',
      strategyReport: 'Strategy Report',
      consensusReport: 'Consensus Report',
      fromCache: 'From Cache',
      dailyUsage: 'Daily Usage',
      unanimous: 'Unanimous',
      votes: 'votes',
      confidence: 'Confidence',
      phase1: '🔍 Scout, Stats, Odds agents running...',
      phase2: '🧠 Strategy agent running...',
      phase3: '⚖️ Consensus agent running...',
      complete: '✅ Complete!',
    },
    de: {
      dashboard: 'Dashboard',
      todayMatches: 'Heutige Spiele',
      search: 'Team suchen...',
      allLeagues: 'Alle Ligen',
      analyze: '🤖 Analysieren',
      analyzing: '⏳ Analysiere...',
      aiAgents: '🧠 KI-Agenten',
      agentAnalysis: 'Agenten-Analyse',
      runAgents: '🚀 Agenten starten',
      runningAgents: '⏳ Agenten laufen...',
      close: 'Schließen',
      noMatches: 'Keine Spiele für dieses Datum',
      loading: 'Laden...',
      profile: 'Profil',
      logout: 'Abmelden',
      matchResult: 'Spielergebnis',
      overUnder: 'Über/Unter 2.5',
      btts: 'Beide treffen',
      doubleChance: 'Doppelte Chance',
      halfTime: 'Halbzeit',
      correctScore: 'Genaues Ergebnis',
      bestBet: 'Beste Wette',
      riskLevel: 'Risikoniveau',
      aiStatus: 'KI-Status',
      scoutReport: 'Scout-Bericht',
      statsReport: 'Statistik-Bericht',
      oddsReport: 'Quoten-Bericht',
      strategyReport: 'Strategie-Bericht',
      consensusReport: 'Konsens-Bericht',
      fromCache: 'Aus Cache',
      dailyUsage: 'Tägliche Nutzung',
      unanimous: 'Einstimmig',
      votes: 'Stimmen',
      confidence: 'Konfidenz',
      phase1: '🔍 Scout, Stats, Odds Agenten laufen...',
      phase2: '🧠 Strategie-Agent läuft...',
      phase3: '⚖️ Konsens-Agent läuft...',
      complete: '✅ Fertig!',
    },
  };

  const l = labels[lang] || labels.en;

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch matches
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?date=${selectedDate}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setFilteredMatches(data.matches || []);
    } catch (error) {
      console.error('Fetch matches error:', error);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (session) {
      fetchMatches();
      fetchFavorites();
    }
  }, [session, fetchMatches]);

  // Fetch favorites
  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      if (data.favorites) {
        setFavoriteIds(data.favorites.map((f: any) => f.fixture_id));
      }
    } catch (error) {
      console.error('Fetch favorites error:', error);
    }
  };

  // Filter matches
  useEffect(() => {
    let filtered = matches;

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.awayTeam.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedLeague !== 'all') {
      filtered = filtered.filter((m) => m.league === selectedLeague);
    }

    setFilteredMatches(filtered);
  }, [matches, searchQuery, selectedLeague]);

  // Get unique leagues
  const leagues = [...new Set(matches.map((m) => m.league))];

  // Standard Analysis (Claude + GPT + Gemini + Heurist Consensus)
  const analyzeMatch = async (match: Match) => {
    setSelectedMatch(match);
    setAnalyzing(true);
    setAnalysis(null);
    setAgentMode(false);
    setAgentAnalysis(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          language: lang,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAnalysis(data);
      } else {
        console.error('Analysis error:', data.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }

    setAnalyzing(false);
  };

  // Agent Analysis (Heurist Multi-Agent System)
  const runAgentAnalysis = async () => {
    if (!selectedMatch) return;

    setAgentMode(true);
    setAgentLoading(true);
    setAgentAnalysis(null);
    setAgentPhase(l.phase1);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixtureId: selectedMatch.id,
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          homeTeamId: selectedMatch.homeTeamId,
          awayTeamId: selectedMatch.awayTeamId,
          language: lang,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setAgentAnalysis(data);
        setAgentPhase(l.complete);
      } else {
        console.error('Agent error:', data.error);
        setAgentPhase('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error('Agent error:', error);
      setAgentPhase('❌ Error');
    }

    setAgentLoading(false);
  };

  // Toggle favorite
  const toggleFavorite = async (fixtureId: number) => {
    try {
      await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId }),
      });

      if (favoriteIds.includes(fixtureId)) {
        setFavoriteIds(favoriteIds.filter((id) => id !== fixtureId));
      } else {
        setFavoriteIds([...favoriteIds, fixtureId]);
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  // Format analysis for display
  const formatMainAnalysis = (data: any) => {
    if (!data?.analysis) return null;
    const a = data.analysis;

    return (
      <div className="space-y-4">
        {/* AI Status */}
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">{l.aiStatus}</div>
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded text-xs ${data.aiStatus?.claude === '✅' ? 'bg-green-600' : 'bg-red-600'}`}>
              Claude {data.aiStatus?.claude}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${data.aiStatus?.openai === '✅' ? 'bg-green-600' : 'bg-red-600'}`}>
              GPT-4 {data.aiStatus?.openai}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${data.aiStatus?.gemini === '✅' ? 'bg-green-600' : 'bg-red-600'}`}>
              Gemini {data.aiStatus?.gemini}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${data.aiStatus?.heurist === '✅' ? 'bg-purple-600' : 'bg-red-600'}`}>
              Heurist {data.aiStatus?.heurist || '❌'}
            </span>
          </div>
          {data.fromCache && (
            <div className="text-xs text-yellow-400 mt-2">⚡ {l.fromCache}</div>
          )}
          {data.usage && (
            <div className="text-xs text-gray-400 mt-1">
              📊 {l.dailyUsage}: {data.usage.count}/{data.usage.limit}
            </div>
          )}
        </div>

        {/* Main Predictions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Match Result */}
          {a.matchResult && (
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg p-3 border border-blue-500/30">
              <div className="text-xs text-gray-400">{l.matchResult}</div>
              <div className="text-2xl font-bold text-blue-400">{a.matchResult.prediction}</div>
              <div className="text-sm text-gray-300">{a.matchResult.confidence}% {l.confidence}</div>
              {a.matchResult.unanimous && <div className="text-xs text-green-400">🔥 {l.unanimous}</div>}
              {a.matchResult.votes && <div className="text-xs text-gray-500">{a.matchResult.votes}/{a.matchResult.totalVotes} {l.votes}</div>}
            </div>
          )}

          {/* Over/Under 2.5 */}
          {a.overUnder25 && (
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg p-3 border border-green-500/30">
              <div className="text-xs text-gray-400">{l.overUnder}</div>
              <div className="text-2xl font-bold text-green-400">{a.overUnder25.prediction}</div>
              <div className="text-sm text-gray-300">{a.overUnder25.confidence}% {l.confidence}</div>
              {a.overUnder25.unanimous && <div className="text-xs text-green-400">🔥 {l.unanimous}</div>}
            </div>
          )}

          {/* BTTS */}
          {a.btts && (
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 rounded-lg p-3 border border-orange-500/30">
              <div className="text-xs text-gray-400">{l.btts}</div>
              <div className="text-2xl font-bold text-orange-400">{a.btts.prediction}</div>
              <div className="text-sm text-gray-300">{a.btts.confidence}% {l.confidence}</div>
              {a.btts.unanimous && <div className="text-xs text-green-400">🔥 {l.unanimous}</div>}
            </div>
          )}

          {/* Double Chance */}
          {a.doubleChance && (
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg p-3 border border-purple-500/30">
              <div className="text-xs text-gray-400">{l.doubleChance}</div>
              <div className="text-2xl font-bold text-purple-400">{a.doubleChance.prediction}</div>
              <div className="text-sm text-gray-300">{a.doubleChance.confidence}% {l.confidence}</div>
            </div>
          )}
        </div>

        {/* Correct Score */}
        {a.correctScore && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-2">{l.correctScore}</div>
            <div className="flex gap-3">
              {a.correctScore.first && (
                <div className="bg-yellow-600/20 px-3 py-2 rounded border border-yellow-500/30">
                  <div className="text-lg font-bold text-yellow-400">{a.correctScore.first.score}</div>
                  <div className="text-xs text-gray-400">{a.correctScore.first.confidence}%</div>
                </div>
              )}
              {a.correctScore.second && (
                <div className="bg-gray-600/20 px-3 py-2 rounded border border-gray-500/30">
                  <div className="text-lg font-bold text-gray-300">{a.correctScore.second.score}</div>
                  <div className="text-xs text-gray-400">{a.correctScore.second.confidence}%</div>
                </div>
              )}
              {a.correctScore.third && (
                <div className="bg-gray-600/20 px-3 py-2 rounded border border-gray-500/30">
                  <div className="text-lg font-bold text-gray-400">{a.correctScore.third.score}</div>
                  <div className="text-xs text-gray-400">{a.correctScore.third.confidence}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Best Bet */}
        {a.bestBets && a.bestBets.length > 0 && (
          <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 rounded-lg p-4 border border-yellow-500/30">
            <div className="text-sm text-yellow-400 mb-2">💰 {l.bestBet}</div>
            {a.bestBets.slice(0, 2).map((bet: any, idx: number) => (
              <div key={idx} className="mb-2">
                <div className="font-bold">{bet.type}: {bet.selection || bet.prediction}</div>
                <div className="text-sm text-gray-300">{bet.confidence}% - {bet.reasoning}</div>
                {bet.stake && <div className="text-xs text-yellow-400">Stake: {bet.stake} units</div>}
              </div>
            ))}
          </div>
        )}

        {/* Overall Analysis */}
        {a.overallAnalyses && a.overallAnalyses.length > 0 && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-2">📝 {lang === 'tr' ? 'Genel Değerlendirme' : lang === 'de' ? 'Gesamtbewertung' : 'Overall Analysis'}</div>
            <p className="text-gray-300 text-sm">{a.overallAnalyses[0]}</p>
          </div>
        )}

        {/* Risk Level */}
        {a.riskLevels && a.riskLevels.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{l.riskLevel}:</span>
            <span className={`px-2 py-1 rounded text-sm ${
              a.riskLevels[0]?.toLowerCase().includes('low') || a.riskLevels[0]?.toLowerCase().includes('düşük') || a.riskLevels[0]?.toLowerCase().includes('niedrig')
                ? 'bg-green-600'
                : a.riskLevels[0]?.toLowerCase().includes('high') || a.riskLevels[0]?.toLowerCase().includes('yüksek') || a.riskLevels[0]?.toLowerCase().includes('hoch')
                ? 'bg-red-600'
                : 'bg-yellow-600'
            }`}>
              {a.riskLevels[0]}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Format Agent Analysis
  const formatAgentAnalysis = (data: any) => {
    if (!data?.reports) return null;
    const r = data.reports;

    return (
      <div className="space-y-4">
        {/* Agent Status */}
        <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
          <div className="text-sm text-purple-400 mb-2">🤖 Heurist Multi-Agent System</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className={`p-2 rounded text-center ${r.scout ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              🔍 Scout {r.scout ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded text-center ${r.stats ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              📊 Stats {r.stats ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded text-center ${r.odds ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              💰 Odds {r.odds ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded text-center ${r.strategy ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              🧠 Strategy {r.strategy ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded text-center ${r.consensus ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              ⚖️ Consensus {r.consensus ? '✅' : '❌'}
            </div>
          </div>
          {data.timing && (
            <div className="text-xs text-gray-400 mt-2">
              ⏱️ Total: {data.timing.total}ms
            </div>
          )}
        </div>

        {/* Scout Report */}
        {r.scout && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-blue-400 mb-2">🔍 {l.scoutReport}</div>
            {r.scout.summary && <p className="text-sm text-gray-300 mb-2">{r.scout.summary}</p>}
            {r.scout.injuries?.length > 0 && (
              <div className="text-xs text-red-400">
                🏥 {lang === 'tr' ? 'Sakatlıklar' : lang === 'de' ? 'Verletzungen' : 'Injuries'}: {r.scout.injuries.map((i: any) => `${i.player} (${i.team})`).join(', ')}
              </div>
            )}
            {r.scout.news?.length > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                📰 {r.scout.news.map((n: any) => n.headline).join(' | ')}
              </div>
            )}
          </div>
        )}

        {/* Stats Report */}
        {r.stats && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-green-400 mb-2">📊 {l.statsReport}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">{lang === 'tr' ? 'Ev Gücü' : lang === 'de' ? 'Heimstärke' : 'Home Strength'}:</span>
                <span className="text-green-400 ml-2">{r.stats.homeStrength || 'N/A'}%</span>
              </div>
              <div>
                <span className="text-gray-400">{lang === 'tr' ? 'Deplasman Gücü' : lang === 'de' ? 'Auswärtsstärke' : 'Away Strength'}:</span>
                <span className="text-red-400 ml-2">{r.stats.awayStrength || 'N/A'}%</span>
              </div>
            </div>
            {r.stats.goalExpectancy && (
              <div className="text-xs text-gray-400 mt-2">
                ⚽ {lang === 'tr' ? 'Gol Beklentisi' : lang === 'de' ? 'Torerwartung' : 'Goal Expectancy'}: {r.stats.goalExpectancy.home?.toFixed(1)} - {r.stats.goalExpectancy.away?.toFixed(1)} (Total: {r.stats.goalExpectancy.total?.toFixed(1)})
              </div>
            )}
            {r.stats.summary && <p className="text-xs text-gray-300 mt-2">{r.stats.summary}</p>}
          </div>
        )}

        {/* Odds Report */}
        {r.odds && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-yellow-400 mb-2">💰 {l.oddsReport}</div>
            {r.odds.valuesBets?.length > 0 && (
              <div className="space-y-1">
                {r.odds.valuesBets.slice(0, 3).map((vb: any, idx: number) => (
                  <div key={idx} className="text-xs bg-yellow-600/20 p-2 rounded">
                    💎 {vb.market}: {vb.selection} @ {vb.odds} (Value: +{vb.value?.toFixed(1)}%)
                  </div>
                ))}
              </div>
            )}
            {r.odds.summary && <p className="text-xs text-gray-300 mt-2">{r.odds.summary}</p>}
          </div>
        )}

        {/* Strategy Report */}
        {r.strategy && (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-purple-400 mb-2">🧠 {l.strategyReport}</div>
            {r.strategy.recommendedBets?.length > 0 && (
              <div className="space-y-2">
                {r.strategy.recommendedBets.slice(0, 2).map((bet: any, idx: number) => (
                  <div key={idx} className="bg-purple-600/20 p-2 rounded text-sm">
                    <div className="font-bold">{bet.type}: {bet.selection}</div>
                    <div className="text-xs text-gray-400">{bet.confidence}% | Stake: {bet.stake} units | EV: +{bet.expectedValue?.toFixed(1)}%</div>
                    <div className="text-xs text-gray-300 mt-1">{bet.reasoning}</div>
                  </div>
                ))}
              </div>
            )}
            {r.strategy.riskAssessment && (
              <div className="text-xs text-gray-400 mt-2">
                ⚠️ {l.riskLevel}: <span className={`px-1 rounded ${
                  r.strategy.riskAssessment.level === 'low' ? 'bg-green-600' :
                  r.strategy.riskAssessment.level === 'high' ? 'bg-red-600' : 'bg-yellow-600'
                }`}>{r.strategy.riskAssessment.level}</span>
              </div>
            )}
          </div>
        )}

        {/* Consensus Report */}
        {r.consensus && (
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg p-4 border border-purple-500/30">
            <div className="text-sm text-pink-400 mb-3">⚖️ {l.consensusReport}</div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              {r.consensus.matchResult && (
                <div className="bg-gray-800/50 p-2 rounded">
                  <div className="text-xs text-gray-400">{l.matchResult}</div>
                  <div className="text-xl font-bold text-blue-400">{r.consensus.matchResult.prediction}</div>
                  <div className="text-xs">{r.consensus.matchResult.confidence}%</div>
                </div>
              )}
              {r.consensus.overUnder25 && (
                <div className="bg-gray-800/50 p-2 rounded">
                  <div className="text-xs text-gray-400">{l.overUnder}</div>
                  <div className="text-xl font-bold text-green-400">{r.consensus.overUnder25.prediction}</div>
                  <div className="text-xs">{r.consensus.overUnder25.confidence}%</div>
                </div>
              )}
            </div>

            {r.consensus.bestBet && (
              <div className="bg-yellow-600/20 p-3 rounded border border-yellow-500/30">
                <div className="text-sm text-yellow-400">💰 {l.bestBet}</div>
                <div className="font-bold">{r.consensus.bestBet.type}: {r.consensus.bestBet.selection}</div>
                <div className="text-sm text-gray-300">{r.consensus.bestBet.confidence}% | Stake: {r.consensus.bestBet.stake} units</div>
                <div className="text-xs text-gray-400 mt-1">{r.consensus.bestBet.reasoning}</div>
              </div>
            )}

            {r.consensus.overallAnalysis && (
              <p className="text-sm text-gray-300 mt-3">{r.consensus.overallAnalysis}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            ⚽ Football Analytics Pro
          </h1>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <Link href="/profile" className="text-sm text-gray-400 hover:text-white">
              👤 {l.profile}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-700 px-4 py-2 rounded-lg text-white"
            />
            <input
              type="text"
              placeholder={l.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-700 px-4 py-2 rounded-lg text-white flex-1 min-w-[200px]"
            />
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="bg-gray-700 px-4 py-2 rounded-lg text-white"
            >
              <option value="all">{l.allLeagues}</option>
              {leagues.map((league) => (
                <option key={league} value={league}>{league}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Matches List */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4">📅 {l.todayMatches} ({filteredMatches.length})</h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p>{l.noMatches}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-all cursor-pointer ${
                      selectedMatch?.id === match.id ? 'ring-2 ring-green-500' : ''
                    }`}
                    onClick={() => setSelectedMatch(match)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-lg">
                          {favoriteIds.includes(match.id) && <span className="text-yellow-400 mr-1">⭐</span>}
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                        <div className="text-sm text-gray-400">{match.league}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(match.date).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(match.id); }}
                          className="p-2 hover:bg-gray-600 rounded"
                        >
                          {favoriteIds.includes(match.id) ? '⭐' : '☆'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); analyzeMatch(match); }}
                          disabled={analyzing}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-sm disabled:opacity-50"
                        >
                          {analyzing && selectedMatch?.id === match.id ? '⏳' : '🤖'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis Panel */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            {selectedMatch ? (
              <>
                {/* Match Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</h2>
                    <p className="text-sm text-gray-400">{selectedMatch.league}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(selectedMatch.id)}
                    className={`px-3 py-1 rounded-lg ${
                      favoriteIds.includes(selectedMatch.id)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-600'
                    }`}
                  >
                    {favoriteIds.includes(selectedMatch.id) ? '⭐ Favorilerde' : '☆ Favorilere Ekle'}
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => analyzeMatch(selectedMatch)}
                    disabled={analyzing}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-bold disabled:opacity-50 transition-all"
                  >
                    {analyzing ? l.analyzing : l.analyze}
                  </button>
                  <button
                    onClick={runAgentAnalysis}
                    disabled={agentLoading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 rounded-xl font-bold disabled:opacity-50 transition-all"
                  >
                    {agentLoading ? l.runningAgents : l.aiAgents}
                  </button>
                </div>

                {/* Loading State */}
                {(analyzing || agentLoading) && (
                  <div className="bg-gray-700/50 rounded-lg p-6 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-300">
                      {agentLoading ? agentPhase : l.analyzing}
                    </p>
                  </div>
                )}

                {/* Analysis Results */}
                {!analyzing && !agentLoading && (
                  <>
                    {/* Tab Selector */}
                    {(analysis || agentAnalysis) && (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setAgentMode(false)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !agentMode ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          🤖 {lang === 'tr' ? 'Standart Analiz' : lang === 'de' ? 'Standard-Analyse' : 'Standard Analysis'}
                        </button>
                        <button
                          onClick={() => setAgentMode(true)}
                          disabled={!agentAnalysis}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            agentMode ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                          } ${!agentAnalysis ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          🧠 {l.agentAnalysis}
                        </button>
                      </div>
                    )}

                    {/* Display Analysis */}
                    {!agentMode && analysis && formatMainAnalysis(analysis)}
                    {agentMode && agentAnalysis && formatAgentAnalysis(agentAnalysis)}

                    {/* No Analysis Yet */}
                    {!analysis && !agentAnalysis && (
                      <div className="text-center py-12 text-gray-400">
                        <div className="text-5xl mb-4">🤖</div>
                        <p>{lang === 'tr' ? 'Analiz için butona tıklayın' : lang === 'de' ? 'Klicken Sie auf die Schaltfläche für die Analyse' : 'Click button to analyze'}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-4">⚽</div>
                <p>{lang === 'tr' ? 'Analiz için maç seçin' : lang === 'de' ? 'Wählen Sie ein Spiel zur Analyse' : 'Select a match to analyze'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
