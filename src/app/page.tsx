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

export default function Home() {
  const [competition, setCompetition] = useState('premier_league');
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

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
    setAnalysis('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeamId: match.homeTeamId,
          homeTeamName: match.homeTeam,
          awayTeamId: match.awayTeamId,
          awayTeamName: match.awayTeam,
          competition: match.competition,
          matchDate: match.date,
        }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || 'Analiz yapılamadı');
    } catch (error) {
      setAnalysis('Hata oluştu');
    }
    setLoading(false);
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
          <p className="text-gray-400 text-sm">AI Powered Match Predictions</p>
          <span className="inline-block mt-2 px-3 py-1 bg-green-600 text-xs rounded-full">
            🟢 Powered by Sportmonks Pro API
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📅 Yaklaşan Maçlar
            </h2>
            {loadingMatches ? (
              <div className="text-center py-8 text-gray-400">Yükleniyor...</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Maç bulunamadı</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    onClick={() => analyzeMatch(match)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedMatch?.id === match.id
                        ? 'bg-green-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="text-xs text-gray-400 mb-1">{formatDate(match.date)}</div>
                    <div className="flex items-center justify-between">
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
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🤖 AI Maç Analizi
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-400">3 AI analiz yapıyor...</p>
              </div>
            ) : analysis ? (
              <div className="text-sm whitespace-pre-wrap">{analysis}</div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">⚽</div>
                Analiz için bir maç seçin
              </div>
            )}
          </div>
        </div>

        <footer className="text-center mt-8 text-gray-500 text-xs">
          <p>⚽ Football Match Analyzer - AI Destekli Maç Analizi</p>
          <p>Veriler: Sportmonks Pro API | AI: Claude / OpenAI / Gemini</p>
          <p className="mt-2">Bu site Serkan Aydın tarafından yapılmıştır 🚀</p>
        </footer>
      </div>
    </div>
  );
}
