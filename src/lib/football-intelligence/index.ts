// ============================================================================
// FOOTBALL INTELLIGENCE - ANA EXPORT
// Tüm futbol zekası modüllerini bir araya getirir
// ============================================================================

// Lig Profilleri
export {
  LEAGUE_PROFILES,
  getLeagueProfile,
  adjustPredictionByLeague,
  calculateLeagueAdjustedGoalExpectancy,
  getXGReliability,
} from './league-profiles';
export type { LeagueProfile } from './league-profiles';

// xG Sağlayıcı
export {
  getTeamXGData,
  getMatchXGPrediction,
  calculateMatchProbabilities,
  analyzeXGPerformance,
} from './xg-provider';
export type { TeamXGData, MatchXGPrediction } from './xg-provider';

// Kadro ve Sakatlıklar
export {
  analyzeTeamSquad,
  analyzeMatchSquads,
  fetchInjuriesFromSportMonks,
  fetchSquadFromSportMonks,
  fetchLineupFromSportMonks,
} from './lineup-injuries';
export type {
  PlayerInfo,
  InjuryInfo,
  LineupInfo,
  TeamSquadAnalysis,
} from './lineup-injuries';

// Güven Kalibrasyonu
export {
  getHistoricalAccuracy,
  getConfidenceBandAccuracy,
  getLeaguePerformance,
  calibrateConfidence,
  calibrateEnsemble,
  assessPredictionRisk,
} from './confidence-calibration';
export type {
  HistoricalAccuracy,
  CalibrationAdjustment,
} from './confidence-calibration';

// Hakem İstatistikleri
export {
  fetchRefereeFromSportMonks,
  analyzeRefereeImpact,
  applyRefereeAdjustments,
} from './referee-stats';
export type {
  RefereeProfile,
  RefereeMatchImpact,
} from './referee-stats';

// Hava Durumu Etkisi
export {
  getMatchWeatherAnalysis,
  analyzeWeatherImpact,
  applyWeatherAdjustments,
  fetchWeatherFromOpenWeather,
} from './weather-impact';
export type {
  WeatherData,
  WeatherImpactAnalysis,
} from './weather-impact';

// Ana Analiz Motoru
export {
  runEnhancedAnalysis,
} from './enhanced-analyzer';
export type {
  EnhancedMatchData,
  EnhancedAnalysisResult,
} from './enhanced-analyzer';

