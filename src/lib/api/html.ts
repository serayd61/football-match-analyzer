// HTML'e gömülen kullanıcı girdisi için kaçış. E-posta şablonları ve sunucu
// tarafında üretilen küçük HTML sayfaları (unsubscribe) bunu kullanır.
const MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
}
