'use client';

import { useState, useEffect } from 'react';

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
  { key: 'austria_bundesliga', name: 'Austria', flag: '🇦🇹' },
  { key: 'super_league_ch', name: 'Switzerland', flag: '🇨🇭' },
  { key: 'scottish_premiership', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { key: 'superliga_dk', name: 'Denmark', flag: '🇩🇰' },
  { key: 'eliteserien', name: 'Norway', flag: '🇳🇴' },
  { key: 'allsvenskan', name: 'Sweden', flag: '🇸🇪' },
  { key: 'ekstraklasa', name: 'Poland', flag: '🇵🇱' },
  { key: 'hnl', name: 'Croatia', flag: '🇭🇷' },
  { key: 'russia_premier', name: 'Russia', flag: '🇷🇺' },
  { key: 'ukraine_premier', name: 'Ukraine', flag: '🇺🇦' },
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

interface Standing {
  position: number;
  teamName: string;
  teamCrest: string;
  played: number;
  points: number;
  form: string;
}

interface AnalysisResult {
  success: boolean;
  fixture: any;
  odds: any;
  analysis: any;
  aiStatus: any;
}

export default function Home() {
  const [competition, setCompetition] = useState('premier_league');
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Match[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [kuponResult, setKuponResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [kuponLoading, setKuponLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showKuponModal, setShowKuponModal] = useState(false);

  useEffect(() => {
    fetchMatches();
    fetchStandings();
  }, [competition]);

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
          fixtureId: match.id,  // ÖNEMLİ: Bu satır eksikti!
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          competition: match.competition,
          matchDate: match.date,
        }),
      });
      
      const data = await res.json();
      
      if (data.success && data.analysis) {
        setAnalysis(data);
        setAnalysisText(formatAnalysis(data));
      } else {
        setAnalysisText(data.error || 'Analiz yapılamadı');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisText('Hata oluştu: ' + String(error));
    }
    setLoading(false);
  };

  const formatAnalysis = (data: AnalysisResult): string => {
    const a = data.analysis;
    const odds = data.odds;
    
    let text = `🏟️ ${data.fixture?.homeTeam} vs ${data.fixture?.awayTeam}\n`;
    text += `📅 ${data.fixture?.date}\n\n`;
    
    // Bahis Oranları
    if (odds?.matchWinner) {
      text += `📊 BAHİS ORANLARI\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `1: ${odds.matchWinner.home} (${odds.matchWinner.homeProb?.toFixed(0)}%)\n`;
      text += `X: ${odds.matchWinner.draw} (${odds.matchWinner.drawProb?.toFixed(0)}%)\n`;
      text += `2: ${odds.matchWinner.away} (${odds.matchWinner.awayProb?.toFixed(0)}%)\n\n`;
    }
    
    if (odds?.overUnder) {
      text += `⚽ 2.5 Gol: Üst ${odds.overUnder.over25} | Alt ${odds.overUnder.under25}\n`;
    }
    
    if (odds?.btts) {
      text += `🎯 KG: Var ${odds.btts.yes} | Yok ${odds.btts.no}\n\n`;
    }
    
    // AI Consensus
    text += `🤖 AI TAHMİNLERİ\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (a?.matchResult) {
      const mr = a.matchResult;
      text += `📌 Maç Sonucu: ${mr.prediction} `;
      text += `(Güven: %${mr.confidence}) `;
      text += `[${mr.aiAgreement} AI uzlaştı]\n`;
    }
    
    if (a?.goals) {
      text += `⚽ 2.5 Gol: ${a.goals.over25 ? 'ÜST' : 'ALT'} `;
      text += `(Güven: %${a.goals.confidence})\n`;
    }
    
    if (a?.btts) {
      text += `🎯 KG: ${a.btts.prediction ? 'VAR' : 'YOK'} `;
      text += `(Güven: %${a.btts.confidence})\n`;
    }
    
    if (a?.corners) {
      text += `🚩 Korner: ${a.corners.over95 ? '9.5 Üst' : '9.5 Alt'} `;
      text += `(Beklenen: ${a.corners.expectedCorners})\n`;
    }
    
    if (a?.cards) {
      text += `🟨 Kart: ${a.cards.over35 ? '3.5 Üst' : '3.5 Alt'} `;
      text += `(Beklenen: ${a.cards.expectedCards})\n`;
    }
    
    if (a?.correctScore) {
      text += `📊 Skor Tahmini: ${a.correctScore.prediction} `;
      text += `(Güven: %${a.correctScore.confidence})\n`;
    }
    
    text += `\n⚠️ Risk: ${a?.riskLevel || 'MEDIUM'}\n`;
    
    // Best Bets
    if (a?.bestBets && a.bestBets.length > 0) {
      text += `\n💰 EN İYİ BAHİSLER\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      a.bestBets.forEach((bet: any, i: number) => {
        text += `${i + 1}. ${bet.market}: ${bet.selection} `;
        text += `(Güven: %${bet.confidence})\n`;
      });
    }
    
    // Bookmaker Consensus
    if (a?.bookmakerConsensus) {
      text += `\n📈 Bookmaker Görüşü:\n${a.bookmakerConsensus}\n`;
    }
    
    // AI Status
    text += `\n🤖 AI Durumu: `;
    text += `Claude ${data.aiStatus?.claude === 'success' ? '✅' : '❌'} | `;
    text += `OpenAI ${data.aiStatus?.openai === 'success' ? '✅' : '❌'} | `;
    text += `Gemini ${data.aiStatus?.gemini === 'success' ? '✅' : '❌'}`;
    
    return text;
  };

  const toggleMatchSelection = (match: Match) => {
    setSelectedMatches(prev => {
      const exists = prev.find(m => m.id === match.id);
      if (exists) {
        return prev.filter(m => m.id !== match.id);
      } else {
        return [...prev, match];
      }
    });
  };

  const generateKupon = async () => {
    if (selectedMatches.length === 0) {
      alert('Lütfen en az 1 maç seçin!');
      return;
    }

    setKuponLoading(true);
    setKuponResult('');
    setShowKuponModal(true);

    try {
      const res = await fetch('/api/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: selectedMatches.map(m => ({
            fixtureId: m.id,  // ÖNEMLİ: Bu da eklendi
            homeTeam: m.homeTeam,
            homeTeamId: m.homeTeamId,
            awayTeam: m.awayTeam,
            awayTeamId: m.awayTeamId,
            competition: m.competition,
            date: m.date
          }))
        }),
      });
      const data = await res.json();
      setKuponResult(data.kupon || JSON.stringify(data, null, 2));
    } catch (error) {
      setKuponResult('Hata oluştu: ' + String(error));
    }
    setKuponLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            ⚽ Football Match Analyzer
          </h1>
          <p className="text-gray-400 text-sm">AI Powered Match Predictions + Live Odds</p>
          <span className="inline-block mt-2 px-3 py-1 bg-green-600 text-xs rounded-full">
            🟢 Sportmonks Pro API + Odds
          </span>
        </header>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {LEAGUE_BUTTONS.map((league) => (
            <button
              key={league.key}
              onClick={() => setCompetition(league.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                competition === league.key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {league.flag} {league.name}
            </button>
          ))}
        </div>

        {/* Kupon Oluştur Butonu */}
        <div className="flex justify-center mb-6">
          <button
            onClick={generateKupon}
            disabled={selectedMatches.length === 0 || kuponLoading}
            className={`px-6 py-3 rounded-xl font-bold text-lg transition-all flex items-center gap-2 ${
              selectedMatches.length > 0
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            🎰 Kupon Oluştur ({selectedMatches.length} maç seçili)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Puan Durumu */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Puan Durumu
            </h2>
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-xs text-gray-400 pb-2 border-b border-gray-700">
                <span className="col-span-1">#</span>
                <span className="col-span-7">Takım</span>
                <span className="col-span-2 text-center">P</span>
                <span className="col-span-2 text-center">Form</span>
              </div>
              {standings.slice(0, 15).map((team: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 items-center text-sm py-1">
                  <span className="col-span-1 text-gray-400">{team.position}</span>
                  <div className="col-span-7 flex items-center gap-2">
                    {team.teamCrest && (
                      <img src={team.teamCrest} alt="" className="w-5 h-5" />
                    )}
                    <span className="truncate">{team.teamName}</span>
                  </div>
                  <span className="col-span-2 text-center font-semibold">{team.points}</span>
                  <div className="col-span-2 flex justify-center">
                    {team.form === 'up' && <span className="text-green-500">▲</span>}
                    {team.form === 'down' && <span className="text-red-500">▼</span>}
                    {team.form === 'equal' && <span className="text-yellow-500">●</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yaklaşan Maçlar */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📅 Yaklaşan Maçlar
              <span className="text-xs text-gray-400 ml-2">(Tıkla: Analiz | ☑️: Kupona Ekle)</span>
            </h2>
            {loadingMatches ? (
              <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Maç bulunamadı</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matches.map((match) => {
                  const isSelected = selectedMatches.find(m => m.id === match.id);
                  return (
                    <div
                      key={match.id}
                      className={`p-3 rounded-lg transition-all ${
                        selectedMatch?.id === match.id
                          ? 'bg-green-600'
                          : isSelected
                          ? 'bg-yellow-600/30 border border-yellow-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs text-gray-400">{formatDate(match.date)}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMatchSelection(match);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-yellow-500 text-black'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          {isSelected ? '✓ Seçildi' : '+ Ekle'}
                        </button>
                      </div>
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => analyzeMatch(match)}
                      >
                        <div className="flex items-center gap-2">
                          {match.homeCrest && <img src={match.homeCrest} alt="" className="w-5 h-5" />}
                          <span className="text-sm font-medium">{match.homeTeam}</span>
                        </div>
                        <span className="text-gray-400 text-xs">vs</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{match.awayTeam}</span>
                          {match.awayCrest && <img src={match.awayCrest} alt="" className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Maç Analizi */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🤖 AI Maç Analizi
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-400">3 AI + Odds analiz yapıyor...</p>
              </div>
            ) : analysisText ? (
              <div className="text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto font-mono bg-gray-900 p-3 rounded-lg">
                {analysisText}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">⚽</div>
                Analiz için bir maç seçin
              </div>
            )}
          </div>
        </div>

        {/* Kupon Modal */}
        {showKuponModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  🎰 AI Kupon Sistemi
                </h2>
                <button
                  onClick={() => setShowKuponModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>
              
              {kuponLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-lg text-gray-300">3 AI + Odds analiz yapıyor...</p>
                  <p className="text-sm text-gray-500 mt-2">Claude, OpenAI ve Gemini uzlaşı arıyor</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm font-mono bg-gray-900 p-4 rounded-lg">
                  {kuponResult}
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="text-center mt-8 text-gray-500 text-xs">
          <p>⚽ Football Match Analyzer - AI Destekli Maç Analizi</p>
          <p>Veriler: Sportmonks Pro API + Live Odds | AI: Claude / OpenAI / Gemini</p>
          <p className="mt-2">Bu site Serkan Aydın tarafından yapılmıştır 🚀</p>
        </footer>
      </div>
    </div>
  );
}
