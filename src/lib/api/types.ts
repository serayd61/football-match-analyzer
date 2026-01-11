// ============================================================================
// API TYPES - Standart Request/Response Type Definitions
// ============================================================================

import { ApiResponse, ApiSuccess, ApiError } from '../middleware/error-handler';

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string; // "field:asc" or "field:desc"
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================================
// FIXTURES API
// ============================================================================

export interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  leagueId: number;
  leagueLogo?: string;
  leagueCountry: string;
  date: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

export interface GetFixturesParams extends PaginationParams {
  date?: string; // YYYY-MM-DD
  league_id?: number;
  status?: 'NS' | 'LIVE' | 'FT' | 'POSTPONED' | 'CANCELLED';
}

export interface GetFixturesResponse extends ApiSuccess<{
  date: string;
  count: number;
  totalCount: number;
  fixtures: Fixture[];
  leagues: Array<{
    id: number;
    name: string;
    logo?: string;
    count: number;
  }>;
}> {}

// ============================================================================
// ANALYZE API
// ============================================================================

export interface AnalyzeRequest {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league?: string;
  matchDate?: string;
  skipCache?: boolean;
  preferAnalysis?: 'smart' | 'agent';
}

export interface AnalyzeResponse extends ApiSuccess<{
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  analysis: any; // Analysis result structure
  analysisType: 'smart' | 'agent';
  cached: boolean;
}> {}

// ============================================================================
// PREDICTIONS API
// ============================================================================

export interface Prediction {
  id: number;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  confidence: number;
  market: string;
  odds?: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  createdAt: string;
  settledAt?: string;
}

export interface GetPredictionsParams extends PaginationParams {
  fixtureId?: number;
  status?: 'pending' | 'won' | 'lost' | 'void';
  startDate?: string;
  endDate?: string;
}

export interface GetPredictionsResponse extends ApiSuccess<{
  predictions: Prediction[];
  pagination: PaginationMeta;
}> {}

// ============================================================================
// PERFORMANCE API
// ============================================================================

export interface PerformanceStats {
  totalPredictions: number;
  correctPredictions: number;
  incorrectPredictions: number;
  accuracy: number;
  roi: number;
  profit: number;
  averageConfidence: number;
}

export interface GetPerformanceResponse extends ApiSuccess<{
  stats: PerformanceStats;
  period: {
    startDate: string;
    endDate: string;
  };
}> {}

// ============================================================================
// USER API
// ============================================================================

export interface UserProfile {
  email: string;
  name: string;
  isPro: boolean;
  isTrial: boolean;
  trialDaysLeft?: number;
  subscriptionId?: string;
  subscriptionEnd?: string;
  analysesUsed: number;
  analysesLimit: number;
  favorites: number[];
}

export interface GetUserProfileResponse extends ApiSuccess<UserProfile> {}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success === true;
}

export function isApiError(response: ApiResponse): response is ApiError {
  return response.success === false;
}
