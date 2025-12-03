'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

const LEAGUE_BUTTONS = [
  { key: 'premier_league', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key: 'championship', name: 'Championship', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { key: 'la_liga', name: 'La Liga', flag: '🇪🇸' },
  { key: 'serie_a', name: 'Serie A', flag: '🇮🇹' },
  { key: 'bundesliga', name: 'Bundesliga', flag: '🇩🇪' },
  { key: 'ligue_1', name: 'Ligue 1', flag: '🇫🇷' },
  { key: 'super_lig', name: 'Süper Lig', flag: '🇹🇷' },
  { key: 'eredivisie', name: 'Eredivisie', flag: '🇳🇱' },
  { key: 'liga_portugal', name: 'Portugal', flag: '🇵🇹' },
  { key: 'pro_league', name: 'Belgium', flag: '🇧🇪' },
];

interface Match {
  id: number;
  homeTeam: string;
  homeTeamId: number;
  homeCrest: string;
  awayTeam: string;
  awayTeamId: number;
  awayCrest: string;
  date: string;
  competition: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLanguage();
  
  const [competition, setCompetition] = useState('premier_league');
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Match[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [kuponResult, setKuponResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [kuponLoading, setKuponLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showKuponModal, setShowKuponModal] = useState(false);

  const subscription = (session?.user as any)?.subscription;
  const trialDaysRemaining = subscription?.trial_end 
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchMatches();
      fetchStandings();
    }
  }, [competition, session]);

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/upcoming?competition=${competition}&t=${Date.now()}`);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
    setLoadingMatches(false);
  };

  const fetchStandings = async () => {
    try {
      const res = await fetch(`/api/standings?competition=${competition}&t=${Date.now()}`);
      const data = await res.json();
      setStandings(data.standings || []);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

 const analyzeMatch = async (match: Match) => {
  setSelectedMatch(match);
  setLoading(true);
  setAnalysis(null);
  setAnalysisText('');
  
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
        language: lang, // Dil bilgisini gönder
      }),
    });
    
    const data = await res.json();
    
    if (data.success && data.analysis) {
      setAnalysis(data);
      setAnalysisText(formatAnalysis(data));
    } else {
      setAnalysisText(data.error || t('error'));
    }
  } catch (error) {
    setAnalysisText(t('error') + ': ' + String(error));
  }
  setLoading(false);
};

  const formatAnalysis = (data: any): string => {
  const a = data.analysis;
  const odds = data.odds;
  const form = data.form;
  const aiStatus = data.aiStatus;

  let text = `🏟️ ${data.fixture?.homeTeam} vs ${data.fixture?.awayTeam}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // AI Status
  text += `🤖 AI DURUM: Claude ${aiStatus?.claude || '?'} | GPT-4 ${aiStatus?.openai || '?'} | Gemini ${aiStatus?.gemini || '?'}\n\n`;

  // Odds
  if (odds?.matchWinner) {
    text += `📊 BAHİS ORANLARI\n`;
    text += `┌─────────────────────────────────┐\n`;
    text += `│ 1X2: ${odds.matchWinner.home || '-'} | ${odds.matchWinner.draw || '-'} | ${odds.matchWinner.away || '-'}\n`;
    if (odds.overUnder) text += `│ 2.5: Ü ${odds.overUnder.over || '-'} | A ${odds.overUnder.under || '-'}\n`;
    if (odds.btts) text += `│ KG:  V ${odds.btts.yes || '-'} | Y ${odds.btts.no || '-'}\n`;
    if (odds.doubleChance) text += `│ ÇŞ:  1X ${odds.doubleChance.homeOrDraw || '-'} | X2 ${odds.doubleChance.awayOrDraw || '-'} | 12 ${odds.doubleChance.homeOrAway || '-'}\n`;
    text += `└─────────────────────────────────┘\n\n`;
  }

  // Form
  if (form) {
    text += `📈 FORM DURUMU\n`;
    text += `┌─────────────────────────────────┐\n`;
    text += `│ ${data.fixture?.homeTeam}: ${form.home?.form || 'N/A'} (${form.home?.points || 0}/15 puan)\n`;
    text += `│ → Gol ort: ${form.home?.avgGoals || '0'} | Yediği: ${form.home?.avgConceded || '0'}\n`;
    text += `│\n`;
    text += `│ ${data.fixture?.awayTeam}: ${form.away?.form || 'N/A'} (${form.away?.points || 0}/15 puan)\n`;
    text += `│ → Gol ort: ${form.away?.avgGoals || '0'} | Yediği: ${form.away?.avgConceded || '0'}\n`;
    text += `└─────────────────────────────────┘\n\n`;
  }

  // AI Tahminleri
  text += `🎯 AI TAHMİNLERİ (${a?.aiCount || 0}/3 AI)\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (a?.matchResult) {
    const unanimous = a.matchResult.unanimous ? '🔥 OYBIRLIĞI' : `${a.matchResult.votes}/${a.matchResult.totalVotes} AI`;
    text += `⚽ MAÇ SONUCU: ${a.matchResult.prediction} (${a.matchResult.confidence}%) ${unanimous}\n`;
  }

  if (a?.overUnder25) {
    const unanimous = a.overUnder25.unanimous ? '🔥 OYBIRLIĞI' : `${a.overUnder25.votes}/${a.overUnder25.totalVotes} AI`;
    text += `📊 2.5 GOL: ${a.overUnder25.prediction} (${a.overUnder25.confidence}%) ${unanimous}\n`;
  }

  if (a?.btts) {
    const unanimous = a.btts.unanimous ? '🔥 OYBIRLIĞI' : `${a.btts.votes}/${a.btts.totalVotes} AI`;
    text += `🔥 KG VAR/YOK: ${a.btts.prediction} (${a.btts.confidence}%) ${unanimous}\n`;
  }

  if (a?.doubleChance) {
    const unanimous = a.doubleChance.unanimous ? '🔥 OYBIRLIĞI' : `${a.doubleChance.votes}/${a.doubleChance.totalVotes} AI`;
    text += `📈 ÇİFTE ŞANS: ${a.doubleChance.prediction} (${a.doubleChance.confidence}%) ${unanimous}\n`;
  }

  if (a?.halfTimeResult) {
    const unanimous = a.halfTimeResult.unanimous ? '🔥 OYBIRLIĞI' : `${a.halfTimeResult.votes}/${a.halfTimeResult.totalVotes} AI`;
    text += `⏱️ İLK YARI: ${a.halfTimeResult.prediction} (${a.halfTimeResult.confidence}%) ${unanimous}\n`;
  }

  if (a?.totalGoalsRange) {
    text += `🎯 GOL ARALIĞI: ${a.totalGoalsRange.prediction} gol (${a.totalGoalsRange.confidence}%)\n`;
  }

  if (a?.firstGoal) {
    text += `⚡ İLK GOL: ${a.firstGoal.prediction} (${a.firstGoal.confidence}%)\n`;
  }

  // Correct Score
  if (a?.correctScore) {
    text += `\n🏆 DOĞRU SKOR TAHMİNLERİ\n`;
    text += `┌─────────────────────────────────┐\n`;
    if (a.correctScore.first) text += `│ 1. ${a.correctScore.first.score} (%${a.correctScore.first.confidence})\n`;
    if (a.correctScore.second) text += `│ 2. ${a.correctScore.second.score} (%${a.correctScore.second.confidence})\n`;
    if (a.correctScore.third) text += `│ 3. ${a.correctScore.third.score} (%${a.correctScore.third.confidence})\n`;
    text += `└─────────────────────────────────┘\n`;
  }

  // Star Players
  if (a?.starPlayers && a.starPlayers.length > 0) {
    text += `\n⭐ MAÇIN YILDIZLARI\n`;
    a.starPlayers.forEach((player: any, idx: number) => {
      if (player?.name) {
        text += `${idx + 1}. ${player.name} (${player.team})\n`;
        text += `   → ${player.reason}\n`;
      }
    });
  }

  // Best Bets
  if (a?.bestBets && a.bestBets.length > 0) {
    text += `\n💰 EN İYİ BAHİS ÖNERİLERİ\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    a.bestBets.forEach((bet: any, idx: number) => {
      if (bet?.type) {
        text += `${idx + 1}. ${bet.type}: ${bet.prediction} (${bet.confidence}%)\n`;
        text += `   → ${bet.reasoning}\n`;
      }
    });
  }

  // Risk Level
  if (a?.riskLevels && a.riskLevels.length > 0) {
    const riskCounts: any = {};
    a.riskLevels.forEach((r: string) => {
      riskCounts[r] = (riskCounts[r] || 0) + 1;
    });
    const mostCommonRisk = Object.keys(riskCounts).reduce((a, b) => riskCounts[a] > riskCounts[b] ? a : b);
    text += `\n⚠️ RİSK SEVİYESİ: ${mostCommonRisk}\n`;
  }

  // Overall Analysis
  if (a?.overallAnalyses && a.overallAnalyses.length > 0) {
    text += `\n📝 GENEL DEĞERLENDİRME\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${a.overallAnalyses[0]}\n`;
  }

  return text;
};

  const toggleMatchSelection = (match: Match) => {
    setSelectedMatches(prev => {
      const exists = prev.find(m => m.id === match.id);
      return exists ? prev.filter(m => m.id !== match.id) : [...prev, match];
    });
  };

  const generateKupon = async () => {
    if (selectedMatches.length === 0) return alert(t('selectMatch'));

    setKuponLoading(true);
    setKuponResult('');
    setShowKuponModal(true);

    try {
      const res = await fetch('/api/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: selectedMatches.map(m => ({
            fixtureId: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
          }))
        }),
      });
      const data = await res.json();
      setKuponResult(data.kupon || JSON.stringify(data, null, 2));
    } catch (error) {
      setKuponResult(t('error') + ': ' + String(error));
    }
    setKuponLoading(false);
  };

  const openPortal = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || t('error'));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Subscription Bar */}
      <div className={`py-2 px-4 text-center text-sm ${
        subscription?.status === 'trialing' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
      }`}>
        {subscription?.status === 'trialing' ? (
          <>{t('trialDaysLeft', { days: trialDaysRemaining })} • <a href="/pricing" className="underline">{t('upgradeToPro')}</a></>
        ) : subscription?.status === 'active' ? (
          <>✓ {t('proActive')}</>
        ) : (
          <>⚠️ {t('subscriptionRequired')} • <a href="/pricing" className="underline">{t('subscribe')}</a></>
        )}
        <button onClick={openPortal} className="ml-4 underline opacity-70 hover:opacity-100">
          {t('manageSubscription')}
        </button>
        <button onClick={() => signOut({ callbackUrl: '/' })} className="ml-4 underline opacity-70 hover:opacity-100">
          {t('logout')}
        </button>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold">⚽ {t('appName')}</h1>
            <p className="text-gray-400 text-sm">{t('welcome')}, {session?.user?.name || session?.user?.email}</p>
          </div>
          <LanguageSelector />
        </header>

        {/* League Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {LEAGUE_BUTTONS.map((league) => (
            <button
              key={league.key}
              onClick={() => setCompetition(league.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                competition === league.key ? 'bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {league.flag} {league.name}
            </button>
          ))}
        </div>

        {/* Kupon Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={generateKupon}
            disabled={selectedMatches.length === 0}
            className={`px-6 py-3 rounded-xl font-bold ${
              selectedMatches.length > 0
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            🎰 {t('createCoupon')} ({selectedMatches.length})
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Standings */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">📊 {t('standings')}</h2>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {standings.slice(0, 15).map((team, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-400 w-6">{team.position}</span>
                  <span className="flex-1 truncate">{team.teamName}</span>
                  <span className="font-bold">{team.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Matches */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">📅 {t('matches')}</h2>
            {loadingMatches ? (
              <div className="text-center py-8 text-gray-400">{t('loading')}</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-3 rounded-lg cursor-pointer ${
                      selectedMatch?.id === match.id ? 'bg-green-600' : 
                      selectedMatches.find(m => m.id === match.id) ? 'bg-yellow-600/30 border border-yellow-500' : 
                      'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">{formatDate(match.date)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleMatchSelection(match); }}
                        className={`px-2 py-1 rounded text-xs ${
                          selectedMatches.find(m => m.id === match.id) ? 'bg-yellow-500 text-black' : 'bg-gray-600'
                        }`}
                      >
                        {selectedMatches.find(m => m.id === match.id) ? '✓' : '+'}
                      </button>
                    </div>
                    <div onClick={() => analyzeMatch(match)} className="flex justify-between text-sm">
                      <span>{match.homeTeam}</span>
                      <span className="text-gray-400">vs</span>
                      <span>{match.awayTeam}</span>
                    </div>
                  </div>
                ))}
                {matches.length === 0 && (
                  <div className="text-center py-8 text-gray-400">{t('noMatches')}</div>
                )}
              </div>
            )}
          </div>

          {/* Analysis */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">🤖 {t('aiAnalysisTitle')}</h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-400">{t('analyzing')}</p>
              </div>
            ) : analysisText ? (
              <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-900 p-3 rounded-lg">
                {analysisText}
              </pre>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {t('selectMatch')}
              </div>
            )}
          </div>
        </div>

        {/* Kupon Modal */}
        {showKuponModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between mb-4">
                <h2 className="text-2xl font-bold">🎰 {t('aiCoupon')}</h2>
                <button onClick={() => setShowKuponModal(false)} className="text-gray-400 hover:text-white text-2xl">✕</button>
              </div>
              {kuponLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>{t('creatingCoupon')}</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm bg-gray-900 p-4 rounded-lg">{kuponResult}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
