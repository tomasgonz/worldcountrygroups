import { getAIStatus } from '~/server/utils/llm-client'

export default defineEventHandler(() => {
  return getAIStatus()
})
