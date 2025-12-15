// src/components/AIConsensusLoading.tsx
'use client';

import { useState, useEffect } from 'react';

interface AIConsensusLoadingProps {
  isLoading: boolean;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
}

const AI_MODELS = [
  { id: 'claude', name: 'Claude', icon: '🟣', color: 'purple' },
  { id: 'openai', name: 'GPT-4', icon: '🟢', color: 'green' },
  { id: 'gemini', name: 'Gemini', icon: '🔵', color: 'blue' },
  { id: 'perplexity', name: 'Perplexity', icon: '🟠', color: 'orange' },
];

const LOADING_STEPS = {
  tr: [
    { step: 1, text: '📊 Maç verileri toplanıyor...', duration: 2000 },
    { step: 2, text: '📈 Form analizi yapılıyor...', duration: 2500 },
    { step: 3, text: '🔄 H2H istatistikleri çekiliyor...', duration: 2000 },
    { step: 4, text: '💰 Bahis oranları analiz ediliyor...', duration: 2500 },
    { step: 5, text: '🤖 AI modelleri çalışıyor...', duration: 3000 },
    { step: 6, text: '🗳️ Oylar hesaplanıyor...', duration: 2000 },
    { step: 7, text: '✨ Konsensüs oluşturuluyor...', duration: 1500 },
  ],
  en: [
    { step: 1, text: '📊 Fetching match data...', duration: 2000 },
    { step: 2, text: '📈 Analyzing team form...', duration: 2500 },
    { step: 3, text: '🔄 Loading H2H statistics...', duration: 2000 },
    { step: 4, text: '💰 Processing betting odds...', duration: 2500 },
    { step: 5, text: '🤖 AI models working...', duration: 3000 },
    { step: 6, text: '🗳️ Calculating votes...', duration: 2000 },
    { step: 7, text: '✨ Building consensus...', duration: 1500 },
  ],
  de: [
    { step: 1, text: '📊 Spieldaten werden geladen...', duration: 2000 },
    { step: 2, text: '📈 Formanalyse läuft...', duration: 2500 },
    { step: 3, text: '🔄 H2H-Statistiken werden abgerufen...', duration: 2000 },
    { step: 4, text: '💰 Quoten werden analysiert...', duration: 2500 },
    { step: 5, text: '🤖 KI-Modelle arbeiten...', duration: 3000 },
    { step: 6, text: '🗳️ Stimmen werden gezählt...', duration: 2000 },
    { step: 7, text: '✨ Konsens wird erstellt...', duration: 1500 },
  ],
};

