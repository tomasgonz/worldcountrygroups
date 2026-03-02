import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler(() => {
  return getRegistry().listSummaries()
})
