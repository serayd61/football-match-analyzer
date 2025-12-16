// ============================================================================
// WEATHER IMPACT - HAVA DURUMU ETKİSİ
// Hava koşullarının maç sonuçlarına etkisini analiz eder
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface WeatherData {
  // Temel Bilgiler
  temperature: number;        // Celsius
  feelsLike: number;         // Hissedilen sıcaklık
  humidity: number;          // % nem
  
  // Yağış
  precipitation: {
    type: 'none' | 'rain' | 'snow' | 'drizzle' | 'storm';
    probability: number;     // % olasılık
    intensity: 'light' | 'moderate' | 'heavy' | 'none';
    mmExpected: number;      // Beklenen yağış miktarı
  };
  
  // Rüzgar
  wind: {
    speed: number;           // km/h
    direction: string;       // NW, SE, etc.
    gusts: number;           // Rüzgar hamlesi km/h
    intensity: 'calm' | 'light' | 'moderate' | 'strong' | 'severe';
  };
  
  // Görüş
  visibility: number;        // km
  cloudCover: number;        // % bulut örtüsü
  
  // Genel Durum
  condition: 'clear' | 'cloudy' | 'overcast' | 'rainy' | 'snowy' | 'foggy' | 'stormy';
  uvIndex: number;
  
  // Zaman
  isNightMatch: boolean;
  sunset: string;
  matchTime: string;
}

export interface WeatherImpactAnalysis {
  weather: WeatherData;
  
  // Genel Etki Değerlendirmesi
  overallImpact: 'significant' | 'moderate' | 'minimal' | 'none';
  impactScore: number;       // -100 to +100 (negatif = golü azaltır)
  
  // Gol Etkisi
  goalImpact: {
    adjustment: number;      // -0.5 to +0.5 gol
    direction: 'reduces' | 'increases' | 'neutral';
    reasoning: string;
  };
  
  // Over/Under Etkisi
  overUnderImpact: {
    bias: 'under' | 'over' | 'neutral';
    confidenceAdjustment: number;  // -15 to +15
    reasoning: string;
  };
  
  // Oyun Tarzı Etkisi
  playStyleImpact: {
    favorsDirect: boolean;   // Uzun top, fiziksel oyun
    favorsTechnical: boolean; // Kısa pas, teknik oyun
    reasoning: string;
  };
  
  // Takım Bazlı Etki
  homeAdvantageModifier: number;  // -20 to +20
  
  // Uyarılar ve Notlar
  warnings: string[];
  notes: string[];
}

// ============================================================================
// STADYUM VERİLERİ
// ============================================================================

interface StadiumInfo {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity: number;
  roofType: 'open' | 'partial' | 'closed' | 'retractable';
  altitude: number;  // Metre (yüksek irtifa etkisi)
}

