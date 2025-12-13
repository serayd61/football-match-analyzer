// src/components/AgentLoadingProgress.tsx
'use client';

import { useState, useEffect } from 'react';

interface AgentLoadingProgressProps {
  isLoading: boolean;
}

const agents = [
  { id: 'scout', name: 'Scout Agent', icon: '🔍', description: 'Veri toplama...', color: 'from-blue-500 to-cyan-500' },
  { id: 'stats', name: 'Stats Agent', icon: '📊', description: 'İstatistik analizi...', color: 'from-green-500 to-emerald-500' },
  { id: 'odds', name: 'Odds Agent', icon: '💰', description: 'Oran analizi...', color: 'from-yellow-500 to-orange-500' },
  { id: 'sentiment', name: 'Sentiment Agent', icon: '🎭', description: 'Duygu analizi...', color: 'from-pink-500 to-rose-500' },
  { id: 'strategy', name: 'Strategy Agent', icon: '🧠', description: 'Strateji oluşturma...', color: 'from-purple-500 to-indigo-500' },
];

export default function AgentLoadingProgress({ isLoading }: AgentLoadingProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setCompletedSteps([]);
      return;
    }

    // Her 3-4 saniyede bir step ilerle
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < agents.length - 1) {
          setCompletedSteps((completed) => [...completed, agents[prev].id]);
          return prev + 1;
        }
        return prev;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-purple-500/20 rounded-full border border-purple-500/30 mb-4">
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
          <span className="text-purple-400 font-medium">AI Ajanları Çalışıyor</span>
        </div>
        <p className="text-gray-400 text-sm">5 farklı AI agent maçı analiz ediyor...</p>
      </div>

      {/* Agent Progress */}
      <div className="space-y-3">
        {agents.map((agent, index) => {
          const isCompleted = completedSteps.includes(agent.id);
          const isActive = index === currentStep && !isCompleted;
          const isPending = index > currentStep;

          return (
            <div
              key={agent.id}
              className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                isCompleted
                  ? 'bg-green-500/10 border-green-500/30'
                  : isActive
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-gray-800/30 border-gray-700/30 opacity-50'
              }`}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500'
                    : isActive
                    ? `bg-gradient-to-r ${agent.color}`
                    : 'bg-gray-700'
                }`}
              >
                {isCompleted ? (
                  <span className="text-white text-xl">✓</span>
                ) : (
                  <span className="text-2xl">{agent.icon}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{agent.name}</span>
                  {isActive && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full animate-pulse">
                      Çalışıyor
                    </span>
                  )}
                  {isCompleted && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Tamamlandı
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{agent.description}</p>
              </div>

              {/* Progress indicator for active agent */}
              {isActive && (
                <div className="w-8 h-8">
                  <svg className="animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Toplam İlerleme</span>
          <span>{Math.min(100, Math.round(((completedSteps.length + (currentStep === agents.length - 1 ? 1 : 0)) / agents.length) * 100))}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${((completedSteps.length + (currentStep === agents.length - 1 ? 0.5 : 0)) / agents.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div>
            <p className="text-blue-400 font-medium text-sm">İpucu</p>
            <p className="text-gray-400 text-xs mt-1">
              AI ajanları maç verilerini, istatistikleri, oranları ve haberleri analiz ediyor. 
              Bu işlem 15-30 saniye sürebilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
