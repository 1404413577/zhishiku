type MindMapData = Record<string, unknown>

type MindMapSession = {
  id: string
  title: string
  updatedAt: number
  data: MindMapData
}

const SESSIONS_KEY = 'mindmap-sessions'
const ACTIVE_SESSION_KEY = 'mindmap-active-id'
const LEGACY_DATA_KEY = 'mindmap-data'

const getStorage = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const cloneMindMapData = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data)) as T
}

const createSession = (
  data: MindMapData,
  id = Date.now().toString(),
  title = data?.title || '未命名导图'
): MindMapSession => ({
  id,
  title,
  updatedAt: Date.now(),
  data: cloneMindMapData(data),
})

export const mindMapStorageService = {
  loadSessions(createDefaultData: () => MindMapData) {
    const storage = getStorage()
    if (!storage) {
      const sessions = [createSession(createDefaultData())]
      return { sessions, activeSessionId: sessions[0].id }
    }

    const savedSessions = safeJsonParse<MindMapSession[] | null>(
      storage.getItem(SESSIONS_KEY),
      null
    )

    const sessions = Array.isArray(savedSessions) && savedSessions.length > 0
      ? savedSessions
      : this.createInitialSessions(createDefaultData)

    const lastActiveId = storage.getItem(ACTIVE_SESSION_KEY)
    const activeSessionId = lastActiveId && sessions.some(session => session.id === lastActiveId)
      ? lastActiveId
      : sessions[0]?.id || null

    return { sessions, activeSessionId }
  },

  createInitialSessions(createDefaultData: () => MindMapData) {
    const storage = getStorage()
    const legacyData = safeJsonParse<MindMapData | null>(
      storage?.getItem(LEGACY_DATA_KEY) || null,
      null
    )
    const data = legacyData || createDefaultData()
    const title = legacyData?.title || '示例导图'

    storage?.removeItem(LEGACY_DATA_KEY)
    return [createSession(data, Date.now().toString(), title)]
  },

  saveSessions(sessions: MindMapSession[], activeSessionId: string | null) {
    const storage = getStorage()
    if (!storage) return

    storage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
    storage.setItem(ACTIVE_SESSION_KEY, activeSessionId || '')
  },

  getSessionData(session: MindMapSession | undefined, createBlankData: () => MindMapData) {
    if (!session?.data) return createBlankData()
    return cloneMindMapData(session.data)
  },

  updateSessionFromData(session: MindMapSession, data: MindMapData) {
    session.data = cloneMindMapData(data)
    session.title = data?.title || '未命名导图'
    session.updatedAt = Date.now()
  },

  createSessionFromData(data: MindMapData) {
    return createSession(data)
  },
}
