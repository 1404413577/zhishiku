import { AIService } from './ai'
import { localAiService } from './localAi'

function getLocalModelConfig(settings) {
  const type = settings.localAiType === 'gpu' ? 'gpu' : 'cpu'
  const modelId = type === 'gpu' ? settings.localModelId : settings.localCpuModelId
  return { type, modelId }
}

export const settingsAiService = {
  checkWebGpuSupport() {
    return localAiService.constructor.checkWebGPUSupport()
  },

  async preloadLocalModel(settings, onProgress) {
    const { type, modelId } = getLocalModelConfig(settings)
    if (!modelId) throw new Error('请先选择本地模型')
    return localAiService.getEngine(modelId, type, onProgress)
  },

  async testLocalModel(settings, onProgress) {
    const { type, modelId } = getLocalModelConfig(settings)
    if (!modelId) throw new Error('请先选择本地模型')

    await localAiService.getEngine(modelId, type, onProgress)
    const reply = await localAiService.chatCompletion(modelId, type, [
      { role: 'user', content: '请返回一条简短的回复，确认本地模型可用。' },
    ])
    return reply || '已连接'
  },

  async testOllama(settings) {
    if (!settings.ollamaBaseUrl) throw new Error('请输入 Ollama 服务地址')

    if (settings.ollamaModel) {
      const reply = await AIService.chatCompletion(
        [{ role: 'user', content: '请返回一条简短的回复，确认 Ollama 连接是否正常。' }],
        null,
        null,
        { aiEngine: 'ollama', model: settings.ollamaModel },
      )
      return { type: 'chat', message: reply || '已连接' }
    }

    const models = await AIService.listOllamaModels({ baseUrl: settings.ollamaBaseUrl })
    return { type: 'models', count: models.length || 0 }
  },

  async testOnlineApi(settings) {
    if (!settings.aiBaseUrl) throw new Error('请输入 API Base URL')
    if (!settings.aiApiKey) throw new Error('请输入 API Key')

    const reply = await AIService.chatCompletion(
      [{ role: 'user', content: '请返回一条简短的回复，确认连接是否正常。' }],
      null,
      null,
      {
        aiEngine: 'online',
        baseUrl: settings.aiBaseUrl,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
      },
    )

    return reply || '已连接'
  },
}
