import { parseRoster, saveRoster, leadership } from '~/server/utils/un-leadership'
import { requireAdmin } from '~/server/utils/auth'

/** Paste the text of https://www.un.org/sg/en/leadership-team. { text, save?: boolean } → preview or save. */
export default defineEventHandler(async (event) => {
  const { user } = requireAdmin(event) as any
  const b = await readBody(event)
  const text = String(b?.text || '').slice(0, 400_000)
  if (!b?.save) {
    const entries = parseRoster(text)
    const view = leadership({ roster: entries })
    return { entries, matched: (view?.offices || []).filter((o: any) => o.holder?.kind === 'official').map((o: any) => ({ office: o.short, name: o.holder.name, title: o.holder.title })) }
  }
  try {
    const r = saveRoster(text, user?.username || 'admin')
    return { ok: true, count: r.entries.length, pastedAt: r.pastedAt }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e.message })
  }
})
