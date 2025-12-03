// src/lib/heurist/client.ts

const HEURIST_API_URL = 'https://llm-gateway.heurist.xyz/v1/chat/completions';

export type HeuristModel = 
  | 'mistralai/mistral-small-24b-instruct-2501'
  | 'meta-llama/llama-3.3-70b-instruct'
  | 'nvidia/llama-3.1-nemotron-70b-instruct'
  | 'deepseek/deepseek-r1-distill-llama-70b'
  | 'qwen/qwen-2.5-72b-instruct'
  | 'hermes-3-llama-3.1-70b';

export interface HeuristMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HeuristOptions {
  model?: HeuristModel;
  temperature?: number;
  maxTokens?: number;
}

export class HeuristClient {
  private apiKey: string;
  private defaultModel: HeuristModel = 'meta-llama/llama-3.3-70b-instruct';

  constructor() {
    this.apiKey = process.env.HEURIST_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ HEURIST_API_KEY not found!');
    }
  }

  async chat(messages: HeuristMessage[], options: HeuristOptions = {}): Promise<string | null> {
    if (!this.apiKey) {
      console.error('❌ Heurist API key missing');
      return null;
    }

    try {
      const model = options.model || this.defaultModel;
      console.log(`🤖 Heurist calling ${model}...`);
      
      const response = await fetch(HEURIST_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages,
          max_tokens: options.maxTokens || 3000,
          temperature: options.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Heurist API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      console.log('✅ Heurist response received');
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('❌ Heurist request error:', error);
      return null;
    }
  }

 async chatJSON<T>(messages: HeuristMessage[], options: HeuristOptions = {}): Promise<T | null> {
  const response = await this.chat(messages, options);
  if (!response) return null;

  try {
    // Önce direkt parse dene
    try {
      return JSON.parse(response) as T;
    } catch {
      // JSON bloğunu bul
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Temizle ve parse et
        let jsonStr = jsonMatch[0];
        
        // Yaygın hataları düzelt
        jsonStr = jsonStr
          .replace(/,\s*}/g, '}')  // Trailing comma
          .replace(/,\s*]/g, ']')  // Trailing comma in array
          .replace(/'/g, '"')      // Single quotes to double
          .replace(/(\w+):/g, '"$1":') // Unquoted keys
          .replace(/""+/g, '"');   // Double quotes
        
        try {
          return JSON.parse(jsonStr) as T;
        } catch (e2) {
          console.error('❌ JSON cleanup failed:', e2);
          console.error('Raw response:', response.slice(0, 500));
          return null;
        }
      }
      console.error('❌ No JSON found in response');
      return null;
    }
  } catch (error) {
    console.error('❌ JSON parse error:', error);
    return null;
  }
}

export const heurist = new HeuristClient();
