// ============================================================================
// UPSTASH REDIS CLIENT - Edge Cache
// Maç listesi ve analiz sonuçları için ultra-hızlı cache
// ============================================================================

import { Redis } from '@upstash/redis';

// Singleton Redis client
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      console.warn('⚠️ Upstash Redis credentials not found, using fallback');
      // Return a mock client for development
      return {
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        keys: async () => [],
        exists: async () => 0,
        expire: async () => 1,
        ttl: async () => -1,
        hget: async () => null,
        hset: async () => 1,
        hgetall: async () => null,
        hdel: async () => 1,
        sadd: async () => 1,
        smembers: async () => [],
        srem: async () => 1,
      } as unknown as Redis;
    }
    
    redis = new Redis({ url, token });
  }
  
  return redis;
}

// ============================================================================
// CACHE KEYS
// ============================================================================

export const CACHE_KEYS = {
  // Maç listesi cache
  FIXTURES_TODAY: 'fixtures:today',
  FIXTURES_DATE: (date: string) => `fixtures:${date}`,
  
  // Analiz sonuçları cache
  ANALYSIS: (fixtureId: number) => `analysis:${fixtureId}`,
  AGENT_ANALYSIS: (fixtureId: number) => `agent_analysis:${fixtureId}`,
  ANALYSIS_STATUS: (fixtureId: number) => `analysis:status:${fixtureId}`,
  
  // Queue status
  QUEUE_PENDING: 'queue:pending',
  QUEUE_PROCESSING: 'queue:processing',
  QUEUE_COMPLETED: 'queue:completed',
  
  // Rate limiting
  RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
};

// ============================================================================
// CACHE TTL (Time To Live) - saniye cinsinden
// ============================================================================

export const CACHE_TTL = {
  FIXTURES: 5 * 60,        // 5 dakika - maç listesi
  ANALYSIS: 60 * 60,       // 1 saat - analiz sonuçları
  ANALYSIS_STATUS: 30,     // 30 saniye - analiz durumu
  RATE_LIMIT: 60,          // 1 dakika
};

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Cache'den veri al, yoksa callback çalıştır ve cache'e kaydet
 */
export async function getOrSet<T>(
  key: string,
  callback: () => Promise<T>,
  ttl: number = CACHE_TTL.FIXTURES
): Promise<T> {
  const redis = getRedisClient();
  
  try {
    // Cache'den kontrol et
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache HIT: ${key}`);
      return cached;
    }
    
    console.log(`📦 Cache MISS: ${key}`);
    
    // Callback çalıştır
    const result = await callback();
    
    // Cache'e kaydet
    await redis.set(key, result, { ex: ttl });
    
    return result;
  } catch (error) {
    console.error(`Cache error for ${key}:`, error);
    // Cache hatası olursa callback'i çalıştır
    return callback();
  }
}

/**
 * Cache'i invalidate et
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map(key => redis.del(key)));
      console.log(`🗑️ Invalidated ${keys.length} cache keys matching: ${pattern}`);
    }
  } catch (error) {
    console.error(`Cache invalidation error for ${pattern}:`, error);
  }
}

/**
 * Analiz durumunu cache'e kaydet
 */
export async function setAnalysisStatus(
  fixtureId: number, 
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data?: any
): Promise<void> {
  const redis = getRedisClient();
  const key = CACHE_KEYS.ANALYSIS_STATUS(fixtureId);
  
  await redis.set(key, { status, data, updatedAt: Date.now() }, { ex: CACHE_TTL.ANALYSIS_STATUS });
}

/**
 * Analiz durumunu cache'den al
 */
export async function getAnalysisStatus(fixtureId: number): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';
  data?: any;
  updatedAt?: number;
}> {
  const redis = getRedisClient();
  const key = CACHE_KEYS.ANALYSIS_STATUS(fixtureId);
  
  const result = await redis.get<{ status: string; data?: any; updatedAt?: number }>(key);
  
  if (!result) {
    return { status: 'not_found' };
  }
  
  return result as any;
}

