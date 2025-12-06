import { MatchData } from '../types';

// Scout agent artık AI kullanmıyor - sadece mevcut veriyi özetliyor
export async function runScoutAgent(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): Promise<any> {
  // Sportmonks'ta haber/sakatlık verisi yok, bu yüzden AI çağırmıyoruz
  // Sadece form verisinden çıkarım yapıyoruz
  
  const homeForm = matchData.homeForm?.form || 'N/A';
  const awayForm = matchData.awayForm?.form || 'N/A';
  
  const homeWins = (homeForm.match(/W/g) || []).length;
  const homeLosses = (homeForm.match(/L/g) || []).length;
  const awayWins = (awayForm.match(/W/g) || []).length;
  const awayLosses = (awayForm.match(/L/g) || []).length;

  const messages: Record<string, any> = {
    tr: {
      summary: `${matchData.homeTeam} son 5 maçta ${homeWins} galibiyet, ${matchData.awayTeam} ise ${awayWins} galibiyet aldı.`,
      homeStatus: homeWins >= 3 ? 'İyi formda' : (homeLosses >= 3 ? 'Kötü formda' : 'Değişken form'),
      awayStatus: awayWins >= 3 ? 'İyi formda' : (awayLosses >= 3 ? 'Kötü formda' : 'Değişken form'),
    },
    en: {
      summary: `${matchData.homeTeam} has ${homeWins} wins in last 5, ${matchData.awayTeam} has ${awayWins} wins.`,
      homeStatus: homeWins >= 3 ? 'Good form' : (homeLosses >= 3 ? 'Poor form' : 'Mixed form'),
      awayStatus: awayWins >= 3 ? 'Good form' : (awayLosses >= 3 ? 'Poor form' : 'Mixed form'),
    },
    de: {
      summary: `${matchData.homeTeam}: ${homeWins} Siege, ${matchData.awayTeam}: ${awayWins} Siege.`,
      homeStatus: homeWins >= 3 ? 'Gute Form' : 'Gemischte Form',
      awayStatus: awayWins >= 3 ? 'Gute Form' : 'Gemischte Form',
    },
  };

  const msg = messages[language] || messages.en;

  return {
    summary: msg.summary,
    homeTeamStatus: msg.homeStatus,
    awayTeamStatus: msg.awayStatus,
    injuries: [], // Veri yok
    suspensions: [], // Veri yok
    news: [], // Veri yok
    weather: null,
    note: language === 'tr' ? 'Sakatlık ve haber verisi mevcut değil' : 'Injury and news data not available',
  };
}
