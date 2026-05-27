<template>
  <div class="chat-layout">
    <!-- 左侧会话列表侧边栏 -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" :icon="Plus" class="new-chat-btn" @click="createNewSession">
          创建新对话
        </el-button>
      </div>
      <el-scrollbar class="session-list">
        <div 
          v-for="session in sortedSessions" 
          :key="session.id"
          :class="['session-item', { active: session.id === activeSessionId }]"
          @click="selectSession(session.id)"
        >
          <div class="session-info">
            <el-icon><ChatDotRound /></el-icon>
            <span class="session-title">{{ session.title || '新对话' }}</span>
          </div>
          <el-button 
            type="danger" 
            :icon="Delete" 
            circle 
            size="small" 
            class="delete-btn" 
            @click.stop="deleteSession(session.id)"
            title="删除会话"
          />
        </div>
      </el-scrollbar>
    </div>

    <!-- 右侧主对话界面 -->
    <div class="chat-page">
      <div class="chat-header">
        <div class="header-left">
          <h2><el-icon><ChatLineRound /></el-icon> AI 对话</h2>
        </div>
        <div class="header-right">
          <span class="model-label">Ollama 模型:</span>
          <el-select 
            v-model="selectedModel" 
            placeholder="正在加载模型..." 
            size="small" 
            style="width: 200px"
            :loading="loadingModels"
            @change="onModelChange"
          >
            <el-option
              v-for="model in availableModels"
              :key="model.name"
              :label="model.name"
              :value="model.name"
            />
          </el-select>
          <el-button size="small" :icon="Refresh" circle @click="fetchModels" title="刷新模型列表" style="margin-left: 8px" />
          <el-button size="small" type="success" :icon="Download" @click="archiveToDocument" title="将此对话保存为 Markdown 文档" style="margin-left: 8px" :disabled="messages.length === 0">归档</el-button>
        </div>
      </div>

      <div class="chat-body" ref="chatBodyRef">
        <div v-if="messages.length === 0" class="empty-state">
          <el-icon class="empty-icon"><MagicStick /></el-icon>
          <p>欢迎使用 AI 对话！请在下方输入问题，我们将连接到您的本地 Ollama 模型。</p>
          <p class="sub-text" v-if="!selectedModel">请先在右上角选择一个模型，或去设置中检查您的 Ollama 接口地址。</p>
        </div>

        <div class="messages" v-else>
          <div 
            v-for="(msg, index) in messages" 
            :key="index"
            :class="['message-wrapper', msg.role]"
          >
            <div class="avatar">
              <el-icon v-if="msg.role === 'user'"><User /></el-icon>
              <el-icon v-else><Monitor /></el-icon>
            </div>
            <div class="message-content">
              <!-- 用户消息普通文本显示 -->
              <div v-if="msg.role === 'user'" class="user-text">{{ msg.content }}</div>
              <!-- AI 消息用 Markdown 显示 -->
              <div v-else class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
            </div>
          </div>
          
          <!-- 大模型思考中的占位 -->
          <div v-if="isGenerating && !currentReply" class="message-wrapper assistant">
            <div class="avatar"><el-icon><Loading /></el-icon></div>
            <div class="message-content typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-footer">
        <el-input
          v-model="userInput"
          type="textarea"
          :rows="3"
          placeholder="输入问题... (Shift + Enter 换行，Enter 发送)"
          @keydown="handleKeydown"
          resize="none"
          :disabled="isGenerating"
        />
        <div class="action-bar">
          <span class="hint-text">如果出现网络错误，请确保已设置 OLLAMA_ORIGINS="*" 环境变量并启动了 Ollama服务</span>
          <el-button
            type="primary"
            :icon="Promotion"
            @click="sendMessage"
            :loading="isGenerating"
            :disabled="!userInput.trim() || !selectedModel"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { ChatLineRound, Refresh, MagicStick, User, Monitor, Promotion, Loading, Delete, Download, Plus, ChatDotRound } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { ElMessage, ElMessageBox } from 'element-plus'
import { markdownProcessor } from '@/utils/markdown.js'
import 'highlight.js/styles/github.css'

const settings = useSettingsStore()
const documentsStore = useDocumentsStore()

// AI 模型状态
const availableModels = ref([])
const selectedModel = ref(settings.ollamaModel || '')
const loadingModels = ref(false)
const userInput = ref('')
const isGenerating = ref(false)
const currentReply = ref('')
const chatBodyRef = ref(null)

// 安全解析 localStorage 中的 JSON
const safeJsonParse = (str, fallback = []) => {
  try { return JSON.parse(str) } catch { return fallback }
}