// Bazı önemli stadyumlar (API'den gelmezse fallback)
const KNOWN_STADIUMS: { [key: string]: StadiumInfo } = {
  // Türkiye
  'Ali Sami Yen': { name: 'NEF Stadyumu', city: 'İstanbul', country: 'Turkey', latitude: 41.103, longitude: 28.991, capacity: 52280, roofType: 'open', altitude: 50 },
  'Şükrü Saracoğlu': { name: 'Şükrü Saracoğlu', city: 'İstanbul', country: 'Turkey', latitude: 40.988, longitude: 29.037, capacity: 50509, roofType: 'open', altitude: 10 },
  'Vodafone Park': { name: 'Vodafone Park', city: 'İstanbul', country: 'Turkey', latitude: 41.039, longitude: 29.007, capacity: 42590, roofType: 'partial', altitude: 30 },
  
  // İngiltere
  'Old Trafford': { name: 'Old Trafford', city: 'Manchester', country: 'England', latitude: 53.463, longitude: -2.291, capacity: 74310, roofType: 'partial', altitude: 40 },
  'Anfield': { name: 'Anfield', city: 'Liverpool', country: 'England', latitude: 53.431, longitude: -2.961, capacity: 61276, roofType: 'partial', altitude: 10 },
  'Emirates': { name: 'Emirates Stadium', city: 'London', country: 'England', latitude: 51.555, longitude: -0.108, capacity: 60704, roofType: 'partial', altitude: 50 },
  
  // İspanya
  'Santiago Bernabeu': { name: 'Santiago Bernabéu', city: 'Madrid', country: 'Spain', latitude: 40.453, longitude: -3.688, capacity: 81044, roofType: 'retractable', altitude: 650 },
  'Camp Nou': { name: 'Camp Nou', city: 'Barcelona', country: 'Spain', latitude: 41.381, longitude: 2.123, capacity: 99354, roofType: 'open', altitude: 50 },
  
  // Almanya
  'Allianz Arena': { name: 'Allianz Arena', city: 'Munich', country: 'Germany', latitude: 48.219, longitude: 11.625, capacity: 75024, roofType: 'closed', altitude: 520 },
  'Signal Iduna Park': { name: 'Signal Iduna Park', city: 'Dortmund', country: 'Germany', latitude: 51.493, longitude: 7.452, capacity: 81365, roofType: 'partial', altitude: 90 },
};

// ============================================================================
// HAVA DURUMU API'LERİ
// ============================================================================

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * OpenWeatherMap'ten hava durumu verisi çek
 */
async function fetchWeatherFromOpenWeather(
  latitude: number,
  longitude: number,
  matchTimeUnix: number
): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.warn('OPENWEATHER_API_KEY not set');
    return null;
  }
  
  try {
    // 5 günlük tahmin (3 saatlik aralıklarla)
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`,
      { next: { revalidate: 1800 } }  // 30 dakika cache
    );
    
    if (!response.ok) {
      console.error(`OpenWeather API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const forecasts = data.list || [];
    
    // Maç zamanına en yakın tahmini bul
    let closestForecast = forecasts[0];
    let closestDiff = Math.abs(forecasts[0].dt - matchTimeUnix);
    
    for (const forecast of forecasts) {
      const diff = Math.abs(forecast.dt - matchTimeUnix);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestForecast = forecast;
      }
    }
    
    if (!closestForecast) return null;
    
    // Verileri parse et
    const temp = closestForecast.main?.temp || 20;
    const feelsLike = closestForecast.main?.feels_like || temp;
    const humidity = closestForecast.main?.humidity || 50;
    const windSpeed = (closestForecast.wind?.speed || 0) * 3.6;  // m/s to km/h
    const windGusts = (closestForecast.wind?.gust || windSpeed) * 3.6;
    const cloudCover = closestForecast.clouds?.all || 0;
    const visibility = (closestForecast.visibility || 10000) / 1000;  // metre to km
    
    // Yağış kontrolü
    const weatherMain = closestForecast.weather?.[0]?.main?.toLowerCase() || 'clear';
    const rainAmount = closestForecast.rain?.['3h'] || 0;
    const snowAmount = closestForecast.snow?.['3h'] || 0;
    
    let precipType: WeatherData['precipitation']['type'] = 'none';
    let precipIntensity: WeatherData['precipitation']['intensity'] = 'none';
    let mmExpected = 0;
    
    if (snowAmount > 0) {
      precipType = 'snow';
      mmExpected = snowAmount;
    } else if (rainAmount > 0 || weatherMain.includes('rain')) {
      precipType = rainAmount > 5 ? 'rain' : 'drizzle';
      mmExpected = rainAmount;
    } else if (weatherMain.includes('thunder') || weatherMain.includes('storm')) {
      precipType = 'storm';
    }
    
    if (mmExpected > 10) precipIntensity = 'heavy';
    else if (mmExpected > 3) precipIntensity = 'moderate';
    else if (mmExpected > 0) precipIntensity = 'light';
    
    // Rüzgar yoğunluğu
    let windIntensity: WeatherData['wind']['intensity'] = 'calm';
    if (windSpeed > 50) windIntensity = 'severe';
    else if (windSpeed > 35) windIntensity = 'strong';
    else if (windSpeed > 20) windIntensity = 'moderate';
    else if (windSpeed > 10) windIntensity = 'light';
    
    // Genel durum
    let condition: WeatherData['condition'] = 'clear';
    if (precipType === 'storm') condition = 'stormy';
    else if (precipType === 'snow') condition = 'snowy';
    else if (precipType === 'rain' || precipType === 'drizzle') condition = 'rainy';
    else if (visibility < 1) condition = 'foggy';
    else if (cloudCover > 80) condition = 'overcast';
    else if (cloudCover > 40) condition = 'cloudy';
    
    // Maç saati kontrolü
    const matchDate = new Date(matchTimeUnix * 1000);
    const isNightMatch = matchDate.getHours() >= 18 || matchDate.getHours() < 6;
    
    return {
      temperature: Math.round(temp),
      feelsLike: Math.round(feelsLike),
      humidity,
      precipitation: {
        type: precipType,
        probability: closestForecast.pop ? closestForecast.pop * 100 : 0,
        intensity: precipIntensity,
        mmExpected: parseFloat(mmExpected.toFixed(1)),
      },
      wind: {
        speed: Math.round(windSpeed),
        direction: getWindDirection(closestForecast.wind?.deg || 0),
        gusts: Math.round(windGusts),
        intensity: windIntensity,
      },
      visibility,
      cloudCover,
      condition,
      uvIndex: 0,  // API'den gelmiyor
      isNightMatch,
      sunset: data.city?.sunset ? new Date(data.city.sunset * 1000).toLocaleTimeString() : '',
      matchTime: matchDate.toLocaleTimeString(),
    };
  } catch (error) {
    console.error('Error fetching weather from OpenWeather:', error);
    return null;
  }
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// ============================================================================
// ETKİ ANALİZİ
// ============================================================================

