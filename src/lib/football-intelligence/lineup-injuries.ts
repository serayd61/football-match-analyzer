// ============================================================================
// LINEUP & INJURIES - CANLI KADRO VE SAKATLIK KONTROLÜ
// Maç öncesi kadro ve sakatlık verilerini çeker ve analiz eder
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface PlayerInfo {
  id: number;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  positionDetail: string;  // RB, CB, LB, CDM, CM, CAM, LW, RW, ST, etc.
  number: number;
  age: number;

  // Önemi
  importance: 'key' | 'starter' | 'rotation' | 'backup';
  marketValue: number;  // EUR

  // İstatistikler (sezon)
  goals: number;
  assists: number;
  minutesPlayed: number;
  appearances: number;
  yellowCards: number;
  redCards: number;

  // Form
  lastMatchRating: number;  // 0-10
  avgRating: number;
  form: 'excellent' | 'good' | 'average' | 'poor';
}

export interface InjuryInfo {
  player: PlayerInfo;
  type: 'injury' | 'suspension' | 'doubt' | 'international' | 'personal';
  reason: string;
  severity: 'out' | 'doubt' | 'minor';
  expectedReturn: string | null;
  missedMatches: number;

  // Etki Analizi
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  impactNote: string;
}

export interface LineupInfo {
  confirmed: boolean;
  formation: string;  // "4-3-3", "4-4-2", etc.

  // Kadro
  startingXI: PlayerInfo[];
  substitutes: PlayerInfo[];

  // Eksikler
  injuries: InjuryInfo[];
  suspensions: InjuryInfo[];
  doubts: InjuryInfo[];

  // Analiz
  keyPlayersOut: PlayerInfo[];
  keyPlayersDoubt: PlayerInfo[];
  rotationRisk: 'high' | 'medium' | 'low';
  squadDepth: 'excellent' | 'good' | 'average' | 'poor';

  // Genel Etki Skoru (-100 to +100, 0 = normal)
  overallImpact: number;
  impactNotes: string[];
}

export interface TeamSquadAnalysis {
  teamId: number;
  teamName: string;
  lineup: LineupInfo;

  // Tahmine Etki
  attackImpact: number;     // -50 to +50
  defenseImpact: number;    // -50 to +50
  midfieldImpact: number;   // -50 to +50
  overallStrength: number;  // 0-100

  // Tahmin Ayarlamaları
  goalScoringAdjustment: number;    // -0.5 to +0.5
  goalConcedingAdjustment: number;  // -0.5 to +0.5
  formAdjustment: number;           // -20 to +20 confidence points

  summary: string;
}

// ============================================================================
// SPORTMONKS API FUNCTIONS
// ============================================================================

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

/**
 * Maç için canlı kadro bilgisi çek (varsa)
 */
async function fetchLineupFromSportMonks(fixtureId: number): Promise<{
  homeLineup: Partial<LineupInfo> | null;
  awayLineup: Partial<LineupInfo> | null;
} | null> {
  if (!SPORTMONKS_API_KEY) {
    console.warn('SPORTMONKS_API_KEY not set for lineup fetch');
    return null;
  }

  try {
    const response = await fetch(
      `${SPORTMONKS_BASE_URL}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=lineups;formations`,
      { next: { revalidate: 300 } }  // 5 dakika cache
    );

    if (!response.ok) {
      // 404 is normal - lineups are released ~1 hour before match
      if (response.status !== 404) {
        console.warn(`⚠️ SportMonks Lineup API: ${response.status} for fixture ${fixtureId}`);
      }
      return null;
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture?.lineups || fixture.lineups.length === 0) {
      // Lineups typically released 1 hour before match - null is expected
      return null;
    }

    // Kadroları parse et
    const homeLineup: Partial<LineupInfo> = {
      confirmed: true,
      formation: fixture.formations?.find((f: any) => f.location === 'home')?.formation || '4-3-3',
      startingXI: [],
      substitutes: [],
    };

    const awayLineup: Partial<LineupInfo> = {
      confirmed: true,
      formation: fixture.formations?.find((f: any) => f.location === 'away')?.formation || '4-3-3',
      startingXI: [],
      substitutes: [],
    };

    for (const player of fixture.lineups) {
      const playerInfo: Partial<PlayerInfo> = {
        id: player.player_id,
        name: player.player_name || 'Unknown',
        position: mapPosition(player.position),
        positionDetail: player.position || '',
        number: player.jersey_number || 0,
      };

      const lineup = player.team_id === fixture.participants?.[0]?.id ? homeLineup : awayLineup;

      if (player.type_id === 11) {  // Starting XI
        lineup.startingXI?.push(playerInfo as PlayerInfo);
      } else {
        lineup.substitutes?.push(playerInfo as PlayerInfo);
      }
    }

    return { homeLineup, awayLineup };
  } catch (error) {
    console.error('Error fetching lineup from SportMonks:', error);
    return null;
  }
}