// 多会话状态
const sessions = ref(safeJsonParse(localStorage.getItem('ollama-chat-sessions'), []))
const activeSessionId = ref(localStorage.getItem('ollama-active-session') || null)

// 兼容迁移旧版的单一历史记录
if (sessions.value.length === 0) {
  const oldHistory = safeJsonParse(localStorage.getItem('ollama-chat-history'), [])
  if (oldHistory.length > 0) {
    sessions.value.push({
      id: Date.now().toString(),
      title: '历史对话',
      updatedAt: Date.now(),
      messages: oldHistory
    })
    activeSessionId.value = sessions.value[0].id
    localStorage.removeItem('ollama-chat-history')
  } else {
    // 默认创建一个空会话
    const id = Date.now().toString()
    sessions.value.push({
      id,
      title: '新对话',
      updatedAt: Date.now(),
      messages: []
    })
    activeSessionId.value = id
  }
}

// 确保始终有选中的 session
if (!activeSessionId.value && sessions.value.length > 0) {
  activeSessionId.value = sessions.value[0].id
}

// 自动存库
watch(sessions, (newVal) => {
  localStorage.setItem('ollama-chat-sessions', JSON.stringify(newVal))
}, { deep: true })

watch(activeSessionId, (newVal) => {
  if (newVal) {
    localStorage.setItem('ollama-active-session', newVal)
  }
})

// 计算属性
const sortedSessions = computed(() => {
  return [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)
})

const activeSession = computed(() => {
  return sessions.value.find(s => s.id === activeSessionId.value) || null
})

const messages = computed(() => {
  return activeSession.value ? activeSession.value.messages : []
})

// 会话管理操作
const createNewSession = () => {
  if (isGenerating.value) {
    ElMessage.warning('请等待当前对话生成完毕再创建新对话')
    return
  }
  // 避免出现连续多个空会话
  const hasEmpty = sessions.value.find(s => s.messages.length === 0)
  if (hasEmpty) {
    activeSessionId.value = hasEmpty.id
    return
  }

  const id = Date.now().toString()
  sessions.value.push({
    id,
    title: '新对话',
    updatedAt: Date.now(),
    messages: []
  })
  activeSessionId.value = id
  scrollToBottom()
}

const selectSession = (id) => {
  if (isGenerating.value) {
    ElMessage.warning('请等待当前对话生成完毕再切换')
    return
  }
  activeSessionId.value = id
  scrollToBottom()
}

const deleteSession = async (id) => {
  if (isGenerating.value && id === activeSessionId.value) {
    ElMessage.warning('当前对话正在生成中，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm('确定要彻底删除这条历史对话记录吗？', '确认操作', { type: 'warning' })
    const index = sessions.value.findIndex(s => s.id === id)
    if (index > -1) {
      sessions.value.splice(index, 1)
      if (activeSessionId.value === id) {
        if (sessions.value.length > 0) {
          activeSessionId.value = sortedSessions.value[0].id // 切换到最近的
        } else {
          createNewSession() // 全删完了就建一个新的
        }
      }
    }
  } catch {}
}


// Markdown 渲染
const renderMarkdown = (text) => {
  return markdownProcessor.render(text || '')
}

// 获取模型列表
const fetchModels = async () => {
  const baseUrl = settings.ollamaBaseUrl.replace(/\/$/, '')
  if (!baseUrl) {
    ElMessage.warning('请先在设置中配置 Ollama 地址')
    return
  }

  loadingModels.value = true
  try {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    availableModels.value = data.models || []
    
    // 如果没有选中模型，且列表不为空，则默认选第一个
    if (availableModels.value.length > 0 && !selectedModel.value) {
      selectedModel.value = availableModels.value[0].name
      settings.ollamaModel = selectedModel.value
    } else if (selectedModel.value) {
      // 验证当前选择的模型是否还在列表中
      const exists = availableModels.value.some(m => m.name === selectedModel.value)
      if (!exists && availableModels.value.length > 0) {
         selectedModel.value = availableModels.value[0].name
         settings.ollamaModel = selectedModel.value
      }
    }
  } catch (error) {
    console.error('获取 Ollama 模型失败:', error)
    ElMessage.error('无法获取 Ollama 模型，请检查服务是否运行或是否存在跨域问题')
  } finally {
    loadingModels.value = false
  }
}

const onModelChange = (val) => {
  settings.ollamaModel = val
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBodyRef.value) {
      chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
    }
  })
}

