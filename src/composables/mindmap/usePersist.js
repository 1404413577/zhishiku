import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createNode, createSampleData } from './useNodeModel'

export function usePersist(rootData, onSessionChange) {
  const sessions = ref([])
  const activeSessionId = ref(null)

  function loadSessions() {
    try {
      const saved = localStorage.getItem('mindmap-sessions')
      if (saved) {
        sessions.value = JSON.parse(saved)
      } else {
        // 兼容迁移：如果存在老版本的数据，将其无缝转换为新版列表格式
        const oldData = localStorage.getItem('mindmap-data')
        const id = Date.now().toString()
        sessions.value = [{
          id,
          title: oldData ? JSON.parse(oldData).title : '示例导图',
          updatedAt: Date.now(),
          data: oldData ? JSON.parse(oldData) : createSampleData()
        }]
        localStorage.removeItem('mindmap-data')
      }

      // 恢复上次激活的导图
      const lastActiveId = localStorage.getItem('mindmap-active-id')
      if (lastActiveId && sessions.value.some(s => s.id === lastActiveId)) {
        activeSessionId.value = lastActiveId
      } else {
        activeSessionId.value = sessions.value[0]?.id
      }
      loadActiveSessionData()
    } catch (error) {
      console.error('加载思维导图记录失败:', error)
    }
  }

  function saveToStorage() {
    localStorage.setItem('mindmap-sessions', JSON.stringify(sessions.value))
    localStorage.setItem('mindmap-active-id', activeSessionId.value || '')
  }

  function loadActiveSessionData() {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (session && session.data) {
      rootData.value = JSON.parse(JSON.stringify(session.data))
    } else {
      rootData.value = createNode('中心主题', 0)
    }
    // 切换数据后，通知视图重新计算布局、清空撤销栈等
    if (onSessionChange) onSessionChange()
  }

  // 手动或静默保存当前导图
  function saveMindMap(showMsg = true) {
    const session = sessions.value.find(s => s.id === activeSessionId.value)
    if (session) {
      session.data = JSON.parse(JSON.stringify(rootData.value))
      // 自动提取中心节点的文本作为列表标题
      session.title = rootData.value.title || '未命名导图'
      session.updatedAt = Date.now()
      saveToStorage()
      if (showMsg) ElMessage.success('已保存到本地存储')
    }
  }

  function createNewSession() {
    if (activeSessionId.value) saveMindMap(false) // 切换前静默保存当前的
    const id = Date.now().toString()
    const newSession = {
      id,
      title: '中心主题',
      updatedAt: Date.now(),
      data: createNode('中心主题', 0)
    }
    sessions.value.unshift(newSession) // 插入到列表最前
    activeSessionId.value = id
    saveToStorage()
    loadActiveSessionData()
  }

  function switchSession(id) {
    if (activeSessionId.value === id) return
    saveMindMap(false) // 切换前静默保存当前的
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
          createNewSession() // 如果删光了，自动新建一个空白的
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