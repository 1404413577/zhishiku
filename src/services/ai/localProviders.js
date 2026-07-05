import { localAiService } from '../localAi'
import { normalizeAiError } from './aiErrors'

class BaseLocalAiProvider {
  constructor(config, type) {
    this.config = config
    this.type = type
    this.name = type === 'gpu' ? 'local-webllm' : 'local-transformers'
  }

  async chatCompletion(messages, onChunk = null, onProgress = null, options = {}) {
    try {
      return await localAiService.chatCompletion(
        options.model || this.config.localModelId,
        this.type,
        messages,
        onChunk,
        onProgress,
        options,
      )
    } catch (error) {
      throw normalizeAiError(error, '本地 AI 请求失败', { provider: this.name })
    }
  }
}

export class LocalWebLlmProvider extends BaseLocalAiProvider {
  constructor(config) {
    super(config, 'gpu')
  }
}

export class LocalTransformersProvider extends BaseLocalAiProvider {
  constructor(config) {
    super(config, 'cpu')
  }
}

export function createLocalAiProvider(config) {
  return config.localAiType === 'cpu'
    ? new LocalTransformersProvider(config)
    : new LocalWebLlmProvider(config)
}
