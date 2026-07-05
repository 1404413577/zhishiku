import { OnlineAiProvider } from './onlineProvider'
import { OllamaAiProvider } from './ollamaProvider'
import { createLocalAiProvider } from './localProviders'

export function createAiProvider(config) {
  if (config.aiEngine === 'local') return createLocalAiProvider(config)
  if (config.aiEngine === 'ollama') return new OllamaAiProvider(config)
  return new OnlineAiProvider(config)
}
