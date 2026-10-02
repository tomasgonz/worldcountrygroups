import { requireAdmin } from '~/server/utils/auth'
import { saveConfig, getBackupStatus } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = (await readBody(event)) || {}
  const { generatedPassword } = saveConfig({
    region: body.region, bucket: body.bucket, accessKey: body.accessKey, secretKey: body.secretKey, path: body.path,
  })
  return {
    ok: true,
    message: 'Backup settings saved.',
    // Returned exactly once, only when a new encryption password had to be created.
    generatedPassword,
    passwordNotice: generatedPassword
      ? 'A new backup encryption password was generated. Save it in a password manager NOW: it will not be shown again, and without it the backups cannot be restored.'
      : null,
    status: getBackupStatus(),
  }
})
