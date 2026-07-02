// ============================================================================
// LEAGUE NAMES — FotMob lig haritasında çözülemeyen turnuva id'leri için
// küratörlü adlar + "League 920263" gibi çirkin etiketleri gizleyen yardımcı.
// Yalnızca EMİN olunan id'ler eklenir (yanlış etiket, boş etiketten kötüdür).
// Hem server (free-football normalize) hem client (kart render) kullanır.
// ============================================================================

export const LEAGUE_NAME_FIX: Record<number, string> = {
  77: 'FIFA World Cup',
  894789: 'FIFA World Cup 2026',
  215: 'Besta deild (İzlanda)',
  530: 'Botola Pro (Fas)',
  8814: 'Brasileirão Série B',
};

/**
 * Görüntülenecek lig adı. Çözülemeyen "League <id>" desenini küratörlü
 * haritadan çevirir; haritada da yoksa BOŞ döner (çirkin id göstermek yerine
 * etiketi gizlemek daha profesyonel).
 */
export function displayLeague(name?: string | null, id?: number | null): string {
  const m = name ? /^League (\d+)$/.exec(name.trim()) : null;
  const lid = id ?? (m ? parseInt(m[1], 10) : null);
  if (lid != null && LEAGUE_NAME_FIX[lid]) return LEAGUE_NAME_FIX[lid];
  if (m) return '';
  return name || '';
}
