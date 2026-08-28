// ============================================================================
// SERVER-TEXT i18n — sunucu üretimi metinlerin KOORDİNELİ çevirisi
// ----------------------------------------------------------------------------
// MİMARİ KARAR (2026-08-28): Motor/ajan katmanı gerekçe cümlelerini KANONİK
// TÜRKÇE şablonlarla üretir (Hetzner engine/service.py dahil) ve bunlar
// cache'e + DB'ye (engine_predictions.rationale, unified_analysis.analysis)
// yazılır. Yani sunucuda dil seçmek İMKANSIZ: aynı cache'i üç dil paylaşır.
// Çözüm: istemci tarafında TEK merkezi katman — bilinen şablonları regex ile
// tanır, hedef dilde yeniden kurar. Eşleşmeyen parça olduğu gibi kalır
// (zarif bozulma), lang='tr' hızlı yoldan aynen döner.
//
// YENİ ŞABLON EKLEME KURALI: sunucuda kullanıcıya görünecek yeni bir cümle
// şablonu üretiyorsan BURAYA da kaydını ekle — aksi halde DE/EN'de Türkçe
// sızar. Kayıt bir kez yapılır, üç dil ve tüm bileşenler aynı anda düzelir.
//
// Kapsanan üreticiler:
//   engine/service.py         _rationale_tr        (engine_predictions.rationale)
//   lib/unified-consensus     buildConsensus + bestBet reasoning
//   lib/survival-agent        predictor + verdict (reasoning, selection label)
// ============================================================================

export type Lang = 'tr' | 'en' | 'de';

type Render = (m: string[]) => string;
interface Tpl {
  re: RegExp; // 'g' bayraklı — metin içinde birden çok kez geçebilir
  en: Render;
  de: Render;
}

// Tahmin token'ları ('N sistem analizi. Over yönünde...' içindeki Over gibi)
const TOKEN: Record<string, { en: string; de: string }> = {
  'Over': { en: 'Over', de: 'Über 2,5' },
  'Under': { en: 'Under', de: 'Unter 2,5' },
  'Üst': { en: 'Over', de: 'Über 2,5' },
  'Alt': { en: 'Under', de: 'Unter 2,5' },
  'Yes': { en: 'Yes', de: 'Ja' },
  'No': { en: 'No', de: 'Nein' },
  'Var': { en: 'Yes', de: 'Ja' },
  'Yok': { en: 'No', de: 'Nein' },
  'ev sahibi': { en: 'home win', de: 'Heimsieg' },
  'deplasman': { en: 'away win', de: 'Auswärtssieg' },
  'beraberlik': { en: 'draw', de: 'Unentschieden' },
};
function tok(v: string, lang: 'en' | 'de'): string {
  return TOKEN[v]?.[lang] ?? v;
}

// %62'sinde / %70'i / %45'ü gibi Türkçe iyelik ekleri: '[ek]* deseniyle yutulur
const SUF = "'?[a-zçğıöşü]*";

