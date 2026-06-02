// ============================================================================
// DATA PROVIDER MANAGER
// Birden fazla veri kaynağını yönetir ve fallback mekanizması sağlar
// ============================================================================

import { DataProvider } from './types';
import { BrightDataMCPProvider } from './bright-data-mcp';
import { SportmonksProvider } from './sportmonks-provider';
import { FreeFootballProvider } from './free-football-provider';

class DataProviderManager {
  private providers: DataProvider[] = [];

  constructor() {
    // Öncelik sırasına göre provider'ları ekle
    // Düşük priority numarası = yüksek öncelik

    // Free API Live Football Data (birincil — Sportmonks'un yerini aldı)
    if (process.env.FOOTBALL_API_KEY) {
      this.providers.push(new FreeFootballProvider());
      console.log('✅ FreeFootball Provider loaded (primary)');
    }

    // Sportmonks (yedek — yalnızca anahtar hâlâ tanımlıysa)
    if (process.env.SPORTMONKS_API_KEY) {
      this.providers.push(new SportmonksProvider());
      console.log('✅ Sportmonks Provider loaded (fallback)');
    }

    // Önceliğe göre sırala
    this.providers.sort((a, b) => a.priority - b.priority);

    console.log(`📊 Data Providers: ${this.providers.map(p => p.name).join(', ') || 'NONE'}`);
  }

  // Methods that are expected to return null in many cases (pre-match data not available)
  private optionalDataMethods = new Set(['getReferee', 'getLineup']);

  /**
   * İlk başarılı sonucu döndür (fallback mekanizması)
   * Her provider için timeout: 10 saniye
   */
  private async tryProviders<T>(
    method: keyof DataProvider,
    ...args: any[]
  ): Promise<{ data: T; provider: string } | null> {
    const isOptionalData = this.optionalDataMethods.has(method);

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
          // Don't log timeout for optional data - it's expected
          if (!isOptionalData) {
            console.log(`⏱️ ${provider.name} timeout for ${method} - trying next provider`);
          }
        }
      } catch (error: any) {
        // Reduce noise for optional data
        if (!isOptionalData) {
          console.error(`❌ ${provider.name} error for ${method}:`, error.message?.substring(0, 100));
        }
        continue; // Sonraki provider'ı dene
      }
    }

    // Use different log level for optional vs required data
    if (isOptionalData) {
      console.log(`ℹ️ ${method} not available yet (pre-match data - expected)`);
    } else {
      console.error(`❌ All providers failed for ${method}`);
    }
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

