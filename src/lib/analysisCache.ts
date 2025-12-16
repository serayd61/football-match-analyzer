// src/lib/analysisCache.ts
// Analysis Cache System - 30 dakika geçerli
// ═══════════════════════════════════════════════════════════════════════════════

type CacheType = 'analyze' | 'agents' | 'quad-brain';

interface CacheEntry {
  data: any;
  timestamp: number;
  language: string;
  type: CacheType;
}

// In-memory cache (server-side)
const cache = new Map<string, CacheEntry>();

// Cache süresi: 30 dakika
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Cache key oluştur
 * Format: {type}:{fixtureId}:{language}
 */
function createCacheKey(fixtureId: number | string, language: string, type: CacheType): string {
  return `${type}:${fixtureId}:${language}`;
}

/**
 * Cache'den veri al
 * @returns data veya null (cache miss veya expired)
 */
export function getCachedAnalysis(
  fixtureId: number | string, 
  language: string, 
  type: CacheType
): { data: any; cachedAt: Date } | null {
  const key = createCacheKey(fixtureId, language, type);
  const entry = cache.get(key);
  
  if (!entry) {
    console.log(`📦 Cache MISS: ${key}`);
    return null;
  }
  
  const now = Date.now();
  const age = now - entry.timestamp;
  
  // Cache expired?
  if (age > CACHE_DURATION) {
    console.log(`📦 Cache EXPIRED: ${key} (age: ${Math.round(age / 60000)} min)`);
    cache.delete(key);
    return null;
  }
  
  console.log(`📦 Cache HIT: ${key} (age: ${Math.round(age / 60000)} min)`);
  return {
    data: entry.data,
    cachedAt: new Date(entry.timestamp)
  };
}

/**
 * Cache'e veri kaydet
 */
export function setCachedAnalysis(
  fixtureId: number | string,
  language: string,
  type: CacheType,
  data: any
): void {
  const key = createCacheKey(fixtureId, language, type);
  
  cache.set(key, {
    data,
    timestamp: Date.now(),
    language,
    type
  });
  
  console.log(`📦 Cache SET: ${key}`);
  
  // Cache boyutunu kontrol et (max 100 entry)
  if (cache.size > 100) {
    // En eski entry'leri sil
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // İlk 20 eski entry'yi sil
    for (let i = 0; i < 20; i++) {
      cache.delete(entries[i][0]);
    }
    console.log(`📦 Cache CLEANUP: Removed 20 oldest entries`);
  }
}

/**
 * Belirli bir maç için tüm cache'leri temizle
 */
export function clearCacheForMatch(fixtureId: number): void {
  const keysToDelete: string[] = [];
  
  cache.forEach((_, key) => {
    if (key.includes(`:${fixtureId}:`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
  console.log(`📦 Cache CLEAR: ${keysToDelete.length} entries for fixture ${fixtureId}`);
}

/**
 * Tüm cache'i temizle
 */
export function clearAllCache(): void {
  const size = cache.size;
  cache.clear();
  console.log(`📦 Cache CLEAR ALL: ${size} entries removed`);
}

/**
 * Cache istatistikleri
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: cache.size,
    entries: Array.from(cache.keys())
  };
}