const TEMPLATES: Tpl[] = [
  // ── unified-consensus: buildConsensus ───────────────────────────────────
  {
    re: new RegExp(`(\\d+) sistem analizi\\. (\\S+) yönünde (\\d+)% ağırlıklı oy\\.`, 'g'),
    en: (m) => `${m[1]} system${+m[1] > 1 ? 's' : ''} analyzed. ${m[3]}% weighted vote for ${tok(m[2], 'en')}.`,
    de: (m) => `${m[1]} System${+m[1] > 1 ? 'e' : ''} analysiert. ${m[3]} % gewichtete Stimmen für ${tok(m[2], 'de')}.`,
  },
  { re: /Yetersiz veri/g, en: () => 'Insufficient data', de: () => 'Unzureichende Daten' },
  // ── unified-consensus: bestBet ──────────────────────────────────────────
  {
    re: new RegExp(`(.+?) için en yüksek güven seviyesi \\((\\d+(?:\\.\\d+)?)%\\)`, 'g'),
    en: (m) => `Highest confidence across markets: ${m[1]} (${m[2]}%)`,
    de: (m) => `Höchste Konfidenz aller Märkte: ${m[1]} (${m[2]} %)`,
  },
  // ── engine/service.py: _rationale_tr ────────────────────────────────────
  {
    re: /Model (.+?) \(ev sahibi\) yönünde eğilimli\./g,
    en: (m) => `The model leans towards ${m[1]} (home).`,
    de: (m) => `Das Modell tendiert zu ${m[1]} (Heim).`,
  },
  {
    re: /Model (.+?) \(deplasman\) yönünde eğilimli\./g,
    en: (m) => `The model leans towards ${m[1]} (away).`,
    de: (m) => `Das Modell tendiert zu ${m[1]} (Auswärts).`,
  },
  {
    re: /Model beraberlik yönünde eğilimli\./g,
    en: () => 'The model leans towards a draw.',
    de: () => 'Das Modell tendiert zum Unentschieden.',
  },
  { re: /Beklenen gol: /g, en: () => 'Expected goals: ', de: () => 'Erwartete Tore: ' },
  {
    re: /Üst 2\.5: %(\d+), KG Var: %(\d+)\./g,
    en: (m) => `Over 2.5: ${m[1]}%, BTTS Yes: ${m[2]}%.`,
    de: (m) => `Über 2,5: ${m[1]} %, BTTS Ja: ${m[2]} %.`,
  },
  // ── survival-agent: predictor ───────────────────────────────────────────
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} ev sahibi kazandı\\.`, 'g'),
    en: (m) => `The home side won in ${m[2]}% of ${m[1]} similar matches.`,
    de: (m) => `In ${m[2]} % von ${m[1]} ähnlichen Spielen gewann das Heimteam.`,
  },
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} deplasman kazandı\\.`, 'g'),
    en: (m) => `The away side won in ${m[2]}% of ${m[1]} similar matches.`,
    de: (m) => `In ${m[2]} % von ${m[1]} ähnlichen Spielen gewann das Auswärtsteam.`,
  },
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} berabere bitti\\.`, 'g'),
    en: (m) => `${m[2]}% of ${m[1]} similar matches ended in a draw.`,
    de: (m) => `${m[2]} % von ${m[1]} ähnlichen Spielen endeten unentschieden.`,
  },
  {
    re: new RegExp(`H2H: (\\d+) maçın %(\\d+)${SUF} kazanmış\\.`, 'g'),
    en: (m) => `H2H: won ${m[2]}% of ${m[1]} meetings.`,
    de: (m) => `Direktvergleich: ${m[2]} % von ${m[1]} Duellen gewonnen.`,
  },
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} (Over|Under) 2\\.5\\. Ort gol: ([\\d.]+)\\.`, 'g'),
    en: (m) => `${m[2]}% of ${m[1]} similar matches went ${m[3]} 2.5. Avg goals: ${m[4]}.`,
    de: (m) => `${m[2]} % von ${m[1]} ähnlichen Spielen: ${m[3] === 'Over' ? 'Über' : 'Unter'} 2,5. Ø Tore: ${m[4]}.`,
  },
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} iki takım da gol attı\\.`, 'g'),
    en: (m) => `Both teams scored in ${m[2]}% of ${m[1]} similar matches.`,
    de: (m) => `In ${m[2]} % von ${m[1]} ähnlichen Spielen trafen beide Teams.`,
  },
  {
    re: new RegExp(`(\\d+) benzer maçın %(\\d+)${SUF} en az bir takım gol atamadı\\.`, 'g'),
    en: (m) => `At least one side failed to score in ${m[2]}% of ${m[1]} similar matches.`,
    de: (m) => `In ${m[2]} % von ${m[1]} ähnlichen Spielen blieb mindestens ein Team torlos.`,
  },
  {
    re: /Veri yok\. Varsayılan ev sahibi\./g,
    en: () => 'No data. Defaulting to home win.',
    de: () => 'Keine Daten. Standard: Heimsieg.',
  },
  { re: /Veri yok\./g, en: () => 'No data.', de: () => 'Keine Daten.' },
  {
    re: /Lig geneli: ev sahibi %(\d+) kazanır\./g,
    en: (m) => `League-wide, the home side wins ${m[1]}% of matches.`,
    de: (m) => `Ligaweit gewinnt das Heimteam ${m[1]} % der Spiele.`,
  },
  {
    re: /Lig geneli: %(\d+) (Over|Under)\./g,
    en: (m) => `League-wide: ${m[1]}% ${m[2]}.`,
    de: (m) => `Ligaweit: ${m[1]} % ${m[2] === 'Over' ? 'Über' : 'Unter'} 2,5.`,
  },
  {
    re: /Lig geneli: BTTS %(\d+) (Yes|No)\./g,
    en: (m) => `League-wide: BTTS ${m[2]} in ${m[1]}%.`,
    de: (m) => `Ligaweit: BTTS ${m[2] === 'Yes' ? 'Ja' : 'Nein'} in ${m[1]} %.`,
  },
  {
    re: /Lig verisinden varsayılan tahmin\./g,
    en: () => 'Default prediction from league data.',
    de: () => 'Standardprognose aus Ligadaten.',
  },
  // ── survival-agent: verdict (agresif gerekçe parçaları) ─────────────────
  {
    re: /(\d+)\/(\d+) ajan aynı yönde\. Tartışma yok\./g,
    en: (m) => `${m[1]}/${m[2]} agents aligned. No debate.`,
    de: (m) => `${m[1]}/${m[2]} Agents einig. Keine Debatte.`,
  },
  {
    re: /(\d+)\/(\d+) ajan destekliyor\. Güçlü sinyal\./g,
    en: (m) => `${m[1]}/${m[2]} agents in support. Strong signal.`,
    de: (m) => `${m[1]}/${m[2]} Agents dafür. Starkes Signal.`,
  },
  {
    re: /(\d+)\/(\d+) ajan bu yönde\. Muhalefet var ama çoğunluk baskın\./g,
    en: (m) => `${m[1]}/${m[2]} agents this way. Some dissent, but the majority dominates.`,
    de: (m) => `${m[1]}/${m[2]} Agents in diese Richtung. Es gibt Widerspruch, doch die Mehrheit dominiert.`,
  },
  {
    re: new RegExp(`Tarih konuşuyor: (\\d+) benzer maçın %(\\d+)${SUF} bu sonucu verdi\\.`, 'g'),
    en: (m) => `History speaks: ${m[2]}% of ${m[1]} similar matches produced this outcome.`,
    de: (m) => `Die Historie spricht: ${m[2]} % von ${m[1]} ähnlichen Spielen brachten dieses Ergebnis.`,
  },
  {
    re: /(\d+) benzer maç incelendi\./g,
    en: (m) => `${m[1]} similar matches reviewed.`,
    de: (m) => `${m[1]} ähnliche Spiele geprüft.`,
  },
  {
    re: /Bu sonuç GÜVENLİ\. Karar verildi\./g,
    en: () => 'This call is SAFE. Decision made.',
    de: () => 'Dieser Tipp ist SICHER. Entscheidung steht.',
  },
  {
    re: /İyi sinyal\. Güvenle oyna\./g,
    en: () => 'Good signal. Proceed with confidence.',
    de: () => 'Gutes Signal. Mit Zuversicht weiter.',
  },
  {
    re: /Yeterli güven\. Dikkatli devam\./g,
    en: () => 'Adequate confidence. Proceed carefully.',
    de: () => 'Ausreichende Konfidenz. Vorsichtig weiter.',
  },
  {
    re: /Tarihsel veri bu tahmini güçlendiriyor\./g,
    en: () => 'Historical data reinforces this prediction.',
    de: () => 'Historische Daten stützen diese Prognose.',
  },
  {
    re: /Bazı ajanlar farklı düşünüyor, risk hesaba katıldı\./g,
    en: () => 'Some agents disagree; the risk is priced in.',
    de: () => 'Einige Agents sehen es anders; das Risiko ist eingepreist.',
  },
  // ── survival-agent: seçim/pazar etiketleri ─────────────────────────────
  { re: /Ev Sahibi Kazanır/g, en: () => 'Home Win', de: () => 'Heimsieg' },
  { re: /Deplasman Kazanır/g, en: () => 'Away Win', de: () => 'Auswärtssieg' },
  { re: /Beraberlik/g, en: () => 'Draw', de: () => 'Unentschieden' },
  { re: /Üst 2\.5 Gol/g, en: () => 'Over 2.5 Goals', de: () => 'Über 2,5 Tore' },
  { re: /Alt 2\.5 Gol/g, en: () => 'Under 2.5 Goals', de: () => 'Unter 2,5 Tore' },
  { re: /İki Takım da Gol Atar/g, en: () => 'Both Teams to Score', de: () => 'Beide Teams treffen' },
  {
    re: /En Az Bir Takım Gol Atamaz/g,
    en: () => 'At Least One Side Fails to Score',
    de: () => 'Mindestens ein Team trifft nicht',
  },
  { re: /Maç Sonucu/g, en: () => 'Match Result', de: () => 'Spielausgang' },
];

/**
 * Sunucu üretimi bir metni hedef dile çevirir. Bilinmeyen parçalar aynen
 * kalır; tr istekleri ve boş metin dokunulmadan döner.
 */
export function localizeServerText(lang: string, text: string | null | undefined): string {
  if (!text) return '';
  if (lang === 'tr') return text;
  const target: 'en' | 'de' = lang === 'de' ? 'de' : 'en';
  let out = text;
  for (const t of TEMPLATES) {
    out = out.replace(t.re, (...args) => {
      // args: [full, g1..gN, offset, string] → [full, g1..gN] dilimi
      const groups = args.slice(0, args.length - 2) as string[];
      return t[target](groups);
    });
  }
  return out;
}
