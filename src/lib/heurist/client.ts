const HEURIST_API_URL = 'https://llm-gateway.heurist.xyz/v1/chat/completions';

export type HeuristModel = 
  | 'mistralai/mistral-small-24b-instruct-2501'
  | 'meta-llama/llama-3.3-70b-instruct'
  | 'nvidia/llama-3.1-nemotron-70b-instruct'
  | 'deepseek/deepseek-r1-distill-llama-70b'
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
      console.warn('HEURIST_API_KEY not found');
    }
  }

  async chat(messages: HeuristMessage[], options: HeuristOptions = {}): Promise<string | null> {
    if (!this.apiKey) {
      console.error('Heurist API key missing');
      return null;
    }

    try {
      const model = options.model || this.defaultModel;
      console.log(`🤖 Heurist calling ${model}`);
      
      const response = await fetch(HEURIST_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages,
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.15, // Default düşük = tutarlı
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Heurist API error: ${response.status}`, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      if (content) {
        console.log(`✅ Heurist response: ${content.length} chars`);
      }
      
      return content;
    } catch (error) {
      console.error('❌ Heurist request error:', error);
      return null;
    }
  }

  async chatJSON<T>(messages: HeuristMessage[], options: HeuristOptions = {}): Promise<T | null> {
    const response = await this.chat(messages, options);
    
    if (!response) {
      console.error('❌ No response from Heurist');
      return null;
    }

    // Try multiple parsing strategies
    const parsed = this.parseJSON<T>(response);
    
    if (!parsed) {
      console.error('❌ JSON parse failed. Raw response:', response.substring(0, 500));
    }
    
    return parsed;
  }

  private parseJSON<T>(text: string): T | null {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(text) as T;
    } catch {}

    // Strategy 2: Remove markdown code blocks
    const cleanedMarkdown = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    try {
      return JSON.parse(cleanedMarkdown) as T;
    } catch {}

    // Strategy 3: Find JSON object in text
    const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]) as T;
      } catch {}
    }

    // Strategy 4: Find JSON array in text
    const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      try {
        return JSON.parse(jsonArrayMatch[0]) as T;
      } catch {}
    }

    // Strategy 5: Fix common JSON issues
    const fixedJson = this.fixCommonJsonIssues(text);
    if (fixedJson) {
      try {
        return JSON.parse(fixedJson) as T;
      } catch {}
    }

    return null;
  }

  private fixCommonJsonIssues(text: string): string | null {
    // Extract JSON-like content
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    let json = match[0];

    // Fix trailing commas
    json = json.replace(/,\s*}/g, '}');
    json = json.replace(/,\s*]/g, ']');

    // Fix unquoted keys
    json = json.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    json = json.replace(/'/g, '"');

    // Fix newlines in strings
    json = json.replace(/\n/g, '\\n');

    return json;
  }
}

export const heurist = new HeuristClient();