/**
 * Takım için sakatlık listesi çek
 */
async function fetchInjuriesFromSportMonks(teamId: number): Promise<InjuryInfo[]> {
  if (!SPORTMONKS_API_KEY) {
    console.warn('SPORTMONKS_API_KEY not set for injuries fetch');
    return [];
  }

  try {
    const response = await fetch(
      `${SPORTMONKS_BASE_URL}/injuries/upcoming/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=player;type`,
      { next: { revalidate: 1800 } }  // 30 dakika cache
    );

    if (!response.ok) {
      console.error(`SportMonks Injuries API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const injuries = data.data || [];

    return injuries.map((injury: any) => {
      const player: Partial<PlayerInfo> = {
        id: injury.player?.id || 0,
        name: injury.player?.display_name || injury.player?.name || 'Unknown',
        position: mapPosition(injury.player?.position?.name),
        positionDetail: injury.player?.position?.name || '',
      };

      const severity = getSeverity(injury.type?.name || '');
      const importance = getPlayerImportance(player);

      return {
        player: player as PlayerInfo,
        type: injury.type?.name?.includes('Suspension') ? 'suspension' : 'injury',
        reason: injury.type?.name || 'Unknown',
        severity,
        expectedReturn: injury.expected_return || null,
        missedMatches: injury.games_missed || 0,
        impactLevel: calculateImpactLevel(importance, severity),
        impactNote: generateImpactNote(player as PlayerInfo, severity, importance),
      } as InjuryInfo;
    });
  } catch (error) {
    console.error('Error fetching injuries from SportMonks:', error);
    return [];
  }
}

/**
 * Takım kadro derinliğini çek
 */
async function fetchSquadFromSportMonks(teamId: number): Promise<PlayerInfo[]> {
  if (!SPORTMONKS_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `${SPORTMONKS_BASE_URL}/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=players`,
      { next: { revalidate: 86400 } }  // 1 gün cache
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const players = data.data?.players || [];

    return players.map((p: any) => ({
      id: p.id,
      name: p.display_name || p.name,
      position: mapPosition(p.position?.name),
      positionDetail: p.position?.name || '',
      number: p.jersey_number || 0,
      age: p.age || 0,
      importance: 'starter',  // Sonra hesaplanacak
      marketValue: p.market_value || 0,
      goals: 0,
      assists: 0,
      minutesPlayed: 0,
      appearances: 0,
      yellowCards: 0,
      redCards: 0,
      lastMatchRating: 0,
      avgRating: 0,
      form: 'average',
    } as PlayerInfo));
  } catch (error) {
    console.error('Error fetching squad from SportMonks:', error);
    return [];
  }
}

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

function mapPosition(position: string | undefined): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (!position) return 'MID';
  const p = position.toLowerCase();

  if (p.includes('goalkeeper') || p.includes('gk') || p.includes('kaleci')) return 'GK';
  if (p.includes('defender') || p.includes('back') || p.includes('def') || p.includes('cb') || p.includes('rb') || p.includes('lb')) return 'DEF';
  if (p.includes('forward') || p.includes('striker') || p.includes('st') || p.includes('wing') || p.includes('cf') || p.includes('lw') || p.includes('rw')) return 'FWD';

  return 'MID';
}

function getSeverity(injuryType: string): 'out' | 'doubt' | 'minor' {
  const lower = injuryType.toLowerCase();

  if (lower.includes('suspension') || lower.includes('acl') || lower.includes('fracture') || lower.includes('operation')) {
    return 'out';
  }
  if (lower.includes('knock') || lower.includes('illness') || lower.includes('fitness')) {
    return 'doubt';
  }

  return 'minor';
}

function getPlayerImportance(player: Partial<PlayerInfo>): 'key' | 'starter' | 'rotation' | 'backup' {
  // Market değerine veya pozisyona göre önem belirle
  if (player.marketValue && player.marketValue > 30000000) return 'key';
  if (player.marketValue && player.marketValue > 10000000) return 'starter';
  if (player.marketValue && player.marketValue > 3000000) return 'rotation';

  // Pozisyona göre (golcüler ve kalecilar daha kritik)
  if (player.position === 'FWD' || player.position === 'GK') return 'starter';

  return 'rotation';
}

function calculateImpactLevel(
  importance: 'key' | 'starter' | 'rotation' | 'backup',
  severity: 'out' | 'doubt' | 'minor'
): 'critical' | 'high' | 'medium' | 'low' {
  if (importance === 'key' && severity === 'out') return 'critical';
  if (importance === 'key' && severity === 'doubt') return 'high';
  if (importance === 'starter' && severity === 'out') return 'high';
  if (importance === 'starter' && severity === 'doubt') return 'medium';
  if (importance === 'rotation' && severity === 'out') return 'medium';

  return 'low';
}

function generateImpactNote(
  player: PlayerInfo,
  severity: 'out' | 'doubt' | 'minor',
  importance: 'key' | 'starter' | 'rotation' | 'backup'
): string {
  const positionText = {
    'GK': 'kaleci',
    'DEF': 'defans oyuncusu',
    'MID': 'orta saha oyuncusu',
    'FWD': 'forvet',
  }[player.position];

  if (importance === 'key' && severity === 'out') {
    return `⚠️ KRİTİK: Yıldız ${positionText} ${player.name} kesin oynamıyor! Takımın gücünü ciddi etkiler.`;
  }
  if (importance === 'key' && severity === 'doubt') {
    return `⚠️ DİKKAT: Yıldız ${positionText} ${player.name} şüpheli. Son dakikaya kadar beklenmeli.`;
  }
  if (importance === 'starter' && severity === 'out') {
    return `📋 İlk 11 ${positionText} ${player.name} yok. Yedeği yeterli mi kontrol edilmeli.`;
  }

  return `ℹ️ ${player.name} (${positionText}) ${severity === 'out' ? 'yok' : 'şüpheli'}.`;
}

// ============================================================================
// ETKİ HESAPLAMALARI
// ============================================================================

/**
 * Eksik oyuncuların toplam etkisini hesapla
 */
function calculateOverallImpact(injuries: InjuryInfo[]): {
  attackImpact: number;
  defenseImpact: number;
  midfieldImpact: number;
  overall: number;
  notes: string[];
} {
  let attackImpact = 0;
  let defenseImpact = 0;
  let midfieldImpact = 0;
  const notes: string[] = [];

  for (const injury of injuries) {
    if (injury.severity === 'minor') continue;

    const impactMultiplier = injury.severity === 'out' ? 1.0 : 0.5;
    const importanceMultiplier = {
      'key': 25,
      'starter': 15,
      'rotation': 8,
      'backup': 3,
    }[injury.player.importance];

    const impact = impactMultiplier * importanceMultiplier;

    switch (injury.player.position) {
      case 'FWD':
        attackImpact -= impact;
        break;
      case 'DEF':
      case 'GK':
        defenseImpact -= impact;
        break;
      case 'MID':
        midfieldImpact -= impact * 0.5;
        attackImpact -= impact * 0.25;
        defenseImpact -= impact * 0.25;
        break;
    }

    if (injury.impactLevel === 'critical' || injury.impactLevel === 'high') {
      notes.push(injury.impactNote);
    }
  }

  // Sınırla
  attackImpact = Math.max(-50, Math.min(0, attackImpact));
  defenseImpact = Math.max(-50, Math.min(0, defenseImpact));
  midfieldImpact = Math.max(-50, Math.min(0, midfieldImpact));

  const overall = Math.round((attackImpact + defenseImpact + midfieldImpact) / 3);

  return { attackImpact, defenseImpact, midfieldImpact, overall, notes };
}

/**
 * Rotasyon riskini değerlendir
 */
function assessRotationRisk(
  daysUntilNextMatch: number,
  competitionImportance: number,  // 1-10
  recentMatchDensity: number      // Maç sayısı son 7 gün
): 'high' | 'medium' | 'low' {
  // Yoğun fikstür + düşük önemli maç = yüksek rotasyon riski
  if (recentMatchDensity >= 2 && competitionImportance <= 5) return 'high';
  if (recentMatchDensity >= 2 && competitionImportance <= 7) return 'medium';
  if (daysUntilNextMatch <= 3 && competitionImportance <= 6) return 'medium';

  return 'low';
}

// ============================================================================
// ANA FONKSİYON
// ============================================================================

/**
 * Takım kadro analizi yap
 */
export async function analyzeTeamSquad(
  teamId: number,
  teamName: string,
  fixtureId: number,
  options?: {
    daysUntilNextMatch?: number;
    competitionImportance?: number;
    recentMatchDensity?: number;
  }
): Promise<TeamSquadAnalysis> {
  // Paralel olarak tüm verileri çek
  const [injuries, squad, lineupData] = await Promise.all([
    fetchInjuriesFromSportMonks(teamId),
    fetchSquadFromSportMonks(teamId),
    fetchLineupFromSportMonks(fixtureId),
  ]);

  // Sakatlıkları filtrele (out ve doubt)
  const activeInjuries = injuries.filter(i => i.severity !== 'minor');
  const keyPlayersOut = activeInjuries
    .filter(i => i.severity === 'out' && (i.player.importance === 'key' || i.player.importance === 'starter'))
    .map(i => i.player);
  const keyPlayersDoubt = activeInjuries
    .filter(i => i.severity === 'doubt' && (i.player.importance === 'key' || i.player.importance === 'starter'))
    .map(i => i.player);

  // Etki hesapla
  const impact = calculateOverallImpact(activeInjuries);

  // Rotasyon riski
  const rotationRisk = assessRotationRisk(
    options?.daysUntilNextMatch || 7,
    options?.competitionImportance || 8,
    options?.recentMatchDensity || 1
  );

  // Kadro derinliği
  let squadDepth: 'excellent' | 'good' | 'average' | 'poor' = 'average';
  if (squad.length >= 28) squadDepth = 'excellent';
  else if (squad.length >= 24) squadDepth = 'good';
  else if (squad.length >= 20) squadDepth = 'average';
  else squadDepth = 'poor';

  // Lineup bilgisi
  const lineup: LineupInfo = {
    confirmed: lineupData?.homeLineup?.confirmed || lineupData?.awayLineup?.confirmed || false,
    formation: lineupData?.homeLineup?.formation || lineupData?.awayLineup?.formation || '4-3-3',
    startingXI: lineupData?.homeLineup?.startingXI || lineupData?.awayLineup?.startingXI || [],
    substitutes: lineupData?.homeLineup?.substitutes || lineupData?.awayLineup?.substitutes || [],
    injuries: injuries.filter(i => i.type === 'injury'),
    suspensions: injuries.filter(i => i.type === 'suspension'),
    doubts: injuries.filter(i => i.severity === 'doubt'),
    keyPlayersOut,
    keyPlayersDoubt,
    rotationRisk,
    squadDepth,
    overallImpact: impact.overall,
    impactNotes: impact.notes,
  };

  // Tahmin ayarlamaları hesapla
  const goalScoringAdjustment = impact.attackImpact / 100;  // -0.5 to 0
  const goalConcedingAdjustment = Math.abs(impact.defenseImpact) / 100;  // 0 to 0.5 (savunma zayıfsa rakip daha fazla atar)

  // Form ayarlaması (güven puanını etkiler)
  let formAdjustment = 0;
  if (keyPlayersOut.length >= 2) formAdjustment = -15;
  else if (keyPlayersOut.length >= 1) formAdjustment = -10;
  if (keyPlayersDoubt.length >= 2) formAdjustment -= 5;
  if (rotationRisk === 'high') formAdjustment -= 8;

  // Genel güç hesapla
  let overallStrength = 75;  // Baz değer
  overallStrength += impact.overall;
  if (squadDepth === 'excellent') overallStrength += 5;
  else if (squadDepth === 'poor') overallStrength -= 5;
  overallStrength = Math.max(30, Math.min(100, overallStrength));

  // Özet oluştur
  let summary = '';
  if (keyPlayersOut.length === 0 && keyPlayersDoubt.length === 0) {
    summary = `✅ ${teamName} tam kadro. Eksik önemli oyuncu yok.`;
  } else if (keyPlayersOut.length >= 2) {
    summary = `⚠️ ${teamName} ciddi eksiklerle! ${keyPlayersOut.map(p => p.name).join(', ')} yok.`;
  } else if (keyPlayersOut.length === 1) {
    summary = `📋 ${teamName}: ${keyPlayersOut[0].name} yok. ${keyPlayersDoubt.length > 0 ? `${keyPlayersDoubt.map(p => p.name).join(', ')} şüpheli.` : ''}`;
  } else if (keyPlayersDoubt.length > 0) {
    summary = `❓ ${teamName}: ${keyPlayersDoubt.map(p => p.name).join(', ')} şüpheli. Son dakikaya kadar beklenmeli.`;
  }

  if (rotationRisk === 'high') {
    summary += ' ⚡ Yüksek rotasyon riski!';
  }

  return {
    teamId,
    teamName,
    lineup,
    attackImpact: impact.attackImpact,
    defenseImpact: impact.defenseImpact,
    midfieldImpact: impact.midfieldImpact,
    overallStrength,
    goalScoringAdjustment: parseFloat(goalScoringAdjustment.toFixed(2)),
    goalConcedingAdjustment: parseFloat(goalConcedingAdjustment.toFixed(2)),
    formAdjustment,
    summary,
  };
}

/**
 * Maç için her iki takımın kadro analizini yap
 */
export async function analyzeMatchSquads(
  fixtureId: number,
  homeTeamId: number,
  homeTeamName: string,
  awayTeamId: number,
  awayTeamName: string,
  options?: {
    daysUntilNextMatch?: number;
    competitionImportance?: number;
    recentMatchDensity?: number;
  }
): Promise<{
  home: TeamSquadAnalysis;
  away: TeamSquadAnalysis;
  comparison: {
    strengthDifference: number;  // + = home stronger
    injuryAdvantage: 'home' | 'away' | 'equal';
    notes: string[];
  };
}> {
  const [home, away] = await Promise.all([
    analyzeTeamSquad(homeTeamId, homeTeamName, fixtureId, options),
    analyzeTeamSquad(awayTeamId, awayTeamName, fixtureId, options),
  ]);

  const strengthDifference = home.overallStrength - away.overallStrength;

  let injuryAdvantage: 'home' | 'away' | 'equal';
  if (home.lineup.overallImpact > away.lineup.overallImpact + 10) {
    injuryAdvantage = 'home';
  } else if (away.lineup.overallImpact > home.lineup.overallImpact + 10) {
    injuryAdvantage = 'away';
  } else {
    injuryAdvantage = 'equal';
  }

  const notes: string[] = [
    ...home.lineup.impactNotes,
    ...away.lineup.impactNotes,
  ];

  if (strengthDifference > 15) {
    notes.push(`${homeTeamName} kadro olarak önemli ölçüde güçlü.`);
  } else if (strengthDifference < -15) {
    notes.push(`${awayTeamName} kadro olarak önemli ölçüde güçlü.`);
  }

  return {
    home,
    away,
    comparison: {
      strengthDifference,
      injuryAdvantage,
      notes,
    },
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  fetchInjuriesFromSportMonks,
  fetchSquadFromSportMonks,
  fetchLineupFromSportMonks,
};

