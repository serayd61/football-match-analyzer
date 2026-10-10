import generated from './stadiums.json';

// Home venues for SportsEvent structured data — SEO denetimi 2026-10-10.
// `stadiums.json` is produced by `scripts/build-stadiums.ts` from football-data.org
// (re-run each season). The hand table below covers what that feed lacks or
// gets wrong: Süper Lig is not on football-data's free tier, and a few venue
// names there are years out of date (Brentford "Griffin Park", Everton
// "Goodison Park"). Hand entries win over the generated file. Keyed by FotMob
// team id (the `home_id` in engine_predictions).

export interface Venue {
  venue: string;
  /** one-line street address (football-data style), when known */
  address?: string;
  /** city, for hand entries without a street address */
  city?: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
}

// Checked 2026-10-10. Update when a club moves or a stadium is renamed.
const HAND: Record<number, Venue> = {
  // Süper Lig 2026-27 (Eyüpspor left out: ground not confirmed)
  8637: { venue: 'RAMS Park', city: 'İstanbul', country: 'TR' },
  8695: { venue: 'Ülker Stadyumu Fenerbahçe Şükrü Saracoğlu Spor Kompleksi', city: 'İstanbul', country: 'TR' },
  10188: { venue: 'Tüpraş Stadyumu', city: 'İstanbul', country: 'TR' },
  9752: { venue: 'Papara Park', city: 'Trabzon', country: 'TR' },
  1933: { venue: 'Başakşehir Fatih Terim Stadyumu', city: 'İstanbul', country: 'TR' },
  9750: { venue: 'Samsun 19 Mayıs Stadyumu', city: 'Samsun', country: 'TR' },
  1925: { venue: 'Gürsel Aksel Stadyumu', city: 'İzmir', country: 'TR' },
  4685: { venue: 'Recep Tayyip Erdoğan Stadyumu', city: 'İstanbul', country: 'TR' },
  4678: { venue: 'Alanya Oba Stadyumu', city: 'Alanya', country: 'TR' },
  8622: { venue: 'Konya Büyükşehir Belediye Stadyumu', city: 'Konya', country: 'TR' },
  4081: { venue: 'Kalyon Stadyumu', city: 'Gaziantep', country: 'TR' },
  2166: { venue: 'Çaykur Didi Stadyumu', city: 'Rize', country: 'TR' },
  7800: { venue: 'Eryaman Stadyumu', city: 'Ankara', country: 'TR' },
  1569: { venue: 'Kocaeli Stadyumu', city: 'İzmit', country: 'TR' },
  96498: { venue: 'Diyarbakır Stadyumu', city: 'Diyarbakır', country: 'TR' },
  357274: { venue: 'Çorum Şehir Stadyumu', city: 'Çorum', country: 'TR' },
  281467: { venue: 'Kazım Karabekir Stadyumu', city: 'Erzurum', country: 'TR' },
  // football-data corrections (moves and renames)
  9937: { venue: 'Gtech Community Stadium', address: 'Lionel Road South, Brentford TW8 0RU', country: 'GB' },
  8668: { venue: 'Hill Dickinson Stadium', address: 'Bramley-Moore Dock, Regent Road, Liverpool', country: 'GB' },
  8667: { venue: 'MKM Stadium', address: 'Walton Street, Hull HU3 6HU', country: 'GB' },
  10170: { venue: 'Pride Park Stadium', address: 'Pride Park, Derby DE24 8XL', country: 'GB' },
  10003: { venue: 'Swansea.com Stadium', address: 'Landore, Swansea SA1 2FA', country: 'GB' },
  8559: { venue: 'Toughsheet Community Stadium', address: 'Burnden Way, Bolton BL6 6JW', country: 'GB' },
  10172: { venue: 'Loftus Road', address: 'South Africa Road, London W12 7PJ', country: 'GB' },
  8658: { venue: "St Andrew's", address: 'Cattell Road, Birmingham B9 4RL', country: 'GB' },
  9875: { venue: 'Stadio Diego Armando Maradona', address: 'Piazzale Vincenzo Tecchio, Napoli 80125', country: 'IT' },
  9905: { venue: 'MEWA Arena', address: 'Eugen-Salomon-Straße 1, Mainz 55128', country: 'DE' },
  8600: { venue: 'Bluenergy Stadium', address: 'Piazzale Repubblica Argentina 3, Udine 33100', country: 'IT' },
  6504: { venue: 'U-Power Stadium', address: 'Viale Giovanni Battista Stucchi 201, Monza 20900', country: 'IT' },
  8529: { venue: 'Unipol Domus', address: 'Via Raimondo Carta Raspi, Cagliari 09122', country: 'IT' },
  10217: { venue: 'Bingoal Stadion', address: 'Haags Kwartier 55, Den Haag 2491 BM', country: 'NL' },
  8674: { venue: 'Euroborg', address: 'Boumaboulevard 41, Groningen 9701 BJ', country: 'NL' },
  8682: { venue: 'Stade Marie-Marvingt', address: 'La Pincenardière, Le Mans 72230', country: 'FR' },
  9906: { venue: 'Riyadh Air Metropolitano', address: 'Avenida de Luis Aragonés 4, Madrid 28022', country: 'ES' },
};

const GENERATED = new Map<number, Venue>(
  Object.entries(generated.teams).map(([id, t]) => [Number(id), { venue: t.venue, address: t.address || undefined, country: t.country }]),
);

/** Home venue for a FotMob team id, or null when unknown (then no SportsEvent is emitted). */
export function venueFor(teamId: number | null | undefined): Venue | null {
  if (!teamId) return null;
  return HAND[teamId] ?? GENERATED.get(teamId) ?? null;
}
