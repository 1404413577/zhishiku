import { AI_ERROR_CODES, AiError, normalizeAiError } from './aiErrors'
import { emitDelta, getRequestSignal, readNdjsonStream } from './aiProviderUtils'

export class OllamaAiProvider {
  constructor(config) {
    this.config = config
    this.name = 'ollama'
  }

  async listModels(options = {}) {
    const { signal, clear } = getRequestSignal(options, 15000)

    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, { signal })
      if (!response.ok) {
        throw new AiError(`Ollama 请求失败: ${response.status}`, {
          code: AI_ERROR_CODES.REQUEST_FAILED,
          provider: this.name,
          status: response.status,
        })
      }

      const data = await response.json()
      return data.models || []
    } catch (error) {
      throw normalizeAiError(error, '获取 Ollama 模型列表失败', { provider: this.name })
    } finally {
      clear()
    }
  }

  async chatCompletion(messages, onChunk = null, _onProgress = null, options = {}) {
    const model = options.model || this.config.model
    if (!model) {
      throw new AiError('请先在右上角选择 Ollama 模型', {
        code: AI_ERROR_CODES.MODEL_MISSING,
        provider: this.name,
      })
    }

    const { signal, clear } = getRequestSignal(options)

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: !!onChunk }),
        signal,
      })

      if (!response.ok) {
        throw new AiError(`Ollama 请求失败: ${response.status}`, {
          code: AI_ERROR_CODES.REQUEST_FAILED,
          provider: this.name,
          status: response.status,
        })
      }

      if (!onChunk) {
        const data = await response.json()
        return data.message?.content || ''
      }

      let fullText = ''
      await readNdjsonStream(response, (parsed) => {
        const delta = parsed.message?.content || ''
        fullText += delta
        emitDelta(onChunk, delta, fullText)
      })
      return fullText
    } catch (error) {
      throw normalizeAiError(error, 'Ollama 请求失败', { provider: this.name })
    } finally {
      clear()
    }
  }
}
