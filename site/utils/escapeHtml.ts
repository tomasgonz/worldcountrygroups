/** Escape text for use inside HTML built by hand (titles from news feeds, etc.). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Only http(s) links (no javascript:, data: …); anything else becomes '#'. */
export function safeUrl(u: unknown): string {
  const s = String(u ?? '').trim()
  return /^https?:\/\//i.test(s) || s.startsWith('/') ? s.replace(/"/g, '%22') : '#'
}

const ALLOWED_TAGS = new Set(['a', 'span', 'sup', 'sub', 'mark', 'strong', 'em', 'b', 'i', 'u', 'br', 'small', 'abbr', 'code', 'p', 'ul', 'ol', 'li', 'blockquote', 'h3', 'h4'])
const ALLOWED_ATTRS = new Set(['href', 'class', 'title', 'target', 'rel', 'aria-hidden', 'aria-label', 'id'])

/**
 * Keep the site's own inline markup (links, highlights, citation marks) and drop anything that can
 * run script: unknown tags are shown as text, event handlers and style attributes are removed,
 * and links may only point to http(s) or the site.
 */
export function sanitizeFragment(html: string): string {
  return String(html ?? '').replace(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (whole, close: string, name: string, attrs: string) => {
    const tag = name.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return escapeHtml(whole)
    if (close) return `</${tag}>`
    const kept: string[] = []
    const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    let m: RegExpExecArray | null
    while ((m = re.exec(attrs))) {
      const k = m[1].toLowerCase()
      if (!ALLOWED_ATTRS.has(k)) continue
      let v = m[3] ?? m[4] ?? m[5] ?? ''
      if (k === 'href') v = safeUrl(v)
      if (k === 'target' && v !== '_blank') continue
      kept.push(`${k}="${v.replace(/"/g, '&quot;')}"`)
    }
    if (/aria-hidden\s*(?=[\s/>]|$)/i.test(attrs) && !kept.some(a => a.startsWith('aria-hidden'))) kept.push('aria-hidden="true"')
    const selfClose = /\/\s*$/.test(attrs) || tag === 'br'
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${selfClose && tag === 'br' ? '' : ''}>`
  })
}
