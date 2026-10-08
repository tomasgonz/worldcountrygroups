import { marked } from 'marked'
import { escapeHtml, safeUrl, sanitizeFragment } from '~/utils/escapeHtml'

/**
 * Markdown from AI answers and feeds is shown as HTML across the site. Harden the shared renderer
 * once: raw HTML is reduced to a small allow-list of tags and attributes, and links/images may only point to http(s) or the site.
 */
let done = false
export default defineNuxtPlugin(() => {
  if (done) return
  done = true
  marked.use({
    renderer: {
      // the site's own inline markup passes; anything that could run script is neutralised
      html(token: any) { return sanitizeFragment(token.text ?? token.raw ?? '') },
      link(token: any) {
        const text = this.parser.parseInline(token.tokens)
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        return `<a href="${safeUrl(token.href)}"${title}>${text}</a>`
      },
      image(token: any) {
        return `<img src="${safeUrl(token.href)}" alt="${escapeHtml(token.text)}"${token.title ? ` title="${escapeHtml(token.title)}"` : ''}>`
      },
    },
  })
})
