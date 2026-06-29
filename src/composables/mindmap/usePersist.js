import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createNode, createSampleData } from './useNodeModel'
import { useCreate } from './useCreate' // 引入新建逻辑
import { mindMapStorageService } from '@/services/mindMapStorageService'

export function usePersist(rootData, onSessionChange) {
  const sessions = ref([])
  const activeSessionId = ref(null)
  
  // 提取创建方法
  const { createNewMindMap } = useCreate()

  function loadSessions() {
    try {
      const loaded = mindMapStorageService.loadSessions(createSampleData)
      sessions.value = loaded.sessions
      activeSessionId.value = loaded.activeSessionId
      loadActiveSessionData()
    } catch (error) {
      console.error('加载思维导图记录失败:', error)
    }
  }

  function saveToStorage() {
    mindMapStorageService.saveSessions(sessions.value, activeSessionId.value)
  }

  function loadActiveSessionData() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    rootData.value = mindMapStorageService.getSessionData(
      session,
      () => createNode('中心主题', 0)
    )
    if (onSessionChange) onSessionChange()
  }

  function saveMindMap(showMsg = true) {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (session) {
      mindMapStorageService.updateSessionFromData(session, rootData.value)
      saveToStorage()
      if (showMsg) ElMessage.success('已保存到本地存储')
    }
  }

  // 🚀 核心修改：接收 templateId 并应用模板
  function createNewSession(templateId = 'blank') {
    if (activeSessionId.value) saveMindMap(false) 
    // 生成对应的模板树
    const newData = createNewMindMap(templateId)
    const newSession = mindMapStorageService.createSessionFromData(newData)
    sessions.value.unshift(newSession)
    activeSessionId.value = newSession.id
    saveToStorage()
    loadActiveSessionData()
  }

  function switchSession(id) {
    if (activeSessionId.value === id) return
    saveMindMap(false)
    activeSessionId.value = id
    saveToStorage()
    loadActiveSessionData()
  }

  function deleteSession(id) {
    const idx = sessions.value.findIndex(s => s.id === id)
    if (idx > -1) {
      sessions.value.splice(idx, 1)
      if (activeSessionId.value === id) {
        if (sessions.value.length > 0) {
          activeSessionId.value = sessions.value[0].id
          loadActiveSessionData()
        } else {
          createNewSession('blank')
        }
      }
      saveToStorage()
    }
  }

  return {
    sessions,
    activeSessionId,
    loadSessions,
    saveMindMap,
    createNewSession,
    switchSession,
    deleteSession
  }
}
