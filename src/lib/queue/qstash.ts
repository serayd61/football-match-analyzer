// ============================================================================
// UPSTASH QSTASH CLIENT - Background Jobs
// Analiz işlerini queue'a ekle, arka planda çalıştır
// ============================================================================

import { Client } from '@upstash/qstash';

// Singleton QStash client
let qstash: Client | null = null;

export function getQStashClient(): Client | null {
  if (!qstash) {
    const token = process.env.QSTASH_TOKEN;
    
    if (!token) {
      console.warn('⚠️ QStash token not found');
      return null;
    }
    
    qstash = new Client({ token });
  }
  
  return qstash;
}

// ============================================================================
// QUEUE TYPES
// ============================================================================

export interface AnalysisJob {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  league: string;
  matchDate: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
}

export interface JobResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// QUEUE FUNCTIONS
// ============================================================================

/**
 * Tek bir maç için analiz job'ı ekle
 */
export async function queueAnalysisJob(job: AnalysisJob): Promise<JobResult> {
  const client = getQStashClient();
  
  if (!client) {
    console.log('⚠️ QStash not configured, running synchronously');
    return { success: false, error: 'QStash not configured' };
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    const result = await client.publishJSON({
      url: `${baseUrl}/api/v2/process-analysis`,
      body: job,
      // process-analysis serviceOnlyGuard arkasında (denetim 2026-09-19): QStash bu başlığı hedefe iletir.
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || process.env.ADMIN_SECRET || ''}` },
      retries: 3,
      delay: job.priority === 'high' ? 0 : job.priority === 'normal' ? 5 : 30,
    });
    
    console.log(`📤 Job queued: ${job.homeTeam} vs ${job.awayTeam} (ID: ${result.messageId})`);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('QStash publish error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Birden fazla maç için batch analiz job'ları ekle
 */
export async function queueBatchAnalysisJobs(jobs: AnalysisJob[]): Promise<{
  queued: number;
  failed: number;
  messageIds: string[];
}> {
  const results = await Promise.all(jobs.map(job => queueAnalysisJob(job)));
  
  const queued = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const messageIds = results.filter(r => r.messageId).map(r => r.messageId!);
  
  console.log(`📤 Batch queued: ${queued} jobs, ${failed} failed`);
  
  return { queued, failed, messageIds };
}

/**
 * Günün tüm maçları için analiz job'ları oluştur
 */
export async function queueDailyAnalysis(fixtures: any[]): Promise<{
  queued: number;
  failed: number;
}> {
  const jobs: AnalysisJob[] = fixtures.map((fixture, index) => ({
    fixtureId: fixture.id || fixture.fixture_id,
    homeTeam: fixture.homeTeam || fixture.home_team,
    awayTeam: fixture.awayTeam || fixture.away_team,
    homeTeamId: fixture.homeTeamId || fixture.home_team_id,
    awayTeamId: fixture.awayTeamId || fixture.away_team_id,
    league: fixture.league,
    matchDate: fixture.date || fixture.match_date,
    // İlk 10 maç yüksek öncelikli
    priority: index < 10 ? 'high' : index < 30 ? 'normal' : 'low',
    createdAt: new Date().toISOString(),
  }));
  
  const result = await queueBatchAnalysisJobs(jobs);
  
  return { queued: result.queued, failed: result.failed };
}

// ============================================================================
// VERIFY SIGNATURE (for webhook security)
// ============================================================================

export function getQStashSigningKeys(): { currentKey: string; nextKey: string } | null {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  
  if (!currentKey || !nextKey) {
    return null;
  }
  
  return { currentKey, nextKey };
}

