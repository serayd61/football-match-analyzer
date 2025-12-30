'use client';

// ============================================================================
// ODDS ANALYSIS LOG VIEWER
// Tüm odds analizlerinin detaylı kayıtlarını görüntüler
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, Download, Filter, Search, Calendar,
  ArrowUp, ArrowDown, Minus, CheckCircle, XCircle
} from 'lucide-react';

interface OddsAnalysisLog {
  id: number;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  
  // Odds
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  over_25_odds: number;
  under_25_odds: number;
  btts_yes_odds: number;
  btts_no_odds: number;
  
  // Implied Probabilities
  home_implied_prob: number;
  draw_implied_prob: number;
  away_implied_prob: number;
  over_25_implied_prob: number;
  under_25_implied_prob: number;
  btts_yes_implied_prob: number;
  btts_no_implied_prob: number;
  
  // Form-Based Probabilities
  home_form_prob: number;
  away_form_prob: number;
  draw_form_prob: number;
  over_25_form_prob: number;
  under_25_form_prob: number;
  btts_yes_form_prob: number;
  btts_no_form_prob: number;
  
  // Value Calculations
  home_value: number;
  away_value: number;
  draw_value: number;
  over_25_value: number;
  under_25_value: number;
  btts_yes_value: number;
  btts_no_value: number;
  
  // Best Value
  best_value_market: string;
  best_value_amount: number;
  value_rating: 'None' | 'Low' | 'Medium' | 'High';
  
  // Predictions
  recommendation: string;
  match_winner_value: string;
  btts_value: string;
  asian_handicap_recommendation: string;
  correct_score_most_likely: string;
  
  // Value Bets
  value_bets: string[];
  
  // Full Analysis Data
  full_analysis_data: any;
  
  // Match Result
  actual_result?: string;
  actual_score?: string;
  actual_over_25?: boolean;
  actual_btts?: boolean;
  prediction_correct?: boolean;
  value_bet_success?: boolean;
  
  analyzed_at: string;
}

