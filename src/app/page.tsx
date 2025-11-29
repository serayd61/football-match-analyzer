'use client';

import { useState, useEffect } from 'react';

const LEAGUES = {
  premier_league: { name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  la_liga: { name: 'La Liga', country: '🇪🇸' },
  serie_a: { name: 'Serie A', country: '🇮🇹' },
  bundesliga: { name: 'Bundesliga', country: '🇩🇪' },
  ligue_1: { name: 'Ligue 1', country: '🇫🇷' },
  eredivisie: { name: 'Eredivisie', country: '🇳🇱' },
  championship: { name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  liga_portugal: { name: 'Liga Portugal', country: '🇵🇹' },
};

type LeagueKey = keyof typeof LEAGUES;

interface TeamStanding {
  position: number;
  teamId: number;
  teamName: string;
  teamCrest: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: string;
}

interface UpcomingMatch {
  id: number;
  homeTeam: string;
  homeTeamId: number;
  homeCrest: string;
  awayTeam: string;
  awayTeamId: number;
  awayCrest: string;
  date: string;
  matchday: number;
  competition: string;
  venue: string;
}

export default function Home() {
  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>('premier_league');
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<UpcomingMatch | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [standingsRes, matchesRes] = await Promise.all([
          fetch(`/api/standings?competition=${selectedLeague}`),
          fetch(`/api/upcoming?competition=${selectedLeague}`),
        ]);

        const standingsData = await standingsRes.json();
        const matchesData = await matchesRes.json();

        if (standingsData.error) throw new Error(standingsData.error);
        if (matchesData.error) throw new Error(matchesData.error);

        setStandings(standingsData.standings || []);
        setUpcomingMatches(matchesData.matches || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedLeague]);

  async function analyzeMatch() {
    if (!selectedMatch) return;
    setAnalyzing(true);
    setAnalysis('');
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeamId: selectedMatch.homeTeamId,
          homeTeamName: selectedMatch.homeTeam,
          awayTeamId: selectedMatch.awayTeamId,
          awayTeamName: selectedMatch.awayTeam,
          competition: selectedMatch.competition,
          matchDate: selectedMatch.date,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const FormBadge = ({ form }: { form: string }) => {
    if (!form) return null;
    return (
      <div className="flex gap-0.5">
        {form.split('').slice(0, 5).map((result, i) => (
          <span key={i} className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold text-white
            ${result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500'}`}>
            {result}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs px-3 py-1 rounded-full font-medium">
          ⚡ Powered by Sportmonks Pro API
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {Object.entries(LEAGUES).map(([key, league]) => (
          <button
            key={key}
            onClick={() => { setSelectedLeague(key as LeagueKey); setSelectedMatch(null); setAnalysis(''); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedLeague === key
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {league.country} {league.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">❌ {error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <span className="ml-4 text-gray-400">Sportmonks verisi yükleniyor...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Standings */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4 backdrop-blur">
            <h2 className="text-lg font-bold mb-4">🏆 Puan Durumu</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 w-8">#</th>
                    <th className="text-left py-2">Takım</th>
                    <th className="text-center py-2 w-8">O</th>
                    <th className="text-center py-2 w-8">P</th>
                    <th className="text-left py-2">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 12).map((team) => (
                    <tr key={team.teamId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 font-medium text-gray-400">{team.position}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {team.teamCrest && <img src={team.teamCrest} alt="" className="w-5 h-5 object-contain" />}
                          <span className="truncate max-w-[100px] text-sm">{team.teamName}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 text-gray-400 text-xs">{team.played}</td>
                      <td className="text-center py-2 font-bold text-emerald-400">{team.points}</td>
                      <td className="py-2"><FormBadge form={team.form} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Matches */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4 backdrop-blur">
            <h2 className="text-lg font-bold mb-4">📅 Yaklaşan Maçlar</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {upcomingMatches.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">Bu ligde yaklaşan maç bulunamadı.</p>
              )}
              {upcomingMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => { setSelectedMatch(match); setAnalysis(''); }}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedMatch?.id === match.id
                      ? 'bg-emerald-600/30 border border-emerald-500'
                      : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-2">
                    {new Date(match.date).toLocaleDateString('tr-TR', {
                      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {match.homeCrest && <img src={match.homeCrest} alt="" className="w-6 h-6 object-contain" />}
                      <span className="font-medium text-sm truncate">{match.homeTeam}</span>
                    </div>
                    <span className="text-gray-500 text-xs">vs</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="font-medium text-sm truncate">{match.awayTeam}</span>
                      {match.awayCrest && <img src={match.awayCrest} alt="" className="w-6 h-6 object-contain" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4 backdrop-blur">
            <h2 className="text-lg font-bold mb-4">🤖 AI Maç Analizi</h2>
            {selectedMatch ? (
              <div>
                <div className="bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      {selectedMatch.homeCrest && <img src={selectedMatch.homeCrest} alt="" className="w-8 h-8" />}
                      <span className="font-bold">{selectedMatch.homeTeam}</span>
                    </div>
                    <span className="text-xl font-bold text-gray-500">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{selectedMatch.awayTeam}</span>
                      {selectedMatch.awayCrest && <img src={selectedMatch.awayCrest} alt="" className="w-8 h-8" />}
                    </div>
                  </div>
                  <p className="text-center text-gray-400 text-sm mt-3">
                    {new Date(selectedMatch.date).toLocaleDateString('tr-TR', {
                      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>

                <button
                  onClick={analyzeMatch}
                  disabled={analyzing}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 
                           disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-3 px-4 rounded-lg 
                           transition-all flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> AI Analiz Yapıyor...</>
                  ) : (
                    <>⚡ Maçı Analiz Et</>
                  )}
                </button>

                {analysis && (
                  <div className="mt-4 bg-gray-900/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-300">
                      {analysis}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <p className="text-5xl mb-4">⚽</p>
                <p>Analiz için bir maç seçin</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-gray-500 text-xs">
        <p>Veriler Sportmonks Euro Plan API | AI: OpenAI GPT-4o-mini</p>
      </div>
    </div>
  );
}
