import { AIService } from './ai'

export const LOCAL_GPU_MODELS = [
  { label: 'SmolLM2-135M', value: 'SmolLM2-135M-Instruct-q0f32-MLC' },
  { label: 'Llama-3.2-1B', value: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' },
]

export const LOCAL_CPU_MODELS = [
  { label: 'Qwen1.5-0.5B-Chat', value: 'Xenova/Qwen1.5-0.5B-Chat' },
  { label: 'TinyLlama-1.1B-Chat', value: 'Xenova/TinyLlama-1.1B-Chat-v1.0' },
]

export const chatService = {
  async listAvailableModels(engine, settings) {
    if (engine === 'online') {
      return settings.aiModel
        ? { models: [{ label: settings.aiModel, value: settings.aiModel }], selectedModel: settings.aiModel }
        : { models: [], selectedModel: '' }
    }

    if (engine === 'local') {
      const localType = settings.localAiType || 'gpu'
      const models = localType === 'gpu' ? LOCAL_GPU_MODELS : LOCAL_CPU_MODELS
      const selectedModel = localType === 'gpu'
        ? (settings.localModelId || models[0]?.value || '')
        : (settings.localCpuModelId || models[0]?.value || '')
      return { models, selectedModel }
    }

    const models = await AIService.listOllamaModels({
      baseUrl: settings.ollamaBaseUrl,
    })
    const selectedModel = settings.ollamaModel || models[0]?.name || ''
    return { models, selectedModel }
  },

  persistSelectedModel(engine, model, settings) {
    if (engine === 'online') {
      settings.aiModel = model
    } else if (engine === 'local') {
      if ((settings.localAiType || 'gpu') === 'gpu') settings.localModelId = model
      else settings.localCpuModelId = model
    } else if (engine === 'ollama') {
      settings.ollamaModel = model
    }
  },

  trimHistory(messages, maxContextTokens = 3000) {
    const selected = []
    let tokenCount = 0

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const tokens = Math.ceil((msg.content || '').length / 2)
      if (tokenCount + tokens > maxContextTokens && selected.length > 0) break
      selected.unshift(msg)
      tokenCount += tokens
    }

    if (selected.length > 0 && selected[0].role === 'assistant') {
      const firstIdx = messages.indexOf(selected[0])
      if (firstIdx > 0) selected.unshift(messages[firstIdx - 1])
    }

    return selected
  },

  async completeChat({ engine, model, localAiType, messages, onChunk, signal }) {
    return AIService.chatCompletion(messages, onChunk, null, {
      aiEngine: engine,
      localAiType,
      model,
      signal,
    })
  },
}
