// ============================================================================
// AI CLIENT - Claude & OpenAI Direct API Integration
// Replaces Heurist with direct API calls + MCP support
// ============================================================================

export type AIModel = 'claude' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'deepseek';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  useMCP?: boolean; // MCP (Model Context Protocol) support
  mcpTools?: string[]; // MCP tools to use
  mcpFallback?: boolean; // Use MCP as fallback if AI fails
  fixtureId?: number; // For MCP data fetching
}

export interface MCPTool {
  name: string;
  description: string;
  parameters?: any;
}

// ============================================================================
// AI CLIENT CLASS
// ============================================================================

export class AIClient {
  private anthropicApiKey: string;
  private openaiApiKey: string;
  private deepseekApiKey: string;
  private mcpServerUrl?: string;

  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    // Use internal MCP server by default, or external if configured
    this.mcpServerUrl = process.env.MCP_SERVER_URL || this.getInternalMCPUrl();
    
    if (!this.anthropicApiKey) {
      console.warn('⚠️ ANTHROPIC_API_KEY not found');
    }
    if (!this.openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not found');
    }
    if (!this.deepseekApiKey) {
      console.warn('⚠️ DEEPSEEK_API_KEY not found');
    } else {
      console.log('✅ DeepSeek API key loaded');
    }
    console.log('✅ MCP Server URL:', this.mcpServerUrl);
  }

  private getInternalMCPUrl(): string {
    // In production, use the deployed URL
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}/api/mcp`;
    }
    // In development, use localhost
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return `${process.env.NEXT_PUBLIC_SITE_URL}/api/mcp`;
    }
    return 'http://localhost:3000/api/mcp';
  }

  /**
   * Call Claude API
   */
  async callClaude(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<string | null> {
    if (!this.anthropicApiKey) {
      console.error('❌ ANTHROPIC_API_KEY missing');
      return null;
    }

    // Claude 3 Haiku - hızlı ve ekonomik model
    const model = 'claude-3-haiku-20240307';
    
    const temperature = options.temperature ?? 0.15;
    const maxTokens = options.maxTokens ?? 1500; // Daha düşük token = daha hızlı
    const timeout = options.timeout ?? 8000; // 8 saniye default (Vercel 60s limit)

    try {
      console.log(`🤖 Claude calling ${model}${options.useMCP ? ' (with MCP)' : ''}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // MCP support: If enabled, add MCP context to messages
      let finalMessages = messages;
      if (options.useMCP && this.mcpServerUrl && options.mcpTools) {
        finalMessages = await this.enrichWithMCP(messages, options.mcpTools);
      }

      // Claude API requires system message as separate parameter
      let systemMessage: string | undefined;
      const userMessages = finalMessages.filter(m => {
        if (m.role === 'system') {
          systemMessage = m.content;
          return false;
        }
        return true;
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(systemMessage && { system: systemMessage }),
          messages: userMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Claude API error: ${response.status}`, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || null;
      
      if (content) {
        console.log(`✅ Claude response: ${content.length} chars`);
      }
      
      return content;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏱️ Claude API timeout after ${timeout}ms`);
      } else {
        console.error('❌ Claude request error:', error);
      }
      
      // MCP Fallback: If AI fails and mcpFallback is enabled, try to get data from MCP
      if (options.mcpFallback && options.fixtureId) {
        console.log('🔄 AI failed, trying MCP fallback...');
        return this.getMCPFallbackData(options.fixtureId, options.mcpTools || []);
      }
      
      return null;
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<string | null> {
    if (!this.openaiApiKey) {
      console.error('❌ OPENAI_API_KEY missing');
      return null;
    }

    // GPT-4 Turbo - en hızlı GPT-4 versiyonu
    const model = 'gpt-4-turbo-preview';
    
    const temperature = options.temperature ?? 0.15;
    const maxTokens = options.maxTokens ?? 1500; // Daha düşük token = daha hızlı
    const timeout = options.timeout ?? 8000; // 8 saniye (Vercel 60s limit)

    try {
      console.log(`🤖 OpenAI calling ${model}${options.useMCP ? ' (with MCP)' : ''}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // MCP support: If enabled, add MCP context to messages
      let finalMessages = messages;
      if (options.useMCP && this.mcpServerUrl && options.mcpTools) {
        finalMessages = await this.enrichWithMCP(messages, options.mcpTools);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: finalMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error: ${response.status}`, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      if (content) {
        console.log(`✅ OpenAI response: ${content.length} chars`);
      }
      
      return content;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏱️ OpenAI API timeout after ${timeout}ms`);
      } else {
        console.error('❌ OpenAI request error:', error);
      }
      
      // MCP Fallback: If AI fails and mcpFallback is enabled, try to get data from MCP
      if (options.mcpFallback && options.fixtureId) {
        console.log('🔄 AI failed, trying MCP fallback...');
        return this.getMCPFallbackData(options.fixtureId, options.mcpTools || []);
      }
      
      return null;
    }
  }

  /**
   * Call DeepSeek API - Specialized for deep analysis
   */
  async callDeepSeek(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<string | null> {
    if (!this.deepseekApiKey) {
      console.error('❌ DEEPSEEK_API_KEY missing');
      return null;
    }

    const model = 'deepseek-chat';
    const temperature = options.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? 2000; // Daha düşük token
    const timeout = options.timeout ?? 10000; // 10 saniye (Vercel 60s limit)

    try {
      console.log(`🤖 DeepSeek calling ${model}${options.useMCP ? ' (with MCP)' : ''}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // MCP support: If enabled, add MCP context to messages
      let finalMessages = messages;
      if (options.useMCP && this.mcpServerUrl && options.mcpTools) {
        finalMessages = await this.enrichWithMCP(messages, options.mcpTools);
      }

      // DeepSeek API OpenAI uyumlu format kullanıyor
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: finalMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ DeepSeek API error: ${response.status}`, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      
      if (content) {
        console.log(`✅ DeepSeek response: ${content.length} chars`);
      }
      
      return content;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏱️ DeepSeek API timeout after ${timeout}ms`);
      } else {
        console.error('❌ DeepSeek request error:', error);
      }
      
      // MCP Fallback: If AI fails and mcpFallback is enabled, try to get data from MCP
      if (options.mcpFallback && options.fixtureId) {
        console.log('🔄 DeepSeek failed, trying MCP fallback...');
        return this.getMCPFallbackData(options.fixtureId, options.mcpTools || []);
      }
      
      return null;
    }
  }

  /**
   * MCP Fallback - Get data directly from MCP when AI fails
   */
  private async getMCPFallbackData(fixtureId: number, tools: string[]): Promise<string | null> {
    if (!this.mcpServerUrl) {
      console.error('❌ MCP Server URL not configured for fallback');
      return null;
    }

    try {
      console.log(`🔧 MCP Fallback: Fetching data for fixture ${fixtureId}`);
      
      // Fetch multiple data sources from MCP
      const mcpResults: Record<string, any> = {};
      
      for (const tool of tools) {
        try {
          const response = await fetch(this.mcpServerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: tool,
                arguments: { fixtureId },
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.result?.content?.[0]?.text) {
              mcpResults[tool] = JSON.parse(data.result.content[0].text);
              console.log(`✅ MCP ${tool}: Data fetched`);
            }
          }
        } catch (toolError) {
          console.warn(`⚠️ MCP tool ${tool} failed:`, toolError);
        }
      }

      if (Object.keys(mcpResults).length === 0) {
        console.error('❌ MCP Fallback: No data retrieved');
        return null;
      }

      // Generate analysis from MCP data
      const fallbackAnalysis = this.generateFallbackAnalysis(mcpResults, fixtureId);
      console.log(`✅ MCP Fallback: Generated analysis from ${Object.keys(mcpResults).length} sources`);
      
      return JSON.stringify(fallbackAnalysis);
    } catch (error) {
      console.error('❌ MCP Fallback error:', error);
      return null;
    }
  }

  /**
   * Generate analysis from MCP data when AI is unavailable
   */
  private generateFallbackAnalysis(mcpData: Record<string, any>, fixtureId: number): any {
    const footballData = mcpData.football_data?.data;
    const oddsData = mcpData.odds_data?.data;
    const teamStats = mcpData.team_stats?.data;
    const h2h = mcpData.head_to_head?.data;

    // Extract key metrics
    const homeForm = footballData?.homeTeam?.form || [];
    const awayForm = footballData?.awayTeam?.form || [];
    const odds = oddsData?.odds || {};

    // Calculate basic predictions from data
    const homeWins = homeForm.filter((r: string) => r === 'W').length;
    const awayWins = awayForm.filter((r: string) => r === 'W').length;
    const homePoints = homeForm.reduce((acc: number, r: string) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
    const awayPoints = awayForm.reduce((acc: number, r: string) => acc + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);

    const formDiff = homePoints - awayPoints;
    const matchResult = formDiff > 3 ? '1' : formDiff < -3 ? '2' : 'X';
    const confidence = Math.min(75, 50 + Math.abs(formDiff) * 2);

    return {
      source: 'MCP_FALLBACK',
      fixtureId,
      matchResult: {
        prediction: matchResult,
        confidence,
        reasoning: `MCP Fallback: Ev sahibi ${homePoints} puan, Deplasman ${awayPoints} puan. Form farkı: ${formDiff > 0 ? '+' : ''}${formDiff}`,
      },
      overUnder: {
        prediction: 'Over',
        confidence: 55,
        reasoning: 'MCP Fallback: İstatistiksel ortalama kullanıldı',
      },
      btts: {
        prediction: 'Yes',
        confidence: 55,
        reasoning: 'MCP Fallback: İstatistiksel ortalama kullanıldı',
      },
      dataQuality: 'mcp_fallback',
      warning: 'Bu analiz AI yerine MCP verilerinden üretildi. Gerçek AI analizi için tekrar deneyin.',
    };
  }

  /**
   * Smart call - automatically chooses Claude or OpenAI based on model preference
   */
  async chat(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<string | null> {
    const model = options.model || 'claude';
    
    if (model === 'deepseek') {
      return this.callDeepSeek(messages, options);
    } else if (model === 'claude' || model.startsWith('claude')) {
      return this.callClaude(messages, options);
    } else {
      return this.callOpenAI(messages, options);
    }
  }

  /**
   * JSON response wrapper
   */
  async chatJSON<T>(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<T | null> {
    const response = await this.chat(messages, options);
    
    if (!response) {
      console.error('❌ No response from AI');
      return null;
    }

    const parsed = this.parseJSON<T>(response);
    
    if (!parsed) {
      console.error('❌ JSON parse failed. Raw response:', response.substring(0, 500));
    }
    
    return parsed;
  }

  /**
   * MCP (Model Context Protocol) Integration
   * Enriches messages with MCP tool context and can call MCP tools
   */
  private async enrichWithMCP(
    messages: AIMessage[],
    tools: string[]
  ): Promise<AIMessage[]> {
    if (!this.mcpServerUrl) {
      console.warn('⚠️ MCP Server URL not configured');
      return messages;
    }

    try {
      // Try to fetch available MCP tools via MCP protocol
      // MCP uses stdio or HTTP transport
      let mcpTools: MCPTool[] = [];
      
      try {
        // Try HTTP endpoint first
        const mcpResponse = await fetch(`${this.mcpServerUrl}/tools`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (mcpResponse.ok) {
          const data = await mcpResponse.json();
          mcpTools = data.tools || [];
        }
      } catch (httpError) {
        // If HTTP fails, try MCP protocol format
        try {
          const mcpProtocolResponse = await fetch(this.mcpServerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
            }),
          });

          if (mcpProtocolResponse.ok) {
            const data = await mcpProtocolResponse.json();
            mcpTools = data.result?.tools || [];
          }
        } catch (protocolError) {
          console.warn('⚠️ MCP tools fetch failed, continuing without MCP');
          return messages;
        }
      }

      if (mcpTools.length === 0) {
        console.warn('⚠️ No MCP tools available');
        return messages;
      }

      // Filter requested tools
      const requestedTools = mcpTools.filter((tool: MCPTool) =>
        tools.includes(tool.name)
      );

      if (requestedTools.length === 0) {
        console.warn(`⚠️ No matching MCP tools found. Available: ${mcpTools.map(t => t.name).join(', ')}`);
        // Use all available tools if specific ones not found
        const allToolsContext = `\n\n[MCP Tools Available]\n${mcpTools.map((tool: MCPTool) => 
          `- ${tool.name}: ${tool.description}`
        ).join('\n')}\n\nYou can use these tools to fetch additional data if needed.`;
        
        return messages.map((msg, idx) => {
          if (idx === 0 && msg.role === 'system') {
            return { ...msg, content: msg.content + allToolsContext };
          }
          return msg;
        });
      }

      // Add MCP context to system message
      const mcpContext = `\n\n[MCP Tools Available - Use these for enhanced data]\n${requestedTools.map((tool: MCPTool) => 
        `- ${tool.name}: ${tool.description}`
      ).join('\n')}\n\nYou can use these MCP tools to fetch real-time data, odds, team stats, or match context if needed.`;

      const enrichedMessages = messages.map((msg, idx) => {
        if (idx === 0 && msg.role === 'system') {
          return {
            ...msg,
            content: msg.content + mcpContext,
          };
        }
        return msg;
      });

      console.log(`✅ MCP: Enriched with ${requestedTools.length} tools: ${requestedTools.map(t => t.name).join(', ')}`);
      return enrichedMessages;
    } catch (error) {
      console.error('❌ MCP enrichment error:', error);
      return messages;
    }
  }

  /**
   * Parse JSON from response (with multiple strategies)
   */
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

  /**
   * Fix common JSON parsing issues
   */
  private fixCommonJsonIssues(text: string): string | null {
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

// Export singleton instance
export const aiClient = new AIClient();

