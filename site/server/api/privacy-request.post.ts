import { addRequest, REQUEST_TYPES } from '~/server/utils/privacy-requests'
import { clientIp } from '~/server/utils/share-access'

const recent = new Map<string, number[]>()

/** Public form: ask about, correct or delete your data. Limited to 3 requests per hour per network. */
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) || {}
  const email = String(b.email || '').trim().slice(0, 200)
  const message = String(b.message || '').trim().slice(0, 5000)
  const type = REQUEST_TYPES.includes(b.type) ? b.type : 'question'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'Please give an email address so we can reply' })
  if (message.length < 10) throw createError({ statusCode: 400, statusMessage: 'Please describe your request' })
  if (b.website) return { ok: true } // spam trap
  const key = (clientIp(event).ip || 'x').split('.').slice(0, 3).join('.')
  const now = Date.now()
  const times = (recent.get(key) || []).filter(t => now - t < 3600_000)
  if (times.length >= 3) throw createError({ statusCode: 429, statusMessage: 'Too many requests; please try again later' })
  recent.set(key, [...times, now])
  await addRequest({ type, email, name: String(b.name || '').trim().slice(0, 120), message })
  return { ok: true }
})
