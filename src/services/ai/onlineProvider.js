import { AI_ERROR_CODES, AiError, normalizeAiError } from './aiErrors'
import { getRequestSignal, joinApiPath, readOpenAiSseStream } from './aiProviderUtils'

export class OnlineAiProvider {
  constructor(config) {
    this.config = config
    this.name = 'online'
  }

  async chatCompletion(messages, onChunk = null, _onProgress = null, options = {}) {
    if (!this.config.apiKey) {
      throw new AiError('请先在"设置"中配置 AI API Key。', {
        code: AI_ERROR_CODES.CONFIG_MISSING,
        provider: this.name,
      })
    }

    const apiUrl = joinApiPath(this.config.baseUrl, 'chat/completions')
    const model = options.model || this.config.model
    const { signal, clear } = getRequestSignal(options)

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: !!onChunk,
        }),
        signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new AiError(errorData.error?.message || `请求失败，状态码: ${response.status}`, {
          code: AI_ERROR_CODES.REQUEST_FAILED,
          provider: this.name,
          status: response.status,
        })
      }

      if (!onChunk) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
      }

      return await readOpenAiSseStream(response, onChunk)
    } catch (error) {
      throw normalizeAiError(error, '在线 AI 请求失败', { provider: this.name })
    } finally {
      clear()
    }
  }
}
