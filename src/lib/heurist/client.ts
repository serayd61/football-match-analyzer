// src/lib/heurist/client.ts

const HEURIST_API_URL = 'https://llm-gateway.heurist.xyz/v1/chat/completions';
const HEURIST_API_KEY = process.env.HEURIST_API_KEY;

export type HeuristModel = 
  | 'deepseek-ai/deepseek-v3'           // En ucuz, hızlı
  | 'meta-llama/llama-3.1-70b-instruct' // Dengeli
  | 'meta-llama/llama-3.1-405b-instruct' // En güçlü
  | 'mistralai/mixtral-8x22b-instruct';  // İyi reasoning

export interface HeuristMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HeuristOptions {
  model?: HeuristModel;
  temperature?: number;
  maxTokens?: number;
  language?: 'tr' | 'en' | 'de';
}

export class HeuristClient {
  private apiKey: string;
  private defaultModel: HeuristModel = 'deepseek-ai/deepseek-v3';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || HEURIST_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Heurist API key not found');
    }
  }

  async chat(
    messages: HeuristMessage[],
    options: HeuristOptions = {}
  ): Promise<string | null> {
    try {
      const response = await fetch(HEURIST_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages,
          max_tokens: options.maxTokens || 3000,
          temperature: options.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        console.error('Heurist API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('Heurist request error:', error);
      return null;
    }
  }

  async chatJSON<T>(
    messages: HeuristMessage[],
    options: HeuristOptions = {}
  ): Promise<T | null> {
    const response = await this.chat(messages, options);
    if (!response) return null;

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim()) as T;
    } catch (error) {
      console.error('JSON parse error:', error);
      return null;
    }
  }
}

export const heurist = new HeuristClient();
