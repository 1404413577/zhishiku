import { useSettingsStore } from '@/stores/settings'
import { createAiProvider } from './ai/providerFactory'
import { OllamaAiProvider } from './ai/ollamaProvider'
import { SUMMARY_SYSTEM_PROMPT, TEXT_EDIT_SYSTEM_PROMPT } from './ai/prompts'

function normalizeBaseUrl(value, fallback) {
  return (value || fallback).replace(/\/$/, '')
}

/**
 * 通用 AI 服务，统一调度 online / local / ollama 三种引擎。
 *
 * 调用方继续使用 chatCompletion / generateSummary / polishText，
 * 底层差异由 provider 处理。
 */
export class AIService {
  static getConfigs(overrides = {}) {
    const settings = useSettingsStore()
    const aiEngine = overrides.aiEngine || overrides.engine || settings.aiEngine || 'online'

    if (aiEngine === 'ollama') {
      return {
        aiEngine: 'ollama',
        baseUrl: normalizeBaseUrl(overrides.baseUrl || settings.ollamaBaseUrl, 'http://localhost:11434'),
        model: overrides.model || settings.ollamaModel || '',
      }
    }

    if (aiEngine === 'local') {
      const localAiType = overrides.localAiType || settings.localAiType || 'gpu'
      const fallbackModel = localAiType === 'gpu'
        ? (settings.localModelId || 'SmolLM2-135M-Instruct-q0f32-MLC')
        : (settings.localCpuModelId || 'Xenova/Qwen1.5-0.5B-Chat')
      return {
        aiEngine: 'local',
        localAiType,
        localModelId: overrides.localModelId || overrides.model || fallbackModel,
      }
    }

    return {
      aiEngine: 'online',
      apiKey: overrides.apiKey || settings.aiApiKey || '',
      baseUrl: normalizeBaseUrl(overrides.baseUrl || settings.aiBaseUrl, 'https://api.openai.com/v1'),
      model: overrides.model || settings.aiModel || 'gpt-3.5-turbo',
    }
  }

  /**
   * 获取 Ollama 可用模型列表。
   */
  static async listOllamaModels(options = {}) {
    const settings = useSettingsStore()
    const provider = new OllamaAiProvider({
      aiEngine: 'ollama',
      baseUrl: normalizeBaseUrl(options.baseUrl || settings.ollamaBaseUrl, 'http://localhost:11434'),
      model: options.model || settings.ollamaModel || '',
    })
    return provider.listModels(options)
  }

  /**
   * 发送聊天补全请求。
   *
   * @param {Array} messages - 消息列表 [{ role, content }]
   * @param {Function} onChunk - 流式回调 (delta, fullText)
   * @param {Function} onProgress - 本地模型加载进度回调
   * @param {Object} options - { aiEngine, model, signal } 等临时覆盖项
   * @returns {Promise<string>} 完整回复文本
   */
  static async chatCompletion(messages, onChunk = null, onProgress = null, options = {}) {
    const provider = createAiProvider(this.getConfigs(options))
    return provider.chatCompletion(messages, onChunk, onProgress, options)
  }

  /**
   * 生成文章总结。
   */
  static async generateSummary(content, onChunk = null) {
    const messages = [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: String(content || '').substring(0, 10000) },
    ]
    return this.chatCompletion(messages, onChunk)
  }

  /**
   * 润色/续写/翻译/解释文本。
   */
  static async polishText(text, instruction, onChunk = null) {
    const messages = [
      { role: 'system', content: TEXT_EDIT_SYSTEM_PROMPT(instruction) },
      { role: 'user', content: text },
    ]
    return this.chatCompletion(messages, onChunk)
  }
}
