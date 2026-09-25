// ============================================================================
// Ülke adı — FIFA/FotMob üç harfli kodu (ENG, GER, NED …) yerel dilde ülke adına çevirir.
// ----------------------------------------------------------------------------
// Neden (2026-09-26): kapsam dışı lig seçicisi ülkeye göre gruplanır; sicilde
// (league_coverage.country) yalnız beyaz liste ligleri için ad var. ISO alpha-2
// karşılığı bilinen kodlar Intl.DisplayNames ile yerelleştirilir; ISO'da olmayan
// (ENG/SCO/WAL/NIR) ve uluslararası kovalar küçük tabloyla çevrilir. Bilinmeyen
// kod olduğu gibi döner.
// ============================================================================

const FIFA_TO_ISO2: Record<string, string> = {
  ALB: 'AL', ALG: 'DZ', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT', AZE: 'AZ', BEL: 'BE', BIH: 'BA', BLR: 'BY', BOL: 'BO',
  BRA: 'BR', BUL: 'BG', CAN: 'CA', CHI: 'CL', CHN: 'CN', COL: 'CO', CRC: 'CR', CRO: 'HR', CYP: 'CY', CZE: 'CZ', DEN: 'DK',
  ECU: 'EC', EGY: 'EG', ESP: 'ES', EST: 'EE', FIN: 'FI', FRA: 'FR', FRO: 'FO', GEO: 'GE', GER: 'DE', GHA: 'GH', GRE: 'GR',
  GUA: 'GT', HON: 'HN', HUN: 'HU', IDN: 'ID', IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT', JPN: 'JP',
  KAZ: 'KZ', KOR: 'KR', KSA: 'SA', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA', MAS: 'MY', MDA: 'MD', MEX: 'MX', MKD: 'MK',
  MNE: 'ME', NED: 'NL', NGA: 'NG', NOR: 'NO', PAN: 'PA', PAR: 'PY', PER: 'PE', POL: 'PL', POR: 'PT', QAT: 'QA', ROU: 'RO',
  RSA: 'ZA', RUS: 'RU', SLV: 'SV', SRB: 'RS', SUI: 'CH', SVK: 'SK', SVN: 'SI', SWE: 'SE', TAN: 'TZ', THA: 'TH', TUN: 'TN',
  TUR: 'TR', UAE: 'AE', UKR: 'UA', URU: 'UY', USA: 'US', VEN: 'VE', VIE: 'VN',
};

// ISO'da bölge olarak bulunmayanlar + uluslararası kovalar (tr/en/de/it)
const SPECIAL: Record<string, Record<string, string>> = {
  ENG: { tr: 'İngiltere', en: 'England', de: 'England', it: 'Inghilterra' },
  SCO: { tr: 'İskoçya', en: 'Scotland', de: 'Schottland', it: 'Scozia' },
  WAL: { tr: 'Galler', en: 'Wales', de: 'Wales', it: 'Galles' },
  NIR: { tr: 'Kuzey İrlanda', en: 'Northern Ireland', de: 'Nordirland', it: 'Irlanda del Nord' },
  INT: { tr: 'Uluslararası', en: 'International', de: 'International', it: 'Internazionale' },
  'INT-2': { tr: 'Uluslararası (2)', en: 'International (2)', de: 'International (2)', it: 'Internazionale (2)' },
};

export function countryName(ccode: string | null | undefined, locale: string): string | null {
  if (!ccode) return null;
  const sp = SPECIAL[ccode];
  if (sp) return sp[locale] ?? sp.en;
  const iso = FIFA_TO_ISO2[ccode];
  if (!iso) return ccode;
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? ccode; } catch { return ccode; }
}
