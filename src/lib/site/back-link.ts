// ============================================================================
// Maç sayfasından listeye dönüş bağlantısı.
// ----------------------------------------------------------------------------
// Neden (2026-09-26): "Tahminlere dön" hep /predictions'a gidiyordu; kullanıcı
// kapsam dışı bloğu açıp maça girince dönüşte gün, kapsam ve ülke/lig seçimi
// kayboluyordu. Kart bağlantısı listenin sorgusunu `back` olarak taşır; burada
// yalnız bilinen anahtarlar ve güvenli değerler geri yazılır, kapsam dışı maçta
// lig bölümüne çıpa (#lg-<leagueId>) eklenir. `back` yoksa maçın gününden ve
// kapsamından makul bir dönüş üretilir.
// ============================================================================

const ALLOWED: Record<string, RegExp> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  league: /^[a-z0-9-]{1,40}$|^u\d{1,9}$/,
  country: /^[A-Z]{2,3}(-\d)?$/,
  scope: /^all$/,
  note: /^0$/,
  q: /^.{1,60}$/,
  status: /^(upcoming|live|finished)$/,
  ready: /^1$/,
  sort: /^confidence$/,
};

export function sanitizeBackQs(back: string | undefined | null): string | null {
  if (!back || back.length > 300) return null;
  const inp = new URLSearchParams(back);
  const out = new URLSearchParams();
  for (const [k, v] of inp) if (ALLOWED[k]?.test(v) && !out.has(k)) out.set(k, v);
  const s = out.toString();
  return s || null;
}

export function sectionId(leagueId: number | null | undefined): string | null {
  return leagueId != null ? `lg-${leagueId}` : null;
}

/** Liste sayfasına dönüş: `back` sorgusu (temizlenmiş) ya da maçtan türetilen varsayılan. */
export function backHref(opts: { back?: string | null; covered: boolean; leagueId: number | null; kickoffYmd: string; todayYmd: string }): string {
  let qs = sanitizeBackQs(opts.back);
  if (qs == null) {
    const p = new URLSearchParams();
    if (opts.kickoffYmd !== opts.todayYmd) p.set('date', opts.kickoffYmd);
    if (!opts.covered) p.set('scope', 'all');
    qs = p.toString() || null;
  }
  const anchor = !opts.covered ? sectionId(opts.leagueId) : null;
  return `/predictions${qs ? `?${qs}` : ''}${anchor ? `#${anchor}` : ''}`;
}