export default function OddsAnalysisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [logs, setLogs] = useState<OddsAnalysisLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    league: '',
    valueRating: '',
    minValueAmount: '',
    search: ''
  });
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);
  
  useEffect(() => {
    if (session) {
      fetchLogs();
    }
  }, [session, filters]);
  
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.league) params.append('league', filters.league);
      if (filters.valueRating) params.append('valueRating', filters.valueRating);
      if (filters.minValueAmount) params.append('minValueAmount', filters.minValueAmount);
      
      const response = await fetch(`/api/v2/odds-analysis-logs?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        let filteredLogs = data.logs || [];
        
        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredLogs = filteredLogs.filter((log: OddsAnalysisLog) =>
            log.home_team.toLowerCase().includes(searchLower) ||
            log.away_team.toLowerCase().includes(searchLower) ||
            log.league.toLowerCase().includes(searchLower)
          );
        }
        
        setLogs(filteredLogs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const exportToCSV = () => {
    const headers = [
      'Fixture ID', 'Home Team', 'Away Team', 'League', 'Match Date',
      'Home Odds', 'Draw Odds', 'Away Odds', 'Over 2.5 Odds', 'Under 2.5 Odds',
      'Home Implied %', 'Away Implied %', 'Over 2.5 Implied %',
      'Home Form %', 'Away Form %', 'Over 2.5 Form %',
      'Home Value', 'Away Value', 'Over 2.5 Value',
      'Best Value Market', 'Best Value Amount', 'Value Rating',
      'Recommendation', 'Match Winner Value', 'BTTS Value',
      'Asian Handicap', 'Correct Score', 'Value Bets',
      'Actual Result', 'Actual Score', 'Prediction Correct', 'Value Bet Success'
    ];
    
    const rows = logs.map(log => [
      log.fixture_id,
      log.home_team,
      log.away_team,
      log.league,
      new Date(log.match_date).toLocaleDateString('tr-TR'),
      log.home_odds,
      log.draw_odds,
      log.away_odds,
      log.over_25_odds,
      log.under_25_odds,
      log.home_implied_prob,
      log.away_implied_prob,
      log.over_25_implied_prob,
      log.home_form_prob,
      log.away_form_prob,
      log.over_25_form_prob,
      log.home_value,
      log.away_value,
      log.over_25_value,
      log.best_value_market,
      log.best_value_amount,
      log.value_rating,
      log.recommendation,
      log.match_winner_value,
      log.btts_value,
      log.asian_handicap_recommendation,
      log.correct_score_most_likely,
      (log.value_bets || []).join('; '),
      log.actual_result || '',
      log.actual_score || '',
      log.prediction_correct ? 'Yes' : 'No',
      log.value_bet_success ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `odds-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  
  const exportToJSON = () => {
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `odds-analysis-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };
  
  const getValueColor = (value: number) => {
    if (value >= 10) return 'text-green-400';
    if (value >= 5) return 'text-yellow-400';
    if (value > 0) return 'text-blue-400';
    return 'text-gray-400';
  };
  
  const getValueIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-4 h-4 text-green-400" />;
    if (value < 0) return <ArrowDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">💰 Odds Analiz Kayıtları</h1>
              <p className="text-gray-300">Tüm odds analizlerinin detaylı kayıtları ve value bet tespitleri</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                CSV Export
              </button>
              <button
                onClick={exportToJSON}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                JSON Export
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Lig</label>
              <input
                type="text"
                value={filters.league}
                onChange={(e) => setFilters({ ...filters, league: e.target.value })}
                placeholder="Lig ara..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Value Rating</label>
              <select
                value={filters.valueRating}
                onChange={(e) => setFilters({ ...filters, valueRating: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                <option value="">Tümü</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="None">None</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Min Value Amount</label>
              <input
                type="number"
                value={filters.minValueAmount}
                onChange={(e) => setFilters({ ...filters, minValueAmount: e.target.value })}
                placeholder="Min value %"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 mb-1 block">Ara</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Takım veya lig ara..."
                  className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="text-gray-400 text-sm mb-1">Toplam Kayıt</div>
            <div className="text-2xl font-bold text-white">{logs.length}</div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="text-gray-400 text-sm mb-1">High Value</div>
            <div className="text-2xl font-bold text-green-400">
              {logs.filter(l => l.value_rating === 'High').length}
            </div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="text-gray-400 text-sm mb-1">Ortalama Value</div>
            <div className="text-2xl font-bold text-yellow-400">
              {logs.length > 0 
                ? Math.round(logs.reduce((sum, l) => sum + (l.best_value_amount || 0), 0) / logs.length)
                : 0}%
            </div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="text-gray-400 text-sm mb-1">Başarı Oranı</div>
            <div className="text-2xl font-bold text-blue-400">
              {logs.filter(l => l.prediction_correct).length > 0
                ? Math.round((logs.filter(l => l.prediction_correct).length / logs.filter(l => l.actual_result).length) * 100)
                : 0}%
            </div>
          </div>
        </div>
        
        {/* Logs Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Maç</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Oranlar</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Implied %</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Form %</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Value</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Best Value</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tahminler</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white">Sonuç</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{log.home_team} vs {log.away_team}</div>
                      <div className="text-xs text-gray-400">{log.league}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.match_date).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div>Ev: {log.home_odds}</div>
                      <div>Ber: {log.draw_odds}</div>
                      <div>Dep: {log.away_odds}</div>
                      <div className="mt-1">O2.5: {log.over_25_odds}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div>Ev: {log.home_implied_prob}%</div>
                      <div>Dep: {log.away_implied_prob}%</div>
                      <div>O2.5: {log.over_25_implied_prob}%</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div>Ev: {log.home_form_prob}%</div>
                      <div>Dep: {log.away_form_prob}%</div>
                      <div>O2.5: {log.over_25_form_prob}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {getValueIcon(log.home_value)}
                        <span className={getValueColor(log.home_value)}>Ev: {log.home_value > 0 ? '+' : ''}{log.home_value}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getValueIcon(log.away_value)}
                        <span className={getValueColor(log.away_value)}>Dep: {log.away_value > 0 ? '+' : ''}{log.away_value}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getValueIcon(log.over_25_value)}
                        <span className={getValueColor(log.over_25_value)}>O2.5: {log.over_25_value > 0 ? '+' : ''}{log.over_25_value}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-semibold">{log.best_value_market}</div>
                      <div className={`text-sm font-bold ${
                        log.best_value_amount >= 10 ? 'text-green-400' :
                        log.best_value_amount >= 5 ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        +{log.best_value_amount}%
                      </div>
                      <div className="text-xs text-gray-400">{log.value_rating}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div>MS: {log.match_winner_value}</div>
                      <div>O/U: {log.recommendation}</div>
                      <div>BTTS: {log.btts_value}</div>
                      {log.value_bets && log.value_bets.length > 0 && (
                        <div className="mt-1 text-xs text-green-400">
                          Value: {log.value_bets.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.actual_result ? (
                        <>
                          <div className="text-white">{log.actual_result} - {log.actual_score}</div>
                          {log.prediction_correct !== undefined && (
                            <div className="flex items-center gap-1 mt-1">
                              {log.prediction_correct ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                              <span className={log.prediction_correct ? 'text-green-400' : 'text-red-400'}>
                                {log.prediction_correct ? 'Doğru' : 'Yanlış'}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-500">Bekleniyor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {logs.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              Henüz kayıt bulunmuyor. Analiz yapıldıkça kayıtlar burada görünecek.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

