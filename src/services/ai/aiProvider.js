/**
 * @typedef {Object} AiChatMessage
 * @property {'system' | 'user' | 'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} AiChatOptions
 * @property {string=} aiEngine
 * @property {string=} model
 * @property {string=} baseUrl
 * @property {string=} apiKey
 * @property {'gpu' | 'cpu'=} localAiType
 * @property {AbortSignal=} signal
 */

/**
 * @typedef {Object} AiProgressReport
 * @property {number=} progress
 * @property {string=} statusText
 */

/**
 * @callback AiChunkHandler
 * @param {string} delta
 * @param {string} fullText
 * @returns {void}
 */

/**
 * @callback AiProgressHandler
 * @param {AiProgressReport} report
 * @returns {void}
 */

/**
 * Provider 统一契约：
 * chatCompletion(messages, onChunk, onProgress, options) -> Promise<string>
 *
 * - messages 使用 OpenAI 兼容的 role/content 结构。
 * - onChunk 固定接收 (delta, fullText)，页面不感知 SSE / NDJSON / 本地迭代器差异。
 * - options.signal 用于停止生成。
 */
export const AI_PROVIDER_INTERFACE = 'AiProvider'
