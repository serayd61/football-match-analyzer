// ============================================================================
// DATA PROVIDER MANAGER
// Birden fazla veri kaynağını yönetir ve fallback mekanizması sağlar
// ============================================================================

import { DataProvider } from './types';
import { BrightDataMCPProvider } from './bright-data-mcp';
import { SportmonksProvider } from './sportmonks-provider';

class DataProviderManager {
  private providers: DataProvider[] = [];
  
  constructor() {
    // Öncelik sırasına göre provider'ları ekle
    // Düşük priority numarası = yüksek öncelik
    
    // ⚠️ Bright Data devre dışı - kullanıcı isteği üzerine sadece Sportmonks kullanılıyor
    // if (process.env.BRIGHT_DATA_API_KEY) {
    //   this.providers.push(new BrightDataMCPProvider());
    //   console.log('✅ Bright Data MCP Provider loaded');
    // }
    
    // Sportmonks (tek kaynak)
    if (process.env.SPORTMONKS_API_KEY) {
      this.providers.push(new SportmonksProvider());
      console.log('✅ Sportmonks Provider loaded');
    }
    
    // Önceliğe göre sırala
    this.providers.sort((a, b) => a.priority - b.priority);
    
    console.log(`📊 Data Providers: ${this.providers.map(p => p.name).join(', ')}`);
    console.log(`⚠️ Bright Data disabled - using Sportmonks only`);
  }
  
  /**
   * İlk başarılı sonucu döndür (fallback mekanizması)
   * Her provider için timeout: 10 saniye
   */
  private async tryProviders<T>(
    method: keyof DataProvider,
    ...args: any[]
  ): Promise<{ data: T; provider: string } | null> {
    for (const provider of this.providers) {
      try {
        const fn = provider[method] as (...args: any[]) => Promise<T | null>;
        
        // Timeout wrapper - 10 saniye sonra iptal et
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 10000);
        });
        
        const result = await Promise.race([
          fn.apply(provider, args),
          timeoutPromise
        ]);
        
        if (result !== null && result !== undefined) {
          console.log(`✅ ${method} from ${provider.name}`);
          return { data: result, provider: provider.name };
        } else if (result === null) {
          console.log(`⏱️ ${provider.name} timeout for ${method} - trying next provider`);
        }
      } catch (error: any) {
        console.error(`❌ ${provider.name} error for ${method}:`, error.message?.substring(0, 100));
        continue; // Sonraki provider'ı dene
      }
    }
    
    console.error(`❌ All providers failed for ${method}`);
    return null;
  }
  
  // Public API - tüm provider metodları için wrapper'lar
  
  async getFixture(fixtureId: number) {
    return this.tryProviders('getFixture', fixtureId);
  }
  
  async getFixturesByDate(date: string, leagueId?: number) {
    return this.tryProviders('getFixturesByDate', date, leagueId);
  }
  
  async getTeamStats(teamId: number, seasonId?: number) {
    return this.tryProviders('getTeamStats', teamId, seasonId);
  }
  
  async getTeamRecentMatches(teamId: number, limit?: number) {
    return this.tryProviders('getTeamRecentMatches', teamId, limit);
  }
  
  async getTeamInjuries(teamId: number) {
    return this.tryProviders('getTeamInjuries', teamId);
  }
  
  async getHeadToHead(homeTeamId: number, awayTeamId: number) {
    return this.tryProviders('getHeadToHead', homeTeamId, awayTeamId);
  }
  
  async getPreMatchOdds(fixtureId: number) {
    return this.tryProviders('getPreMatchOdds', fixtureId);
  }
  
  async getReferee(fixtureId: number) {
    return this.tryProviders('getReferee', fixtureId);
  }
  
  async getLineup(fixtureId: number) {
    return this.tryProviders('getLineup', fixtureId);
  }
  
  async getTeamXG(teamId: number) {
    return this.tryProviders('getTeamXG', teamId);
  }
  
  /**
   * Tüm provider'ları listele
   */
  getProviders(): DataProvider[] {
    return [...this.providers];
  }
  
  /**
   * Belirli bir provider'ı kullan (test için)
   */
  async useProvider<T>(
    providerName: string,
    method: keyof DataProvider,
    ...args: any[]
  ): Promise<T | null> {
    const provider = this.providers.find(p => p.name === providerName);
    if (!provider) {
      console.error(`❌ Provider not found: ${providerName}`);
      return null;
    }
    
    try {
      const fn = provider[method] as (...args: any[]) => Promise<T | null>;
      return await fn.apply(provider, args);
    } catch (error) {
      console.error(`❌ ${providerName} error:`, error);
      return null;
    }
  }
}

// Singleton instance
export const dataProviderManager = new DataProviderManager();

// Convenience exports
export * from './types';
export { BrightDataMCPProvider } from './bright-data-mcp';
export { SportmonksProvider } from './sportmonks-provider';

