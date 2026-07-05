import { createAbortError } from './aiErrors'

export const DEFAULT_TIMEOUT_MS = 120000

export function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    const error = new Error('AI 请求超时，请检查网络或服务状态')
    error.name = 'TimeoutError'
    error.code = 'TIMEOUT'
    controller.abort(error)
  }, timeoutMs)

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

export function getRequestSignal(options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (options.signal) {
    return { signal: options.signal, clear: () => {} }
  }
  return createTimeoutSignal(timeoutMs)
}

export function joinApiPath(baseUrl, path) {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '')
  const normalizedPath = String(path || '').replace(/^\//, '')
  return `${normalizedBase}/${normalizedPath}`
}

export function assertNotAborted(signal) {
  if (!signal?.aborted) return

  if (signal.reason instanceof Error) {
    throw signal.reason
  }
  throw createAbortError()
}

export function emitDelta(onChunk, delta, fullText) {
  if (delta && onChunk) onChunk(delta, fullText)
}

export async function readOpenAiSseStream(response, onChunk) {
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
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const data = JSON.parse(payload)
        const delta = data.choices?.[0]?.delta?.content || ''
        fullText += delta
        emitDelta(onChunk, delta, fullText)
      } catch (error) {
        console.warn('SSE 解析异常', error)
      }
    }
  }

  return fullText
}

export async function readNdjsonStream(response, onMessage) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
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
        onMessage(JSON.parse(line))
      } catch (error) {
        console.warn('NDJSON 解析失败:', line, error)
      }
    }
  }

  if (buffer.trim()) {
    try {
      onMessage(JSON.parse(buffer))
    } catch (error) {
      console.warn('NDJSON 解析失败:', buffer, error)
    }
  }
}