/**
 * Hava durumunun maça etkisini analiz et
 */
export function analyzeWeatherImpact(
  weather: WeatherData,
  stadiumRoofType: 'open' | 'partial' | 'closed' | 'retractable' = 'open',
  homeTeamStyle: 'technical' | 'physical' | 'balanced' = 'balanced',
  awayTeamStyle: 'technical' | 'physical' | 'balanced' = 'balanced'
): WeatherImpactAnalysis {
  const warnings: string[] = [];
  const notes: string[] = [];
  
  let impactScore = 0;
  let goalAdjustment = 0;
  let overUnderBias: 'under' | 'over' | 'neutral' = 'neutral';
  let overUnderConfAdj = 0;
  let favorsDirect = false;
  let favorsTechnical = true;
  let homeAdvantageModifier = 0;
  
  // Kapalı stadyum - hava durumu etkisi minimal
  if (stadiumRoofType === 'closed') {
    return {
      weather,
      overallImpact: 'none',
      impactScore: 0,
      goalImpact: {
        adjustment: 0,
        direction: 'neutral',
        reasoning: 'Kapalı stadyum, hava koşulları etkisiz.',
      },
      overUnderImpact: {
        bias: 'neutral',
        confidenceAdjustment: 0,
        reasoning: 'Kapalı stadyum.',
      },
      playStyleImpact: {
        favorsDirect: false,
        favorsTechnical: true,
        reasoning: 'Kontrollü ortam, teknik oyun avantajlı.',
      },
      homeAdvantageModifier: 0,
      warnings: [],
      notes: ['Kapalı stadyum - hava koşulları maçı etkilemez.'],
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SICAKLIK ETKİSİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (weather.temperature > 32) {
    impactScore -= 20;
    goalAdjustment -= 0.2;
    warnings.push('⚠️ Aşırı sıcak! Oyuncular yorgunluğa daha çabuk düşer.');
    notes.push(`Sıcaklık: ${weather.temperature}°C - İkinci yarıda tempo düşebilir.`);
    overUnderBias = 'under';
    overUnderConfAdj = -5;
  } else if (weather.temperature > 28) {
    impactScore -= 10;
    goalAdjustment -= 0.1;
    notes.push(`Sıcak hava (${weather.temperature}°C) - Biraz tempo kaybı olabilir.`);
  } else if (weather.temperature < 5) {
    impactScore -= 15;
    goalAdjustment -= 0.15;
    notes.push(`Soğuk hava (${weather.temperature}°C) - Top kontrolü zorlaşabilir.`);
    favorsDirect = true;
  } else if (weather.temperature < 0) {
    impactScore -= 25;
    goalAdjustment -= 0.25;
    warnings.push('❄️ Dondurucu soğuk! Saha koşulları zorlaşır.');
    overUnderBias = 'under';
    overUnderConfAdj = -8;
    favorsDirect = true;
    favorsTechnical = false;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // YAĞIŞ ETKİSİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (weather.precipitation.type === 'storm') {
    impactScore -= 40;
    goalAdjustment -= 0.4;
    warnings.push('⛈️ FIRTINA UYARISI! Maç ertelenebilir veya çok zor koşullarda oynanır.');
    overUnderBias = 'under';
    overUnderConfAdj = -15;
    favorsDirect = true;
    favorsTechnical = false;
  } else if (weather.precipitation.type === 'snow' && weather.precipitation.intensity !== 'none') {
    impactScore -= 35;
    goalAdjustment -= 0.35;
    warnings.push('🌨️ Kar yağışı! Top kontrolü ve şut isabeti düşer.');
    overUnderBias = 'under';
    overUnderConfAdj = -12;
    favorsDirect = true;
  } else if (weather.precipitation.type === 'rain') {
    if (weather.precipitation.intensity === 'heavy') {
      impactScore -= 30;
      goalAdjustment -= 0.3;
      warnings.push('🌧️ Yoğun yağmur! Kaygan saha, hatalı paslar artabilir.');
      overUnderBias = 'under';
      overUnderConfAdj = -10;
      favorsDirect = true;
    } else if (weather.precipitation.intensity === 'moderate') {
      impactScore -= 15;
      goalAdjustment -= 0.15;
      notes.push('🌧️ Orta şiddette yağmur - Top kontrolü zorlaşabilir.');
      overUnderConfAdj = -5;
    } else {
      impactScore -= 5;
      notes.push('💧 Hafif yağmur - Minimal etki bekleniyor.');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RÜZGAR ETKİSİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (weather.wind.intensity === 'severe') {
    impactScore -= 35;
    goalAdjustment -= 0.3;
    warnings.push('💨 ÇOK GÜÇLÜ RÜZGAR! Uzun paslar ve şutlar etkilenir.');
    overUnderBias = 'under';
    overUnderConfAdj = -12;
    favorsDirect = false;  // Uzun toplar etkisiz
    homeAdvantageModifier = 10;  // Ev sahibi rüzgarı kullanmayı bilir
  } else if (weather.wind.intensity === 'strong') {
    impactScore -= 20;
    goalAdjustment -= 0.2;
    notes.push(`💨 Güçlü rüzgar (${weather.wind.speed} km/h) - Top uçuşları etkilenir.`);
    overUnderConfAdj = -7;
    homeAdvantageModifier = 5;
  } else if (weather.wind.intensity === 'moderate') {
    impactScore -= 10;
    notes.push(`Orta şiddette rüzgar (${weather.wind.speed} km/h) - Hafif etki.`);
    overUnderConfAdj = -3;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GÖRÜŞ ETKİSİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (weather.visibility < 0.5) {
    impactScore -= 30;
    warnings.push('🌫️ ÇOK DÜŞÜK GÖRÜŞ! Maç ertelenebilir.');
    overUnderBias = 'under';
    overUnderConfAdj = -10;
  } else if (weather.visibility < 1) {
    impactScore -= 15;
    warnings.push('🌫️ Sisli ortam - Uzun paslar ve şutlar zorlaşır.');
    overUnderConfAdj = -5;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TAKIM TARZI ETKİSİ
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (favorsDirect && !favorsTechnical) {
    // Kötü hava = fiziksel takımlar avantajlı
    if (homeTeamStyle === 'physical' && awayTeamStyle === 'technical') {
      homeAdvantageModifier += 10;
      notes.push('Hava koşulları ev sahibinin fiziksel tarzına uygun.');
    } else if (awayTeamStyle === 'physical' && homeTeamStyle === 'technical') {
      homeAdvantageModifier -= 10;
      notes.push('Hava koşulları deplasmanın fiziksel tarzına uygun.');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SONUÇLAR
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Genel etki seviyesi
  let overallImpact: WeatherImpactAnalysis['overallImpact'];
  if (Math.abs(impactScore) >= 30) overallImpact = 'significant';
  else if (Math.abs(impactScore) >= 15) overallImpact = 'moderate';
  else if (Math.abs(impactScore) >= 5) overallImpact = 'minimal';
  else overallImpact = 'none';
  
  // Gol etkisi yönü
  let goalDirection: WeatherImpactAnalysis['goalImpact']['direction'];
  if (goalAdjustment < -0.1) goalDirection = 'reduces';
  else if (goalAdjustment > 0.1) goalDirection = 'increases';
  else goalDirection = 'neutral';
  
  // Reasoning'ler oluştur
  let goalReasoning = '';
  if (goalDirection === 'reduces') {
    goalReasoning = `Hava koşulları gol üretimini zorlaştırıyor. Beklenen gol düşüşü: ${Math.abs(goalAdjustment).toFixed(2)}.`;
  } else if (goalDirection === 'neutral') {
    goalReasoning = 'Hava koşulları gol üretimini önemli ölçüde etkilemiyor.';
  } else {
    goalReasoning = 'Hava koşulları gol üretimini artırabilir.';
  }
  
  let overUnderReasoning = '';
  if (overUnderBias === 'under') {
    overUnderReasoning = 'Kötü hava koşulları Under bahislerini destekliyor.';
  } else if (overUnderBias === 'neutral') {
    overUnderReasoning = 'Hava koşulları Over/Under tahminini önemli ölçüde etkilemiyor.';
  } else {
    overUnderReasoning = 'Hava koşulları Over bahislerini destekliyor.';
  }
  
  let playStyleReasoning = '';
  if (favorsDirect && !favorsTechnical) {
    playStyleReasoning = 'Kötü hava koşulları uzun top ve fiziksel oyunu avantajlı kılıyor.';
  } else if (favorsTechnical) {
    playStyleReasoning = 'İyi hava koşulları teknik ve kısa pas oyununu destekliyor.';
  } else {
    playStyleReasoning = 'Hava koşulları oyun tarzını önemli ölçüde etkilemiyor.';
  }
  
  return {
    weather,
    overallImpact,
    impactScore,
    goalImpact: {
      adjustment: parseFloat(goalAdjustment.toFixed(2)),
      direction: goalDirection,
      reasoning: goalReasoning,
    },
    overUnderImpact: {
      bias: overUnderBias,
      confidenceAdjustment: overUnderConfAdj,
      reasoning: overUnderReasoning,
    },
    playStyleImpact: {
      favorsDirect,
      favorsTechnical,
      reasoning: playStyleReasoning,
    },
    homeAdvantageModifier,
    warnings,
    notes,
  };
}

// ============================================================================
// ANA FONKSİYON
// ============================================================================

/**
 * Maç için hava durumu analizini al
 */
export async function getMatchWeatherAnalysis(
  stadiumName: string,
  matchTimeUnix: number,
  homeTeamStyle: 'technical' | 'physical' | 'balanced' = 'balanced',
  awayTeamStyle: 'technical' | 'physical' | 'balanced' = 'balanced',
  manualCoords?: { latitude: number; longitude: number }
): Promise<WeatherImpactAnalysis | null> {
  // Stadyum bilgisini bul
  let stadium = KNOWN_STADIUMS[stadiumName];
  let latitude: number;
  let longitude: number;
  let roofType: 'open' | 'partial' | 'closed' | 'retractable' = 'open';
  
  if (stadium) {
    latitude = stadium.latitude;
    longitude = stadium.longitude;
    roofType = stadium.roofType;
  } else if (manualCoords) {
    latitude = manualCoords.latitude;
    longitude = manualCoords.longitude;
  } else {
    console.warn(`Stadium "${stadiumName}" not found and no manual coords provided`);
    return null;
  }
  
  // Hava durumu verisi çek
  const weather = await fetchWeatherFromOpenWeather(latitude, longitude, matchTimeUnix);
  
  if (!weather) {
    return null;
  }
  
  // Etki analizi yap
  return analyzeWeatherImpact(weather, roofType, homeTeamStyle, awayTeamStyle);
}

/**
 * Hava durumu verilerini tahmine uygula
 */
export function applyWeatherAdjustments(
  prediction: {
    overUnder: string;
    overUnderConfidence: number;
    expectedGoals: number;
    matchResult: string;
    matchResultConfidence: number;
  },
  weatherImpact: WeatherImpactAnalysis
): typeof prediction & {
  weatherNote: string;
  weatherAdjusted: boolean;
} {
  const adjusted = { ...prediction };
  
  // Gol beklentisi ayarla
  adjusted.expectedGoals = Math.max(0.5, adjusted.expectedGoals + weatherImpact.goalImpact.adjustment);
  
  // Over/Under güven ayarla
  if (weatherImpact.overUnderImpact.bias === 'under') {
    if (adjusted.overUnder === 'Under') {
      adjusted.overUnderConfidence += Math.abs(weatherImpact.overUnderImpact.confidenceAdjustment);
    } else {
      adjusted.overUnderConfidence -= Math.abs(weatherImpact.overUnderImpact.confidenceAdjustment);
      
      // Güven çok düştüyse tahmini değiştir
      if (adjusted.overUnderConfidence < 50) {
        adjusted.overUnder = 'Under';
        adjusted.overUnderConfidence = 55;
      }
    }
  }
  
  // Ev sahibi avantajı ayarla
  if (weatherImpact.homeAdvantageModifier > 5) {
    if (adjusted.matchResult === '1') {
      adjusted.matchResultConfidence += weatherImpact.homeAdvantageModifier / 2;
    } else if (adjusted.matchResult === '2') {
      adjusted.matchResultConfidence -= weatherImpact.homeAdvantageModifier / 3;
    }
  }
  
  // Sınırla
  adjusted.overUnderConfidence = Math.max(45, Math.min(85, adjusted.overUnderConfidence));
  adjusted.matchResultConfidence = Math.max(45, Math.min(85, adjusted.matchResultConfidence));
  
  // Hava durumu notu
  let weatherNote = '';
  if (weatherImpact.overallImpact === 'significant') {
    weatherNote = `🌦️ HAVA ETKİSİ: ${weatherImpact.warnings.join(' ')}`;
  } else if (weatherImpact.overallImpact === 'moderate') {
    weatherNote = `🌤️ Hava: ${weatherImpact.notes[0] || 'Orta seviye etki'}`;
  } else {
    weatherNote = '☀️ Hava koşulları normal, önemli etki yok.';
  }
  
  return {
    ...adjusted,
    weatherNote,
    weatherAdjusted: weatherImpact.overallImpact !== 'none',
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export { fetchWeatherFromOpenWeather };

