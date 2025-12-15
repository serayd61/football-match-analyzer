'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Brain } from 'lucide-react';

interface AIBrainErrorProps {
  error: string;
  onRetry?: () => void;
}

export default function AIBrainError({ error, onRetry }: AIBrainErrorProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
            <Brain className="w-10 h-10 text-red-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center border-2 border-red-500/50">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
        </div>

        {/* Text */}
        <h3 className="text-xl font-bold text-red-400 mb-2">AI Brain Error</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-md">
          {error || 'Something went wrong while analyzing the match. Please try again.'}
        </p>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 font-medium transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}

        {/* Tips */}
        <div className="mt-6 text-left w-full max-w-md">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Troubleshooting Tips:</p>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>• Check your internet connection</li>
            <li>• Ensure API keys are configured correctly</li>
            <li>• Try selecting a different match</li>
            <li>• Contact support if the issue persists</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
