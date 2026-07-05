export const AI_ERROR_CODES = {
  CONFIG_MISSING: 'CONFIG_MISSING',
  REQUEST_FAILED: 'REQUEST_FAILED',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  MODEL_MISSING: 'MODEL_MISSING',
}

export class AiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AiError'
    this.code = options.code || AI_ERROR_CODES.REQUEST_FAILED
    this.provider = options.provider || ''
    this.status = options.status
    this.cause = options.cause
  }
}

export function createAbortError(message = 'AI 请求已取消') {
  const error = new Error(message)
  error.name = 'AbortError'
  error.code = AI_ERROR_CODES.ABORTED
  return error
}

export function normalizeAiError(error, fallbackMessage = 'AI 请求失败', meta = {}) {
  if (error?.name === 'AbortError') return error

  if (error instanceof AiError) {
    if (meta.provider && !error.provider) error.provider = meta.provider
    return error
  }

  const message = error?.message || fallbackMessage
  const isTimeout = /timeout|超时/i.test(message)

  return new AiError(message, {
    code: meta.code || (isTimeout ? AI_ERROR_CODES.TIMEOUT : AI_ERROR_CODES.REQUEST_FAILED),
    provider: meta.provider,
    status: meta.status,
    cause: error,
  })
}
