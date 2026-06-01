// ============================================================================
// ADMIN ALLOWLIST — single source of truth
// ============================================================================
// Edge-safe (plain data, no node-only imports) so it can be used from both
// middleware.ts (edge runtime) and API route handlers (node runtime).

export const ADMIN_EMAILS: readonly string[] = [
  'serayd61@hotmail.com',
  'info@swissdigital.life',
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
