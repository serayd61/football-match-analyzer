// ============================================================================
// COUNTRIES — FotMob ülke kodu (ccode, 3 harf) → bayrak emojisi + görünen ad.
// Hem server hem client kullanır (saf veri, bağımlılık yok).
// FotMob kodları ISO-3166'ya birebir uymaz (GER, NED, SUI, INT...) — bu yüzden
// küratörlü harita. Bilinmeyen kod → boş döner (yanlış bayrak göstermeyiz).
// ============================================================================

interface CountryInfo {
  flag: string; // emoji
  name: string; // görünen ad (EN — üç dilde de anlaşılır özel adlar)
}

const C: Record<string, CountryInfo> = {
  INT: { flag: '🌍', name: 'International' },
  ENG: { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England' },
  SCO: { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', name: 'Scotland' },
  WAL: { flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', name: 'Wales' },
  NIR: { flag: '🇬🇧', name: 'Northern Ireland' },
  IRL: { flag: '🇮🇪', name: 'Ireland' },
  ESP: { flag: '🇪🇸', name: 'Spain' },
  GER: { flag: '🇩🇪', name: 'Germany' },
  ITA: { flag: '🇮🇹', name: 'Italy' },
  FRA: { flag: '🇫🇷', name: 'France' },
  NED: { flag: '🇳🇱', name: 'Netherlands' },
  POR: { flag: '🇵🇹', name: 'Portugal' },
  TUR: { flag: '🇹🇷', name: 'Türkiye' },
  BEL: { flag: '🇧🇪', name: 'Belgium' },
  SUI: { flag: '🇨🇭', name: 'Switzerland' },
  AUT: { flag: '🇦🇹', name: 'Austria' },
  DEN: { flag: '🇩🇰', name: 'Denmark' },
  NOR: { flag: '🇳🇴', name: 'Norway' },
  SWE: { flag: '🇸🇪', name: 'Sweden' },
  FIN: { flag: '🇫🇮', name: 'Finland' },
  ISL: { flag: '🇮🇸', name: 'Iceland' },
  POL: { flag: '🇵🇱', name: 'Poland' },
  ROU: { flag: '🇷🇴', name: 'Romania' },
  GRE: { flag: '🇬🇷', name: 'Greece' },
  CRO: { flag: '🇭🇷', name: 'Croatia' },
  SRB: { flag: '🇷🇸', name: 'Serbia' },
  BIH: { flag: '🇧🇦', name: 'Bosnia' },
  MKD: { flag: '🇲🇰', name: 'North Macedonia' },
  ALB: { flag: '🇦🇱', name: 'Albania' },
  SVN: { flag: '🇸🇮', name: 'Slovenia' },
  SVK: { flag: '🇸🇰', name: 'Slovakia' },
  CZE: { flag: '🇨🇿', name: 'Czechia' },
  HUN: { flag: '🇭🇺', name: 'Hungary' },
  BUL: { flag: '🇧🇬', name: 'Bulgaria' },
  UKR: { flag: '🇺🇦', name: 'Ukraine' },
  RUS: { flag: '🇷🇺', name: 'Russia' },
  BLR: { flag: '🇧🇾', name: 'Belarus' },
  EST: { flag: '🇪🇪', name: 'Estonia' },
  LVA: { flag: '🇱🇻', name: 'Latvia' },
  LTU: { flag: '🇱🇹', name: 'Lithuania' },
  GEO: { flag: '🇬🇪', name: 'Georgia' },
  ARM: { flag: '🇦🇲', name: 'Armenia' },
  AZE: { flag: '🇦🇿', name: 'Azerbaijan' },
  KAZ: { flag: '🇰🇿', name: 'Kazakhstan' },
  CYP: { flag: '🇨🇾', name: 'Cyprus' },
  MLT: { flag: '🇲🇹', name: 'Malta' },
  LUX: { flag: '🇱🇺', name: 'Luxembourg' },
  FRO: { flag: '🇫🇴', name: 'Faroe Islands' },
  BRA: { flag: '🇧🇷', name: 'Brazil' },
  ARG: { flag: '🇦🇷', name: 'Argentina' },
  URU: { flag: '🇺🇾', name: 'Uruguay' },
  PAR: { flag: '🇵🇾', name: 'Paraguay' },
  CHI: { flag: '🇨🇱', name: 'Chile' },
  COL: { flag: '🇨🇴', name: 'Colombia' },
  PER: { flag: '🇵🇪', name: 'Peru' },
  ECU: { flag: '🇪🇨', name: 'Ecuador' },
  BOL: { flag: '🇧🇴', name: 'Bolivia' },
  VEN: { flag: '🇻🇪', name: 'Venezuela' },
  USA: { flag: '🇺🇸', name: 'USA' },
  MEX: { flag: '🇲🇽', name: 'Mexico' },
  CAN: { flag: '🇨🇦', name: 'Canada' },
  CRC: { flag: '🇨🇷', name: 'Costa Rica' },
  HON: { flag: '🇭🇳', name: 'Honduras' },
  GUA: { flag: '🇬🇹', name: 'Guatemala' },
  PAN: { flag: '🇵🇦', name: 'Panama' },
  JAM: { flag: '🇯🇲', name: 'Jamaica' },
  JPN: { flag: '🇯🇵', name: 'Japan' },
  KOR: { flag: '🇰🇷', name: 'South Korea' },
  CHN: { flag: '🇨🇳', name: 'China' },
  AUS: { flag: '🇦🇺', name: 'Australia' },
  NZL: { flag: '🇳🇿', name: 'New Zealand' },
  IND: { flag: '🇮🇳', name: 'India' },
  IDN: { flag: '🇮🇩', name: 'Indonesia' },
  THA: { flag: '🇹🇭', name: 'Thailand' },
  VIE: { flag: '🇻🇳', name: 'Vietnam' },
  MAS: { flag: '🇲🇾', name: 'Malaysia' },
  SGP: { flag: '🇸🇬', name: 'Singapore' },
  UZB: { flag: '🇺🇿', name: 'Uzbekistan' },
  IRN: { flag: '🇮🇷', name: 'Iran' },
  IRQ: { flag: '🇮🇶', name: 'Iraq' },
  SAU: { flag: '🇸🇦', name: 'Saudi Arabia' },
  QAT: { flag: '🇶🇦', name: 'Qatar' },
  UAE: { flag: '🇦🇪', name: 'UAE' },
  KUW: { flag: '🇰🇼', name: 'Kuwait' },
  BHR: { flag: '🇧🇭', name: 'Bahrain' },
  OMA: { flag: '🇴🇲', name: 'Oman' },
  JOR: { flag: '🇯🇴', name: 'Jordan' },
  ISR: { flag: '🇮🇱', name: 'Israel' },
  MAR: { flag: '🇲🇦', name: 'Morocco' },
  EGY: { flag: '🇪🇬', name: 'Egypt' },
  TUN: { flag: '🇹🇳', name: 'Tunisia' },
  ALG: { flag: '🇩🇿', name: 'Algeria' },
  NGA: { flag: '🇳🇬', name: 'Nigeria' },
  GHA: { flag: '🇬🇭', name: 'Ghana' },
  CIV: { flag: '🇨🇮', name: 'Ivory Coast' },
  SEN: { flag: '🇸🇳', name: 'Senegal' },
  CMR: { flag: '🇨🇲', name: 'Cameroon' },
  RSA: { flag: '🇿🇦', name: 'South Africa' },
  KEN: { flag: '🇰🇪', name: 'Kenya' },
  ETH: { flag: '🇪🇹', name: 'Ethiopia' },
  ANG: { flag: '🇦🇴', name: 'Angola' },
  COD: { flag: '🇨🇩', name: 'DR Congo' },
};

/** ccode → bilgi; bilinmeyen kod için null (yanlış bayrak göstermeyiz). */
export function countryInfo(ccode?: string | null): CountryInfo | null {
  if (!ccode) return null;
  return C[ccode.toUpperCase().trim()] || null;
}

/** "🇩🇪 Germany" tarzı kısa etiket; bilinmiyorsa boş string. */
export function countryLabel(ccode?: string | null): string {
  const c = countryInfo(ccode);
  return c ? `${c.flag} ${c.name}` : '';
}
