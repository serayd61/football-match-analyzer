'use client';

import React from 'react';
import AIBrainContainer from '@/components/AIBrainContainer';

// Example usage in a match analysis page
export default function MatchAnalysisPage() {
  // These would typically come from URL params or a match selection
  const matchData = {
    homeTeam: 'Castellón',
    awayTeam: 'Mirandés',
    homeTeamId: 10008,
    awayTeamId: 6968,
    league: 'La Liga 2',
    language: 'tr'
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Football Analytics Pro
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Match Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <span>{matchData.league}</span>
            <span>•</span>
            <span>Today, 20:00</span>
          </div>
          <h2 className="text-3xl font-bold text-white">
            {matchData.homeTeam} vs {matchData.awayTeam}
          </h2>
        </div>

        {/* AI Brain Analysis */}
        <AIBrainContainer
          homeTeam={matchData.homeTeam}
          awayTeam={matchData.awayTeam}
          homeTeamId={matchData.homeTeamId}
          awayTeamId={matchData.awayTeamId}
          league={matchData.league}
          language={matchData.language}
        />
      </main>
    </div>
  );
}
