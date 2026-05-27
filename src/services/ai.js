import { useSettingsStore } from '@/stores/settings'
import { localAiService } from './localAi'

/**
 * 通用 AI 服务 — 统一调度 online / local / ollama 三种引擎
 */
export class AIService {
  static getConfigs() {
    const settings = useSettingsStore()
    const aiEngine = settings.aiEngine || 'online'

    if (aiEngine === 'ollama') {
      return {
        aiEngine: 'ollama',
        baseUrl: (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, ''),
        model: settings.ollamaModel || ''
      }
    }

    if (aiEngine === 'local') {
      const localAiType = settings.localAiType || 'gpu'
      const localModelId = localAiType === 'gpu'
        ? (settings.localModelId || 'SmolLM2-135M-Instruct-q0f32-MLC')
        : (settings.localCpuModelId || 'Xenova/SmolLM2-135M-Instruct')
      return { aiEngine: 'local', localAiType, localModelId }
    }

    // online
    return {
      aiEngine: 'online',
      apiKey: settings.aiApiKey || '',
      baseUrl: settings.aiBaseUrl || 'https://api.openai.com/v1',
      model: settings.aiModel || 'gpt-3.5-turbo'
    }
  }

  /**
   * 获取 Ollama 可用模型列表
   */
  static async listOllamaModels() {
    const { baseUrl } = this.getConfigs()
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) throw new Error(`Ollama 请求失败: ${response.status}`)
    const data = await response.json()
    return data.models || []
  }

  /**
   * 发送聊天补全请求
   * @param {Array} messages - 消息列表 [{ role, content }]
   * @param {Function} onChunk - 流式回调 (delta, fullText)
   * @param {Function} onProgress - 本地模型加载进度回调 (仅 local 模式)
   * @param {Object} options - { model } 覆盖默认模型 (ollama 场景常用)
   * @returns {Promise<string>} - 完整回复文本
   */
  static async chatCompletion(messages, onChunk = null, onProgress = null, options = {}) {
    const configs = this.getConfigs()

    if (configs.aiEngine === 'local') {
      return localAiService.chatCompletion(configs.localModelId, configs.localAiType, messages, onChunk, onProgress)
    }

    if (configs.aiEngine === 'ollama') {
      return this._ollamaChatCompletion(configs, messages, onChunk, options)
    }

    // online (OpenAI 兼容)
    if (!configs.apiKey) {
      throw new Error('请先在"设置"中配置 AI API Key。')
    }

    const apiUrl = configs.baseUrl.endsWith('/')
      ? `${configs.baseUrl}chat/completions`
      : `${configs.baseUrl}/chat/completions`

    const requestBody = {
      model: configs.model,
      messages,
      stream: !!onChunk
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${configs.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `请求失败，状态码: ${response.status}`)
    }

    if (!onChunk) {
      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    }

    // SSE 流式处理
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices[0]?.delta?.content || ''
            fullText += delta
            if (delta) onChunk(delta, fullText)
          } catch (e) {
            console.warn('SSE 解析异常', e)
          }
        }
      }
    }
    return fullText
  }

  /**
   * Ollama 聊天补全 (NDJSON 流式)
   */
  static async _ollamaChatCompletion(configs, messages, onChunk, options) {
    const model = options.model || configs.model
    if (!model) throw new Error('请先在右上角选择 Ollama 模型')

    const response = await fetch(`${configs.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: !!onChunk })
    })

    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.status}`)
    }

    if (!onChunk) {
      const data = await response.json()
      return data.message?.content || ''
    }

    // NDJSON 流式
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.message?.content) {
            fullText += parsed.message.content
            onChunk(parsed.message.content, fullText)
          }
        } catch (e) {
          console.warn('Ollama NDJSON 解析失败:', line, e)
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer)
        if (parsed.message?.content) {
          fullText += parsed.message.content
          onChunk(parsed.message.content, fullText)
        }
      } catch {}
    }

    return fullText
  }

  /**
   * 生成文章总结
   */
  static async generateSummary(content, onChunk = null) {
    const messages = [
      { role: 'system', content: '你是一个擅长知识提炼的 AI 助手。请你用一段简洁精炼的中文（大概200-300字），为我总结以下这篇文档的内容。返回纯文本，少用Markdown格式。' },
      { role: 'user', content: content.substring(0, 10000) }
    ]
    return this.chatCompletion(messages, onChunk)
  }

  /**
   * 润色/续写/翻译/解释 文本
   */
  static async polishText(text, instruction, onChunk = null) {
    const messages = [
      { role: 'system', content: `你是一个专业的文字编辑，请根据用户的指令处理文本。直接返回处理后的结果，不要有任何无关的开头或结尾。指令：${instruction}` },
      { role: 'user', content: text }
    ]
    return this.chatCompletion(messages, onChunk)
  }
}
