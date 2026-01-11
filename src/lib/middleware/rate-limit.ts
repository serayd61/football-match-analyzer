// ============================================================================
// RATE LIMITING MIDDLEWARE
// Redis tabanlı rate limiting - IP ve User bazlı
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** İstek limiti (örn: 100) */
  limit: number;
  /** Zaman penceresi (saniye cinsinden,örn: 60) */
  window: number;
  /** Kullanıcı bazlı mı, IP bazlı mı? */
  type: 'ip' | 'user' | 'both';
  /** Pro kullanıcılar için artırılmış limit */
  proLimit?: number;
  /** Hata mesajı */
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// ============================================================================
// RATE LIMIT PRESETS
// ============================================================================

export const RATE_LIMIT_PRESETS = {
  /** Public endpoint'ler için - 60 req/min */
  PUBLIC: { limit: 60, window: 60, type: 'ip' as const },
  
  /** Authenticated endpoint'ler için - 200 req/min */
  AUTHENTICATED: { limit: 200, window: 60, type: 'user' as const, proLimit: 500 },
  
  /** Analiz endpoint'leri için - 10 req/min (ağır işlemler) */
  ANALYSIS: { limit: 10, window: 60, type: 'user' as const, proLimit: 30 },
  
  /** API key endpoint'leri için - 1000 req/min */
  API_KEY: { limit: 1000, window: 60, type: 'user' as const },
  
  /** Cron/Admin endpoint'leri için - 100 req/min */
  ADMIN: { limit: 100, window: 60, type: 'user' as const },
} as const;

// ============================================================================
// RATE LIMIT CHECK
// ============================================================================

/**
 * Rate limit kontrolü yapar
 * @param request Next.js request
 * @param config Rate limit konfigürasyonu
 * @param userId Opsiyonel user ID (authenticated istekler için)
 * @returns Rate limit sonucu
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string | null
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  
  // IP adresini al
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Pro kullanıcı kontrolü (userId varsa Supabase'den kontrol edilebilir)
  const effectiveLimit = userId && config.proLimit 
    ? config.proLimit 
    : config.limit;
  
  // Rate limit key'lerini oluştur
  const keys: string[] = [];
  const identifiers: string[] = [];
  
  if (config.type === 'ip' || config.type === 'both') {
    const ipKey = CACHE_KEYS.RATE_LIMIT(`ip:${ip}`);
    keys.push(ipKey);
    identifiers.push(`ip:${ip}`);
  }
  
  if ((config.type === 'user' || config.type === 'both') && userId) {
    const userKey = CACHE_KEYS.RATE_LIMIT(`user:${userId}`);
    keys.push(userKey);
    identifiers.push(`user:${userId}`);
  }
  
  // Eğer hiç identifier yoksa (user bazlı ama userId yok), IP kullan
  if (keys.length === 0) {
    const ipKey = CACHE_KEYS.RATE_LIMIT(`ip:${ip}`);
    keys.push(ipKey);
    identifiers.push(`ip:${ip}`);
  }
  
  try {
    // Her key için count'u al ve artır
    const pipeline = keys.map(key => {
      return redis.incr(key);
    });
    
    const counts = await Promise.all(pipeline);
    
    // İlk istek ise TTL ayarla
    await Promise.all(keys.map((key, index) => {
      if (counts[index] === 1) {
        return redis.expire(key, config.window);
      }
      return Promise.resolve();
    }));
    
    // En yüksek count'u bul (her iki limit de kontrol edilmeli)
    const maxCount = Math.max(...counts);
    
    // Kalan istek sayısını hesapla
    const remaining = Math.max(0, effectiveLimit - maxCount);
    
    // Reset zamanı (şu an + window)
    const reset = Date.now() + (config.window * 1000);
    
    // Limit aşıldı mı?
    const success = maxCount <= effectiveLimit;
    
    // Retry after süresi (limit aşıldıysa)
    const retryAfter = !success ? Math.ceil(config.window - ((Date.now() / 1000) % config.window)) : undefined;
    
    return {
      success,
      limit: effectiveLimit,
      remaining,
      reset,
      retryAfter
    };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Redis hatası durumunda rate limit'i bypass et (graceful degradation)
    return {
      success: true,
      limit: effectiveLimit,
      remaining: effectiveLimit,
      reset: Date.now() + (config.window * 1000)
    };
  }
}

// ============================================================================
// RATE LIMIT MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Rate limit middleware wrapper - API route handler'ları için
 * 
 * @example
 * ```typescript
 * import { withRateLimit } from '@/lib/middleware/rate-limit';
 * import { RATE_LIMIT_PRESETS } from '@/lib/middleware/rate-limit';
 * 
 * export const POST = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your handler code
 *   },
 *   RATE_LIMIT_PRESETS.ANALYSIS
 * );
 * ```
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  config: RateLimitConfig,
  getUserId?: (request: NextRequest) => Promise<string | null>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // User ID'yi al (eğer getUserId fonksiyonu verilmişse)
    let userId: string | null = null;
    if (getUserId) {
      try {
        userId = await getUserId(request);
      } catch (error) {
        // User ID alınamazsa devam et (IP bazlı rate limit çalışır)
        console.warn('Failed to get user ID for rate limiting:', error);
      }
    }
    
    // Rate limit kontrolü
    const rateLimitResult = await checkRateLimit(request, config, userId);
    
    if (!rateLimitResult.success) {
      const message = config.message || 'Rate limit exceeded. Please try again later.';
      
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: 0,
            reset: rateLimitResult.reset,
            retryAfter: rateLimitResult.retryAfter
          }
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || config.window.toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    // Rate limit header'larını ekle
    const response = await handler(request, context);
    
    // Response header'larına rate limit bilgilerini ekle
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());
    
    return response;
  };
}

// ============================================================================
// AUTH HELPER (NextAuth session'dan user ID almak için)
// ============================================================================

/**
 * NextAuth session'dan user email'i alır (rate limiting için identifier olarak kullanılır)
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // NextAuth session'ını al
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    
    const session = await getServerSession(authOptions);
    return session?.user?.email || null;
  } catch (error) {
    console.warn('Failed to get user ID from session:', error);
    return null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Rate limit bilgisini resetle (admin işlemleri için)
 */
export async function resetRateLimit(identifier: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = CACHE_KEYS.RATE_LIMIT(identifier);
  
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Failed to reset rate limit for ${identifier}:`, error);
    return false;
  }
}

/**
 * Rate limit durumunu al (monitoring için)
 */
export async function getRateLimitStatus(identifier: string): Promise<{
  count: number;
  ttl: number;
} | null> {
  const redis = getRedisClient();
  const key = CACHE_KEYS.RATE_LIMIT(identifier);
  
  try {
    const count = await redis.get<number>(key) || 0;
    const ttl = await redis.ttl(key);
    
    return { count, ttl };
  } catch (error) {
    console.error(`Failed to get rate limit status for ${identifier}:`, error);
    return null;
  }
}