// 一键归档到我的文档
const archiveToDocument = async () => {
  if (messages.value.length === 0) return
  
  let content = `# AI 对话归档 (${new Date().toLocaleString('zh-CN')})\n\n`
  
  for (const msg of messages.value) {
    if (msg.role === 'user') {
      content += `**🧑 User:**\n${msg.content}\n\n`
    } else {
      content += `**🤖 AI (${selectedModel.value || 'Ollama'}):**\n${msg.content}\n\n`
    }
  }
  
  const title = activeSession.value?.title && activeSession.value.title !== '新对话' 
    ? `AI 对话：${activeSession.value.title}`
    : `AI 对话归档 - ${new Date().toLocaleDateString('zh-CN')}`
  
  try {
    const doc = await documentsStore.createDocument(title, content)
    ElMessage.success({
      message: '对话已成功归档到“我的文档”！返回左侧菜单可查看。',
      duration: 3500
    })
  } catch (error) {
    console.error('归档失败', error)
    ElMessage.error('归档失败，无法保存到文档库')
  }
}

// 键盘快捷键处理
const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// 发送消息
const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || !selectedModel.value || isGenerating.value) return

  let session = activeSession.value
  if (!session) return

  // 1. 添加用户消息
  session.messages.push({
    role: 'user',
    content: text
  })
  
  // 如果是新的空会话，自动生成简短的提问作为菜单标题
  if (session.messages.length <= 2) {
    session.title = text.length > 15 ? text.substring(0, 15) + '...' : text
  }
  
  session.updatedAt = Date.now()
  userInput.value = ''
  currentReply.value = ''
  isGenerating.value = true
  scrollToBottom()

  // 2. 准备请求 Ollama
  const baseUrl = settings.ollamaBaseUrl.replace(/\/$/, '')
  const history = session.messages.map(m => ({ role: m.role, content: m.content }))
  
  // 先占位助理消息
  session.messages.push({
    role: 'assistant',
    content: ''
  })
  const assistantMsgIndex = session.messages.length - 1

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel.value,
        messages: history,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 3. 处理流式输出 (NDJSON)
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.message && parsed.message.content) {
            currentReply.value += parsed.message.content
            // 增量更新消息
            session.messages[assistantMsgIndex].content = currentReply.value
            scrollToBottom()
          }
        } catch (e) {
          console.warn('解析 JSON 失败:', line, e)
        }
      }
    }
  } catch (error) {
    console.error('调用 Ollama 失败:', error)
    if (session.messages[assistantMsgIndex].content === '') {
       session.messages[assistantMsgIndex].content = '请求失败，请检查 Ollama 服务及网络状况。'
    } else {
       session.messages[assistantMsgIndex].content += '\n\n**[请求中断或发生错误]**'
    }
  } finally {
    isGenerating.value = false
    session.updatedAt = Date.now()
    scrollToBottom()
  }
}

onMounted(() => {
  fetchModels()
  scrollToBottom()
})

</script>

<style scoped>
.chat-layout {
  display: flex;
  height: calc(100vh - 60px); /* 排除顶部导航的高度 */
  background-color: var(--el-bg-color-page);
}

.chat-sidebar {
  width: 250px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.new-chat-btn {
  width: 100%;
}

.session-list {
  flex: 1;
  overflow-x: hidden;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  transition: all 0.2s;
  color: var(--el-text-color-regular);
}

.session-item:hover {
  background-color: var(--el-fill-color-light);
}

.session-item.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-left: 3px solid var(--el-color-primary);
}

.session-item.active .session-title {
  font-weight: 500;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.session-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
  transform: scale(0.9);
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.chat-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 30px;
  box-sizing: border-box;
  overflow: hidden;
  max-width: 1100px;
  margin: 0 auto;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.chat-header h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
}

.model-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-right: 12px;
}

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 20px;
  scroll-behavior: smooth;
  box-shadow: var(--el-box-shadow-light);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: var(--el-text-color-placeholder);
}

.sub-text {
  font-size: 13px;
  margin-top: 8px;
  opacity: 0.8;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 10px;
  margin-top: 10px;
}

.message-wrapper {
  display: flex;
  gap: 16px;
  max-width: 85%;
}

.message-wrapper.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-wrapper.assistant {
  align-self: flex-start;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 20px;
  flex-shrink: 0;
}

.message-wrapper.user .avatar {
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.message-content {
  background-color: var(--el-fill-color-light);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.6;
  overflow-x: auto;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.markdown-body {
  word-break: break-word;
  background-color: transparent !important;
}

/* 简单的打字机动画 */
.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  background-color: var(--el-text-color-secondary);
  border-radius: 50%;
  margin: 0 3px;
  animation: typing 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes typing {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chat-footer {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: var(--el-box-shadow-light);
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.hint-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
