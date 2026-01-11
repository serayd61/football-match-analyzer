// ============================================================================
// CENTRALIZED ERROR HANDLER
// Standart hata formatı ve error handler middleware
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorCode {
  // 400 - Bad Request
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // 401 - Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // 403 - Forbidden
  FORBIDDEN = 'FORBIDDEN',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  LIMIT_REACHED = 'LIMIT_REACHED',
  
  // 404 - Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 429 - Rate Limited
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 500 - Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  
  // 503 - Service Unavailable
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}

export interface ApiError {
  success: false;
  error: string;
  code: ErrorCode;
  details?: any;
  timestamp: string;
  path?: string;
  requestId?: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  data?: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    processingTime?: number;
    cached?: boolean;
  };
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

export function createError(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: any
): AppError {
  return new AppError(code, message, statusCode, details);
}

// Common error creators
export const Errors = {
  validation: (message: string, details?: any) => 
    createError(ErrorCode.VALIDATION_ERROR, message, 400, details),
  
  missingField: (field: string) => 
    createError(ErrorCode.MISSING_REQUIRED_FIELD, `Missing required field: ${field}`, 400),
  
  unauthorized: (message: string = 'Unauthorized') => 
    createError(ErrorCode.UNAUTHORIZED, message, 401),
  
  forbidden: (message: string = 'Access denied') => 
    createError(ErrorCode.FORBIDDEN, message, 403),
  
  notFound: (resource: string = 'Resource') => 
    createError(ErrorCode.NOT_FOUND, `${resource} not found`, 404),
  
  rateLimited: (retryAfter?: number) => 
    createError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429,
      { retryAfter }
    ),
  
  internal: (message: string = 'Internal server error', details?: any) => 
    createError(ErrorCode.INTERNAL_ERROR, message, 500, details),
  
  database: (message: string = 'Database error', details?: any) => 
    createError(ErrorCode.DATABASE_ERROR, message, 500, details),
  
  externalApi: (service: string, details?: any) => 
    createError(
      ErrorCode.EXTERNAL_API_ERROR,
      `External API error: ${service}`,
      500,
      details
    ),
};

// ============================================================================
// ERROR HANDLER
// ============================================================================

/**
 * Hataları standart formata çevirir ve NextResponse döner
 */
export function handleError(
  error: unknown,
  request: NextRequest
): NextResponse<ApiError> {
  const requestId = request.headers.get('x-request-id') || 
                    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // AppError ise direkt kullan
  if (error instanceof AppError) {
    return NextResponse.json<ApiError>(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp: new Date().toISOString(),
        path: request.nextUrl.pathname,
        requestId,
      },
      { status: error.statusCode }
    );
  }
  
  // Zod validation error
  if (error && typeof error === 'object' && 'issues' in error) {
    return NextResponse.json<ApiError>(
      {
        success: false,
        error: 'Validation failed',
        code: ErrorCode.VALIDATION_ERROR,
        details: error,
        timestamp: new Date().toISOString(),
        path: request.nextUrl.pathname,
        requestId,
      },
      { status: 400 }
    );
  }
  
  // Standart Error
  if (error instanceof Error) {
    // Production'da internal error detaylarını gizle
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction && error.message.includes('internal') 
      ? 'An internal error occurred' 
      : error.message;
    
    return NextResponse.json<ApiError>(
      {
        success: false,
        error: message,
        code: ErrorCode.INTERNAL_ERROR,
        details: isProduction ? undefined : { stack: error.stack },
        timestamp: new Date().toISOString(),
        path: request.nextUrl.pathname,
        requestId,
      },
      { status: 500 }
    );
  }
  
  // Unknown error
  return NextResponse.json<ApiError>(
    {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
      path: request.nextUrl.pathname,
      requestId,
    },
    { status: 500 }
  );
}

// ============================================================================
// SUCCESS RESPONSE HELPER
// ============================================================================

/**
 * Başarılı response oluşturur
 */
export function successResponse<T>(
  data?: T,
  message?: string,
  meta?: ApiSuccess<T>['meta']
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>(
    {
      success: true,
      ...(data !== undefined && { data }),
      ...(message && { message }),
      ...(meta && { meta }),
    },
    { status: 200 }
  );
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE WRAPPER
// ============================================================================

/**
 * API handler'ını error handler ile sarar
 * 
 * @example
 * ```typescript
 * export const POST = withErrorHandler(async (request: NextRequest) => {
 *   // Your handler code - throw AppError or regular Error
 *   throw Errors.notFound('User');
 * });
 * ```
 */
export function withErrorHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Log error (production'da monitoring servisine gönderilebilir)
      console.error('API Error:', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return handleError(error, request);
    }
  };
}

// ============================================================================
// COMBINED MIDDLEWARE (Rate Limit + Error Handler)
// ============================================================================

import { withRateLimit, RateLimitConfig, getUserIdFromRequest, RATE_LIMIT_PRESETS } from './rate-limit';

// Re-export RATE_LIMIT_PRESETS for convenience
export { RATE_LIMIT_PRESETS };

/**
 * Hem rate limiting hem de error handling içeren middleware
 */
export function withApiMiddleware(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  rateLimitConfig?: RateLimitConfig
) {
  let wrappedHandler = handler;
  
  // Error handler ekle
  wrappedHandler = withErrorHandler(wrappedHandler);
  
  // Rate limit ekle (eğer config verilmişse)
  if (rateLimitConfig) {
    wrappedHandler = withRateLimit(
      wrappedHandler,
      rateLimitConfig,
      getUserIdFromRequest
    );
  }
  
  return wrappedHandler;
}
