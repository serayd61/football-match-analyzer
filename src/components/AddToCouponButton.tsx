// src/components/AddToCouponButton.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, Ticket } from 'lucide-react';
import { BetType, BET_TYPE_LABELS, SELECTION_LABELS } from '@/types/coupon';

interface AddToCouponButtonProps {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  odds?: {
    matchWinner?: { home?: number; draw?: number; away?: number };
    overUnder?: { '2.5'?: { over?: number; under?: number } };
    btts?: { yes?: number; no?: number };
  };
  recommendation?: {
    matchResult?: string;
    overUnder?: string;
    btts?: string;
  };
}

interface BetOption {
  betType: BetType;
  selection: string;
  odds: number;
  label: string;
}

export default function AddToCouponButton({
  fixtureId,
  homeTeam,
  awayTeam,
  league,
  matchDate,
  odds,
  recommendation,
}: AddToCouponButtonProps) {
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);
  const [selectedBets, setSelectedBets] = useState<BetOption[]>([]);
  const [added, setAdded] = useState(false);

  // Generate available bet options
  const getBetOptions = (): BetOption[] => {
    const options: BetOption[] = [];

    // Match Result (1X2)
    if (odds?.matchWinner?.home) {
      options.push({
        betType: 'MATCH_RESULT',
        selection: '1',
        odds: odds.matchWinner.home,
        label: `Ev Sahibi Kazanır (${odds.matchWinner.home.toFixed(2)})`,
      });
    }
    if (odds?.matchWinner?.draw) {
      options.push({
        betType: 'MATCH_RESULT',
        selection: 'X',
        odds: odds.matchWinner.draw,
        label: `Beraberlik (${odds.matchWinner.draw.toFixed(2)})`,
      });
    }
    if (odds?.matchWinner?.away) {
      options.push({
        betType: 'MATCH_RESULT',
        selection: '2',
        odds: odds.matchWinner.away,
        label: `Deplasman Kazanır (${odds.matchWinner.away.toFixed(2)})`,
      });
    }

    // Over/Under 2.5
    if (odds?.overUnder?.['2.5']?.over) {
      options.push({
        betType: 'OVER_UNDER_25',
        selection: 'Over',
        odds: odds.overUnder['2.5'].over,
        label: `Üst 2.5 (${odds.overUnder['2.5'].over.toFixed(2)})`,
      });
    }
    if (odds?.overUnder?.['2.5']?.under) {
      options.push({
        betType: 'OVER_UNDER_25',
        selection: 'Under',
        odds: odds.overUnder['2.5'].under,
        label: `Alt 2.5 (${odds.overUnder['2.5'].under.toFixed(2)})`,
      });
    }

    // BTTS
    if (odds?.btts?.yes) {
      options.push({
        betType: 'BTTS',
        selection: 'Yes',
        odds: odds.btts.yes,
        label: `KG Var (${odds.btts.yes.toFixed(2)})`,
      });
    }
    if (odds?.btts?.no) {
      options.push({
        betType: 'BTTS',
        selection: 'No',
        odds: odds.btts.no,
        label: `KG Yok (${odds.btts.no.toFixed(2)})`,
      });
    }

    // If no odds, add default options with placeholder odds
    if (options.length === 0) {
      options.push(
        { betType: 'MATCH_RESULT', selection: '1', odds: 1.5, label: 'Ev Sahibi Kazanır' },
        { betType: 'MATCH_RESULT', selection: 'X', odds: 3.5, label: 'Beraberlik' },
        { betType: 'MATCH_RESULT', selection: '2', odds: 4.0, label: 'Deplasman Kazanır' },
        { betType: 'OVER_UNDER_25', selection: 'Over', odds: 1.85, label: 'Üst 2.5 Gol' },
        { betType: 'OVER_UNDER_25', selection: 'Under', odds: 1.95, label: 'Alt 2.5 Gol' },
        { betType: 'BTTS', selection: 'Yes', odds: 1.75, label: 'Karşılıklı Gol Var' },
        { betType: 'BTTS', selection: 'No', odds: 2.0, label: 'Karşılıklı Gol Yok' }
      );
    }

    return options;
  };

  const toggleBet = (option: BetOption) => {
    const exists = selectedBets.find(
      (b) => b.betType === option.betType && b.selection === option.selection
    );

    if (exists) {
      setSelectedBets(selectedBets.filter(
        (b) => !(b.betType === option.betType && b.selection === option.selection)
      ));
    } else {
      // Remove other selections of same bet type
      const filtered = selectedBets.filter((b) => b.betType !== option.betType);
      setSelectedBets([...filtered, option]);
    }
  };

  const handleAddToCoupon = () => {
    if (selectedBets.length === 0) return;

    // Save to session storage for coupon create page
    const picks = selectedBets.map((bet) => ({
      fixtureId,
      homeTeam,
      awayTeam,
      league,
      matchDate,
      betType: bet.betType,
      selection: bet.selection,
      odds: bet.odds,
    }));

    // Get existing pending picks
    const existingPicks = JSON.parse(sessionStorage.getItem('pendingCouponPicks') || '[]');
    
    // Merge new picks (avoid duplicates)
    const newPicks = [...existingPicks];
    picks.forEach((pick) => {
      const exists = newPicks.some(
        (p) => p.fixtureId === pick.fixtureId && p.betType === pick.betType
      );
      if (!exists) {
        newPicks.push(pick);
      }
    });

    sessionStorage.setItem('pendingCouponPicks', JSON.stringify(newPicks));

    setAdded(true);
    setShowOptions(false);

    // Reset after 2 seconds
    setTimeout(() => setAdded(false), 2000);
  };

  const goToCoupon = () => {
    router.push('/coupons/create');
  };

  const betOptions = getBetOptions();

  // Get recommended selections
  const getRecommendedSelection = (betType: BetType): string | null => {
    if (!recommendation) return null;
    
    switch (betType) {
      case 'MATCH_RESULT':
        return recommendation.matchResult || null;
      case 'OVER_UNDER_25':
        return recommendation.overUnder || null;
      case 'BTTS':
        return recommendation.btts || null;
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          added
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
        }`}
      >
        {added ? (
          <>
            <Check className="w-5 h-5" />
            Kupona Eklendi
          </>
        ) : (
          <>
            <Ticket className="w-5 h-5" />
            Kupona Ekle
          </>
        )}
      </button>

      {/* Options Dropdown */}
      {showOptions && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Bahis Seçin
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {homeTeam} vs {awayTeam}
            </p>
          </div>

          <div className="p-2 max-h-64 overflow-y-auto">
            {betOptions.map((option, index) => {
              const isSelected = selectedBets.some(
                (b) => b.betType === option.betType && b.selection === option.selection
              );
              const isRecommended = getRecommendedSelection(option.betType) === option.selection;

              return (
                <button
                  key={index}
                  onClick={() => toggleBet(option)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg mb-1 transition-colors ${
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    {isRecommended && (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                        Önerilen
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <button
              onClick={handleAddToCoupon}
              disabled={selectedBets.length === 0}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Ekle ({selectedBets.length})
            </button>
            <button
              onClick={goToCoupon}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Kupona Git
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {showOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowOptions(false)}
        />
      )}
    </div>
  );
}
