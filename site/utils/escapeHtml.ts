/** Escape text for use inside HTML built by hand (titles from news feeds, etc.). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Only http(s) links (no javascript:, data: …); anything else becomes '#'. */
export function safeUrl(u: unknown): string {
  const s = String(u ?? '').trim()
  return /^https?:\/\//i.test(s) || s.startsWith('/') ? s.replace(/"/g, '%22') : '#'
}
