'use client';

import { useState, useEffect } from 'react';
import { COMPETITIONS } from '@/lib/football-api';

type CompetitionKey = keyof typeof COMPETITIONS;

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
}

export default function Home() {
  const [selectedLeague, setSelectedLeague] = useState<CompetitionKey>('premier_league');
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<UpcomingMatch | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'claude'>('openai');
  const [error, setError] = useState<string>('');

  // Fetch standings
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [standingsRes, matchesRes] = await Promise.all([
          fetch(`/api/standings?competition=${selectedLeague}`),
          fetch(`/api/upcoming?competition=${selectedLeague}`),
        ]);

        if (!standingsRes.ok || !matchesRes.ok) {
          throw new Error('API isteği başarısız');
        }

        const standingsData = await standingsRes.json();
        const matchesData = await matchesRes.json();

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

  // Analyze match
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
          aiProvider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analiz başarısız');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  // Form badge component
  const FormBadge = ({ form }: { form: string }) => (
    <div className="flex gap-0.5">
      {form.split('').map((result, i) => (
        <span
          key={i}
          className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold text-white
            ${result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500'}`}
        >
          {result}
        </span>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* League Selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {Object.entries(COMPETITIONS).map(([key, comp]) => (
          <button
            key={key}
            onClick={() => setSelectedLeague(key as CompetitionKey)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedLeague === key
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {comp.country} {comp.name}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
          <p className="text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <span className="ml-4 text-gray-400">Veriler yükleniyor...</span>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Standings */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              🏆 Puan Durumu
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Takım</th>
                    <th className="text-center py-2">O</th>
                    <th className="text-center py-2">P</th>
                    <th className="text-left py-2">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 10).map((team) => (
                    <tr key={team.teamId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 font-medium">{team.position}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {team.teamCrest && (
                            <img src={team.teamCrest} alt="" className="w-5 h-5" />
                          )}
                          <span className="truncate max-w-[120px]">{team.teamName}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 text-gray-400">{team.played}</td>
                      <td className="text-center py-2 font-bold text-emerald-400">{team.points}</td>
                      <td className="py-2">
                        <FormBadge form={team.form} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Matches */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              📅 Yaklaşan Maçlar
            </h2>
            <div className="space-y-2">
              {upcomingMatches.length === 0 && (
                <p className="text-gray-400 text-sm">Yaklaşan maç bulunamadı.</p>
              )}
              {upcomingMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => {
                    setSelectedMatch(match);
                    setAnalysis('');
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedMatch?.id === match.id
                      ? 'bg-emerald-600/30 border border-emerald-500'
                      : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(match.date).toLocaleDateString('tr-TR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-gray-500">Hafta {match.matchday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {match.homeCrest && <img src={match.homeCrest} alt="" className="w-5 h-5" />}
                      <span className="font-medium text-sm">{match.homeTeam}</span>
                    </div>
                    <span className="text-gray-500 text-xs">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{match.awayTeam}</span>
                      {match.awayCrest && <img src={match.awayCrest} alt="" className="w-5 h-5" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              🤖 AI Analiz
            </h2>

            {selectedMatch ? (
              <div>
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                  <p className="text-center font-bold text-lg">
                    {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
                  </p>
                  <p className="text-center text-gray-400 text-sm mt-1">
                    {new Date(selectedMatch.date).toLocaleDateString('tr-TR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* AI Provider Selection */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAiProvider('openai')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      aiProvider === 'openai'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🟢 OpenAI
                  </button>
                  <button
                    onClick={() => setAiProvider('claude')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      aiProvider === 'claude'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🟠 Claude
                  </button>
                </div>

                <button
                  onClick={analyzeMatch}
                  disabled={analyzing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 
                           text-white font-bold py-3 px-4 rounded-lg transition-all
                           flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Analiz Ediliyor...
                    </>
                  ) : (
                    <>
                      ⚡ Analiz Et
                    </>
                  )}
                </button>

                {/* Analysis Result */}
                {analysis && (
                  <div className="mt-4 bg-gray-900/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                    <div 
                      className="markdown-content prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: analysis
                          .replace(/## /g, '<h2>')
                          .replace(/### /g, '<h3>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <p className="text-4xl mb-4">👈</p>
                <p>Analiz için bir maç seçin</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
