// ============================================================================
// FREE FOOTBALL PROVIDER (Free API Live Football Data / FotMob)
// DataProvider arayüzü. Şu an fikstür/sonuç doğrulandı; takım istatistiği,
// H2H, oran vb. zenginleştirme endpoint'leri eklenince doldurulacak (graceful null).
// ============================================================================

import {
  DataProvider, FixtureData, TeamStats, MatchData, Injury,
  H2HData, OddsData, RefereeData, LineupData, XGData,
} from './types';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';

function mapStatus(m: FFMatch): FixtureData['status'] {
  if (m.cancelled) return 'postponed';
  if (m.finished) return 'finished';
  if (m.started) return 'live';
  return 'scheduled';
}

function toFixtureData(m: FFMatch): FixtureData {
  return {
    fixtureId: m.id,
    homeTeam: { id: m.homeId, name: m.homeName },
    awayTeam: { id: m.awayId, name: m.awayName },
    league: { id: m.leagueId, name: m.leagueName },
    date: m.utcTime,
    status: mapStatus(m),
    score:
      m.homeScore != null && m.awayScore != null
        ? { home: m.homeScore, away: m.awayScore }
        : undefined,
  };
}

export class FreeFootballProvider implements DataProvider {
  name = 'FreeFootball';
  priority = 1; // birincil

  async getFixturesByDate(date: string, leagueId?: number): Promise<FixtureData[]> {
    const matches = await getMatchesByDate(date);
    const mapped = matches.map(toFixtureData);
    return leagueId ? mapped.filter(f => f.league.id === leagueId) : mapped;
  }

  // Tek maçı tarih olmadan çekmek bu API'de mümkün değil → null (kullanan yerler null'a dayanıklı)
  async getFixture(_fixtureId: number): Promise<FixtureData | null> {
    return null;
  }

  // --- Zenginleştirme: endpoint'ler eklenene kadar graceful boş ---
  async getTeamStats(_teamId: number): Promise<TeamStats | null> { return null; }
  async getTeamRecentMatches(_teamId: number, _limit?: number): Promise<MatchData[]> { return []; }
  async getTeamInjuries(_teamId: number): Promise<Injury[]> { return []; }
  async getHeadToHead(_homeTeamId: number, _awayTeamId: number): Promise<H2HData | null> { return null; }
  async getPreMatchOdds(_fixtureId: number): Promise<OddsData | null> { return null; }
  async getReferee(_fixtureId: number): Promise<RefereeData | null> { return null; }
  async getLineup(_fixtureId: number): Promise<LineupData | null> { return null; }
  async getTeamXG(_teamId: number): Promise<XGData | null> { return null; }
}
