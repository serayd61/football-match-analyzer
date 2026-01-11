// ============================================================================
// OPENAPI/SWAGGER DOCUMENTATION
// API dokümantasyonu için OpenAPI 3.0 spec oluşturur
// ============================================================================

// ============================================================================
// OPENAPI SPEC DEFINITION
// ============================================================================

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Football Match Analyzer API',
    version: '2.0.0',
    description: 'AI destekli futbol maç analizi API\'si. Maç tahminleri, performans istatistikleri ve analiz araçları.',
    contact: {
      name: 'API Support',
      email: 'support@footballanalyzer.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://footballanalyzer.vercel.app/api/v2',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000/api/v2',
      description: 'Development',
    },
  ],
  tags: [
    {
      name: 'Fixtures',
      description: 'Maç listesi ve detayları',
    },
    {
      name: 'Analysis',
      description: 'AI destekli maç analizleri',
    },
    {
      name: 'Predictions',
      description: 'Tahminler ve sonuçları',
    },
    {
      name: 'Performance',
      description: 'Performans istatistikleri',
    },
    {
      name: 'User',
      description: 'Kullanıcı profil ve ayarları',
    },
  ],
  paths: {
    '/fixtures': {
      get: {
        tags: ['Fixtures'],
        summary: 'Maç listesi getir',
        description: 'Belirli bir tarih ve lig için maç listesini getirir',
        operationId: 'getFixtures',
        parameters: [
          {
            name: 'date',
            in: 'query',
            description: 'Tarih (YYYY-MM-DD formatında). Varsayılan: bugün',
            required: false,
            schema: {
              type: 'string',
              format: 'date',
              example: '2024-01-15',
            },
          },
          {
            name: 'league_id',
            in: 'query',
            description: 'Lig ID\'si ile filtrele',
            required: false,
            schema: {
              type: 'integer',
              example: 39,
            },
          },
          {
            name: 'page',
            in: 'query',
            description: 'Sayfa numarası',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Sayfa başına kayıt sayısı',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Başarılı response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetFixturesResponse',
                },
                example: {
                  success: true,
                  data: {
                    date: '2024-01-15',
                    count: 25,
                    totalCount: 125,
                    fixtures: [
                      {
                        id: 12345,
                        homeTeam: 'Arsenal',
                        awayTeam: 'Chelsea',
                        homeTeamId: 42,
                        awayTeamId: 49,
                        league: 'Premier League',
                        leagueId: 39,
                        date: '2024-01-15T15:00:00Z',
                        status: 'NS',
                      },
                    ],
                    leagues: [
                      {
                        id: 39,
                        name: 'Premier League',
                        count: 10,
                      },
                    ],
                  },
                  meta: {
                    cached: true,
                    processingTime: 45,
                  },
                },
              },
            },
          },
          '400': {
            $ref: '#/components/responses/BadRequest',
          },
          '429': {
            $ref: '#/components/responses/RateLimitExceeded',
          },
          '500': {
            $ref: '#/components/responses/InternalError',
          },
        },
      },
    },
    '/analyze': {
      post: {
        tags: ['Analysis'],
        summary: 'Maç analizi yap',
        description: 'AI destekli maç analizi yapar ve tahmin üretir',
        operationId: 'analyzeMatch',
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AnalyzeRequest',
              },
              example: {
                fixtureId: 12345,
                homeTeam: 'Arsenal',
                awayTeam: 'Chelsea',
                homeTeamId: 42,
                awayTeamId: 49,
                league: 'Premier League',
                matchDate: '2024-01-15T15:00:00Z',
                skipCache: false,
                preferAnalysis: 'agent',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Başarılı analiz',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AnalyzeResponse',
                },
              },
            },
          },
          '401': {
            $ref: '#/components/responses/Unauthorized',
          },
          '403': {
            $ref: '#/components/responses/Forbidden',
          },
          '429': {
            $ref: '#/components/responses/RateLimitExceeded',
          },
          '500': {
            $ref: '#/components/responses/InternalError',
          },
        },
      },
    },
    '/predictions': {
      get: {
        tags: ['Predictions'],
        summary: 'Tahminler listesi',
        description: 'Kullanıcının tahminlerini getirir',
        operationId: 'getPredictions',
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'fixtureId',
            in: 'query',
            description: 'Fixture ID ile filtrele',
            required: false,
            schema: {
              type: 'integer',
            },
          },
          {
            name: 'status',
            in: 'query',
            description: 'Tahmin durumu ile filtrele',
            required: false,
            schema: {
              type: 'string',
              enum: ['pending', 'won', 'lost', 'void'],
            },
          },
          {
            name: 'page',
            in: 'query',
            schema: {
              type: 'integer',
              default: 1,
            },
          },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'integer',
              default: 20,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Başarılı',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetPredictionsResponse',
                },
              },
            },
          },
          '401': {
            $ref: '#/components/responses/Unauthorized',
          },
          '500': {
            $ref: '#/components/responses/InternalError',
          },
        },
      },
    },
    '/performance': {
      get: {
        tags: ['Performance'],
        summary: 'Performans istatistikleri',
        description: 'Kullanıcının tahmin performans istatistiklerini getirir',
        operationId: 'getPerformance',
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            schema: {
              type: 'string',
              format: 'date',
            },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: {
              type: 'string',
              format: 'date',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Başarılı',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GetPerformanceResponse',
                },
              },
            },
          },
          '401': {
            $ref: '#/components/responses/Unauthorized',
          },
          '500': {
            $ref: '#/components/responses/InternalError',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'NextAuth JWT token',
      },
    },
    schemas: {
      // Common
      ApiSuccess: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
          },
          message: {
            type: 'string',
          },
          meta: {
            $ref: '#/components/schemas/ResponseMeta',
          },
        },
      },
      ApiError: {
        type: 'object',
        required: ['success', 'error', 'code'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'string',
            example: 'Rate limit exceeded',
          },
          code: {
            type: 'string',
            example: 'RATE_LIMIT_EXCEEDED',
          },
          details: {
            type: 'object',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          path: {
            type: 'string',
            example: '/api/v2/analyze',
          },
          requestId: {
            type: 'string',
            example: 'req_1234567890_abc123',
          },
        },
      },
      ResponseMeta: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
          },
          limit: {
            type: 'integer',
          },
          total: {
            type: 'integer',
          },
          processingTime: {
            type: 'integer',
            description: 'İşlem süresi (milisaniye)',
          },
          cached: {
            type: 'boolean',
            description: 'Response cache\'den mi geldi?',
          },
        },
      },
      // Fixtures
      Fixture: {
        type: 'object',
        required: ['id', 'homeTeam', 'awayTeam', 'league', 'date'],
        properties: {
          id: {
            type: 'integer',
            example: 12345,
          },
          homeTeam: {
            type: 'string',
            example: 'Arsenal',
          },
          awayTeam: {
            type: 'string',
            example: 'Chelsea',
          },
          homeTeamId: {
            type: 'integer',
            example: 42,
          },
          awayTeamId: {
            type: 'integer',
            example: 49,
          },
          homeTeamLogo: {
            type: 'string',
            format: 'uri',
          },
          awayTeamLogo: {
            type: 'string',
            format: 'uri',
          },
          league: {
            type: 'string',
            example: 'Premier League',
          },
          leagueId: {
            type: 'integer',
            example: 39,
          },
          leagueLogo: {
            type: 'string',
            format: 'uri',
          },
          leagueCountry: {
            type: 'string',
            example: 'England',
          },
          date: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T15:00:00Z',
          },
          status: {
            type: 'string',
            enum: ['NS', 'LIVE', 'FT', 'POSTPONED', 'CANCELLED'],
          },
          homeScore: {
            type: 'integer',
          },
          awayScore: {
            type: 'integer',
          },
        },
      },
      GetFixturesResponse: {
        allOf: [
          {
            $ref: '#/components/schemas/ApiSuccess',
          },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    format: 'date',
                  },
                  count: {
                    type: 'integer',
                  },
                  totalCount: {
                    type: 'integer',
                  },
                  fixtures: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Fixture',
                    },
                  },
                  leagues: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'integer',
                        },
                        name: {
                          type: 'string',
                        },
                        logo: {
                          type: 'string',
                        },
                        count: {
                          type: 'integer',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      // Analysis
      AnalyzeRequest: {
        type: 'object',
        required: ['fixtureId', 'homeTeam', 'awayTeam', 'homeTeamId', 'awayTeamId'],
        properties: {
          fixtureId: {
            type: 'integer',
            example: 12345,
          },
          homeTeam: {
            type: 'string',
            example: 'Arsenal',
          },
          awayTeam: {
            type: 'string',
            example: 'Chelsea',
          },
          homeTeamId: {
            type: 'integer',
            example: 42,
          },
          awayTeamId: {
            type: 'integer',
            example: 49,
          },
          league: {
            type: 'string',
            example: 'Premier League',
          },
          matchDate: {
            type: 'string',
            format: 'date-time',
          },
          skipCache: {
            type: 'boolean',
            default: false,
          },
          preferAnalysis: {
            type: 'string',
            enum: ['smart', 'agent'],
            default: 'agent',
          },
        },
      },
      AnalyzeResponse: {
        allOf: [
          {
            $ref: '#/components/schemas/ApiSuccess',
          },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  fixtureId: {
                    type: 'integer',
                  },
                  homeTeam: {
                    type: 'string',
                  },
                  awayTeam: {
                    type: 'string',
                  },
                  league: {
                    type: 'string',
                  },
                  matchDate: {
                    type: 'string',
                  },
                  analysis: {
                    type: 'object',
                    description: 'Analysis result structure',
                  },
                  analysisType: {
                    type: 'string',
                    enum: ['smart', 'agent'],
                  },
                  cached: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        ],
      },
      // Predictions
      Prediction: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
          },
          fixtureId: {
            type: 'integer',
          },
          homeTeam: {
            type: 'string',
          },
          awayTeam: {
            type: 'string',
          },
          prediction: {
            type: 'string',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
          market: {
            type: 'string',
          },
          odds: {
            type: 'number',
          },
          status: {
            type: 'string',
            enum: ['pending', 'won', 'lost', 'void'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          settledAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      GetPredictionsResponse: {
        allOf: [
          {
            $ref: '#/components/schemas/ApiSuccess',
          },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  predictions: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Prediction',
                    },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: {
                        type: 'integer',
                      },
                      limit: {
                        type: 'integer',
                      },
                      total: {
                        type: 'integer',
                      },
                      totalPages: {
                        type: 'integer',
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      // Performance
      PerformanceStats: {
        type: 'object',
        properties: {
          totalPredictions: {
            type: 'integer',
          },
          correctPredictions: {
            type: 'integer',
          },
          incorrectPredictions: {
            type: 'integer',
          },
          accuracy: {
            type: 'number',
            description: 'Doğruluk yüzdesi (0-100)',
          },
          roi: {
            type: 'number',
            description: 'Return on Investment (%)',
          },
          profit: {
            type: 'number',
            description: 'Toplam kar/zarar',
          },
          averageConfidence: {
            type: 'number',
            description: 'Ortalama güven skoru',
          },
        },
      },
      GetPerformanceResponse: {
        allOf: [
          {
            $ref: '#/components/schemas/ApiSuccess',
          },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  stats: {
                    $ref: '#/components/schemas/PerformanceStats',
                  },
                  period: {
                    type: 'object',
                    properties: {
                      startDate: {
                        type: 'string',
                        format: 'date',
                      },
                      endDate: {
                        type: 'string',
                        format: 'date',
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request - Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'Invalid date format. Use YYYY-MM-DD format.',
              code: 'VALIDATION_ERROR',
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/fixtures',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'Unauthorized',
              code: 'UNAUTHORIZED',
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/analyze',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Access denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'Daily analysis limit reached',
              code: 'LIMIT_REACHED',
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/analyze',
            },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'Fixture not found',
              code: 'NOT_FOUND',
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/fixtures/99999',
            },
          },
        },
      },
      RateLimitExceeded: {
        description: 'Rate Limit Exceeded',
        headers: {
          'X-RateLimit-Limit': {
            schema: {
              type: 'integer',
            },
            description: 'Request limit per window',
          },
          'X-RateLimit-Remaining': {
            schema: {
              type: 'integer',
            },
            description: 'Remaining requests in current window',
          },
          'X-RateLimit-Reset': {
            schema: {
              type: 'integer',
            },
            description: 'Unix timestamp when rate limit resets',
          },
          'Retry-After': {
            schema: {
              type: 'integer',
            },
            description: 'Seconds to wait before retrying',
          },
        },
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'Rate limit exceeded. Please try again later.',
              code: 'RATE_LIMIT_EXCEEDED',
              details: {
                retryAfter: 60,
              },
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/analyze',
            },
          },
        },
      },
      InternalError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ApiError',
            },
            example: {
              success: false,
              error: 'An internal error occurred',
              code: 'INTERNAL_ERROR',
              timestamp: '2024-01-15T10:30:00Z',
              path: '/api/v2/analyze',
            },
          },
        },
      },
    },
  },
};