export default function AIConsensusLoading({
  isLoading,
  homeTeam,
  awayTeam,
  homeTeamLogo,
  awayTeamLogo,
}: AIConsensusLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [modelStatus, setModelStatus] = useState<Record<string, 'waiting' | 'loading' | 'done'>>({
    claude: 'waiting',
    openai: 'waiting',
    gemini: 'waiting',
    perplexity: 'waiting',
  });
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState<'tr' | 'en' | 'de'>('en');

  useEffect(() => {
    // Detect language from localStorage or navigator
    const savedLang = localStorage.getItem('preferred-language') as 'tr' | 'en' | 'de';
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const steps = LOADING_STEPS[language];

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setProgress(0);
      setModelStatus({
        claude: 'waiting',
        openai: 'waiting',
        gemini: 'waiting',
        perplexity: 'waiting',
      });
      return;
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3;
      });
    }, 200);

    // Step animation
    let stepIndex = 0;
    const runStep = () => {
      if (stepIndex >= steps.length) return;
      
      setCurrentStep(stepIndex);
      
      // Activate AI models at step 5
      if (stepIndex === 4) {
        // Stagger model activations
        setTimeout(() => setModelStatus(prev => ({ ...prev, claude: 'loading' })), 0);
        setTimeout(() => setModelStatus(prev => ({ ...prev, openai: 'loading' })), 500);
        setTimeout(() => setModelStatus(prev => ({ ...prev, gemini: 'loading' })), 1000);
        setTimeout(() => setModelStatus(prev => ({ ...prev, perplexity: 'loading' })), 1500);
        
        // Mark as done
        setTimeout(() => setModelStatus(prev => ({ ...prev, claude: 'done' })), 2000);
        setTimeout(() => setModelStatus(prev => ({ ...prev, openai: 'done' })), 2500);
        setTimeout(() => setModelStatus(prev => ({ ...prev, gemini: 'done' })), 3000);
        setTimeout(() => setModelStatus(prev => ({ ...prev, perplexity: 'done' })), 3500);
      }
      
      stepIndex++;
      if (stepIndex < steps.length) {
        setTimeout(runStep, steps[stepIndex - 1].duration);
      }
    };

    runStep();

    return () => {
      clearInterval(progressInterval);
    };
  }, [isLoading, steps]);

  if (!isLoading) return null;

  const getModelStatusIcon = (status: 'waiting' | 'loading' | 'done') => {
    switch (status) {
      case 'waiting':
        return <div className="w-4 h-4 rounded-full bg-gray-600" />;
      case 'loading':
        return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
      case 'done':
        return <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[10px]">✓</div>;
    }
  };

  const getModelBorderColor = (model: typeof AI_MODELS[0], status: 'waiting' | 'loading' | 'done') => {
    if (status === 'waiting') return 'border-gray-700';
    if (status === 'done') return 'border-green-500';
    switch (model.color) {
      case 'purple': return 'border-purple-500';
      case 'green': return 'border-green-500';
      case 'blue': return 'border-blue-500';
      case 'orange': return 'border-orange-500';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
      {/* Header with Teams */}
      <div className="p-6 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 border-b border-gray-700/50">
        <div className="flex items-center justify-center gap-6">
          {/* Home Team */}
          <div className="flex flex-col items-center">
            {homeTeamLogo ? (
              <img src={homeTeamLogo} alt={homeTeam} className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                {homeTeam.charAt(0)}
              </div>
            )}
            <span className="mt-2 text-white font-semibold text-sm truncate max-w-[100px]">{homeTeam}</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center">
              <span className="text-gray-400 font-bold">VS</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">LIVE</span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center">
            {awayTeamLogo ? (
              <img src={awayTeamLogo} alt={awayTeam} className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                {awayTeam.charAt(0)}
              </div>
            )}
            <span className="mt-2 text-white font-semibold text-sm truncate max-w-[100px]">{awayTeam}</span>
          </div>
        </div>
      </div>

      {/* AI Models Status */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white mb-1">
            🤖 AI Konsensüs Analizi
          </h3>
          <p className="text-sm text-gray-400">4 AI model çalışıyor</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {AI_MODELS.map((model) => {
            const status = modelStatus[model.id];
            return (
              <div
                key={model.id}
                className={`relative p-3 rounded-xl border-2 transition-all duration-500 ${getModelBorderColor(model, status)} ${
                  status === 'loading' ? 'bg-gray-700/50 shadow-lg' : 
                  status === 'done' ? 'bg-green-500/10' : 'bg-gray-800/50'
                }`}
              >
                {/* Glow effect when loading */}
                {status === 'loading' && (
                  <div className={`absolute inset-0 rounded-xl bg-${model.color}-500/20 animate-pulse`} />
                )}
                
                <div className="relative flex flex-col items-center">
                  <span className="text-2xl mb-1">{model.icon}</span>
                  <span className={`text-xs font-medium ${
                    status === 'done' ? 'text-green-400' : 
                    status === 'loading' ? 'text-white' : 'text-gray-500'
                  }`}>
                    {model.name}
                  </span>
                  <div className="mt-2">
                    {getModelStatusIcon(status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="flex-1">
            <div className="text-white font-medium">
              {steps[currentStep]?.text || steps[0].text}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Adım {currentStep + 1}/{steps.length}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">İlerleme</span>
          <span className="text-xs text-green-400 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Step indicators */}
        <div className="flex justify-between mt-3">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-blue-500 text-white animate-pulse'
                  : 'bg-gray-700 text-gray-500'
              }`}
            >
              {index < currentStep ? '✓' : step.step}
            </div>
          ))}
        </div>
      </div>

      {/* Fun Facts */}
      <div className="px-4 pb-4">
        <div className="bg-gray-700/30 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-400">
            💡 <span className="text-gray-300">AI modelleri geçmiş 1000+ maçtan öğrendi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
