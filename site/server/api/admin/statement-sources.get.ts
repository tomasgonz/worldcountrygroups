import { getStatementsConfig } from '~/server/utils/statements-config'

export default defineEventHandler(() => {
  const config = getStatementsConfig()
  return { sources: config.sources, maxStatements: config.maxStatements }
})
