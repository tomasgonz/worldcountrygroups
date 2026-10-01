import { join } from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getDigestState, PROJECT_ROOT } from '~/server/utils/digest'
import { runPython } from '~/server/utils/run-python'

const lastTest = new Map<string, number>()
const MIN_INTERVAL_MS = 10 * 60 * 1000 // the email gateway is rate-limited

export default defineEventHandler(async (event) => {
  const { userId, user } = requireAuth(event)
  if (!user.email) {
    throw createError({ statusCode: 400, statusMessage: 'Add an email address to your account first' })
  }
  const prev = lastTest.get(userId) || 0
  if (Date.now() - prev < MIN_INTERVAL_MS) {
    throw createError({ statusCode: 429, statusMessage: 'Please wait a few minutes before sending another test digest' })
  }
  lastTest.set(userId, Date.now())

  try {
    const { stdout } = await runPython(join(PROJECT_ROOT, 'scripts', 'send_digests.py'), ['--user', userId, '--force'])
    const result = JSON.parse(stdout.trim().split('\n').pop() || '{}')?.results?.[0]
    return { ok: result?.status === 'sent', status: result?.status ?? 'nothing to send', ...getDigestState(userId) }
  } catch (e: any) {
    const out = (e?.stdout || '').trim().split('\n').pop() || '{}'
    let err = e?.message || 'Digest failed'
    try { err = JSON.parse(out)?.results?.[0]?.error || err } catch {}
    return { ok: false, status: 'error', error: err, ...getDigestState(userId) }
  }
})
