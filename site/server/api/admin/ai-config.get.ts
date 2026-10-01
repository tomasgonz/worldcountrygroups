import { requireAdmin } from '~/server/utils/auth'
import { getAIConfig, getPromptConfig, getPulseStyleConfig } from '~/server/utils/ai-config'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const config = getAIConfig()
  return {
    activeProvider: config.activeProvider,
    providers: config.providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 4)}...${p.apiKey.slice(-4)}` : '',
    })),
    prompts: getPromptConfig(),
    pulseStyle: getPulseStyleConfig(),
  }
})
