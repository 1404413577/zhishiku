<template>
  <div class="chat-layout">
    <!-- 左侧会话列表侧边栏 -->
    <div :class="['chat-sidebar', { 'sidebar-open': isSidebarOpen }]">
      <div class="sidebar-header">
        <el-button type="primary" :icon="Plus" class="new-chat-btn" @click="createNewSession">
          创建新对话
        </el-button>
        <el-button class="sidebar-close-btn" :icon="Close" circle size="small" @click="isSidebarOpen = false" />
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

    <div v-if="isSidebarOpen" class="sidebar-overlay" @click="isSidebarOpen = false"></div>

    <!-- 右侧主对话界面 -->
    <div class="chat-page">
      <div class="chat-header">
        <div class="header-left">
          <el-button class="menu-toggle" :icon="Menu" circle @click="isSidebarOpen = true" />
          <h2><el-icon><ChatLineRound /></el-icon> AI 对话</h2>
        </div>
        <div class="header-right">
          <span class="model-label">AI 引擎:</span>
          <el-select 
            v-model="selectedEngine" 
            placeholder="选择引擎" 
            size="small" 
            style="width: 120px"
            @change="onEngineChange"
          >
            <el-option label="在线 API" value="online" />
            <el-option label="本地模型" value="local" />
            <el-option label="Ollama" value="ollama" />
          </el-select>

          <span class="model-label" style="margin-left: 16px">模型:</span>
          <el-select 
            v-model="selectedModel" 
            :placeholder="modelPlaceholder" 
            size="small" 
            style="width: 200px"
            :loading="loadingModels"
            @change="onModelChange"
          >
            <el-option
              v-for="model in availableModels"
              :key="model.value || model.name"
              :label="model.label || model.name"
              :value="model.value || model.name"
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

      <div class="context-hint" v-if="messageCount > 8">
        对话较长时，较早的消息将自动裁剪以适配模型上下文窗口
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
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { ChatLineRound, Refresh, MagicStick, User, Monitor, Promotion, Loading, Delete, Download, Plus, ChatDotRound, Close, Menu } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { AIService } from '@/services/ai'
import { ElMessage, ElMessageBox } from 'element-plus'
import { markdownProcessor } from '@/utils/markdown.js'
import 'highlight.js/styles/github.css'

const settings = useSettingsStore()
const documentsStore = useDocumentsStore()

// AI 模型状态
const selectedEngine = ref(settings.aiEngine || 'ollama')
const availableModels = ref([])
const selectedModel = ref('')
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
const isSidebarOpen = ref(false)

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

const modelPlaceholder = computed(() => {
  const placeholders = {
    'online': '选择模型 (例如: gpt-3.5-turbo)',
    'local': '选择本地模型',
    'ollama': '正在加载模型...'
  }
  return placeholders[selectedEngine.value] || '选择模型'
})

const activeSession = computed(() => {
  return sessions.value.find(s => s.id === activeSessionId.value) || null
})

const messages = computed(() => {
  return activeSession.value ? activeSession.value.messages : []
})

const messageCount = computed(() => messages.value.length)

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
  loadingModels.value = true
  availableModels.value = []
  
  try {
    if (selectedEngine.value === 'online') {
      // 在线 API 模式：显示配置的模型
      availableModels.value = []
      if (settings.aiModel) {
        availableModels.value.push({
          label: settings.aiModel,
          value: settings.aiModel
        })
        selectedModel.value = settings.aiModel
      } else {
        ElMessage.info('请先在设置中配置在线 API 模型')
      }
    } else if (selectedEngine.value === 'local') {
      // 本地模型模式：根据类型显示本地模型
      const localType = settings.localAiType || 'gpu'
      if (localType === 'gpu') {
        availableModels.value = [
          { label: 'SmolLM2-135M (轻量)', value: 'SmolLM2-135M-Instruct-q0f32-MLC' },
          { label: 'Llama-3.2-1B (中量)', value: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' }
        ]
        selectedModel.value = settings.localModelId || availableModels.value[0].value
      } else {
        availableModels.value = [
          { label: 'Qwen1.5-0.5B-Chat (0.5B / 中文支持好)', value: 'Xenova/Qwen1.5-0.5B-Chat' },
          { label: 'TinyLlama-1.1B-Chat (1.1B / 通用对话)', value: 'Xenova/TinyLlama-1.1B-Chat-v1.0' }
        ]
        selectedModel.value = settings.localCpuModelId || availableModels.value[0].value
      }
    } else if (selectedEngine.value === 'ollama') {
      // Ollama 模式
      if (!settings.ollamaBaseUrl) {
        ElMessage.warning('请先在设置中配置 Ollama 地址')
        loadingModels.value = false
        return
      }
      availableModels.value = await AIService.listOllamaModels()
      
      if (availableModels.value.length > 0 && !selectedModel.value) {
        selectedModel.value = availableModels.value[0].name
        settings.ollamaModel = selectedModel.value
      } else if (selectedModel.value) {
        const exists = availableModels.value.some(m => m.name === selectedModel.value)
        if (!exists && availableModels.value.length > 0) {
          selectedModel.value = availableModels.value[0].name
          settings.ollamaModel = selectedModel.value
        }
      }
    }
  } catch (error) {
    console.error('获取模型失败:', error)
    ElMessage.error('无法获取模型列表，请检查配置')
  } finally {
    loadingModels.value = false
  }
}

const onEngineChange = (val) => {
  selectedEngine.value = val
  settings.aiEngine = val
  selectedModel.value = ''
  availableModels.value = []
  fetchModels()
}

const onModelChange = (val) => {
  selectedModel.value = val
  if (selectedEngine.value === 'online') {
    settings.aiModel = val
  } else if (selectedEngine.value === 'local') {
    const localType = settings.localAiType || 'gpu'
    if (localType === 'gpu') {
      settings.localModelId = val
    } else {
      settings.localCpuModelId = val
    }
  } else if (selectedEngine.value === 'ollama') {
    settings.ollamaModel = val
  }
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
  
  let content = `# AI 对话归档 (${new Date().toLocaleString('zh-CN')})\n\n**AI 引擎**: ${selectedEngine.value} | **模型**: ${selectedModel.value}\n\n---\n\n`
  
  for (const msg of messages.value) {
    if (msg.role === 'user') {
      content += `**🧑 User:**\n${msg.content}\n\n`
    } else {
      content += `**🤖 AI:**\n${msg.content}\n\n`
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

// 裁剪对话历史，避免超出模型上下文窗口
// 安全阈值设为 3000 tokens，为回复预留约 1000 tokens (4096 context window)
const MAX_HISTORY_TOKENS = 3000

const estimateTokens = (text) => Math.ceil(text.length / 2)

const trimHistory = (messages) => {
  // 从最新到最旧累加 tokens，超过阈值则丢弃更早的消息
  // 确保结果以 user 角色开头（模型通常要求首条消息为 user）
  const selected = []
  let tokenCount = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const tokens = estimateTokens(msg.content || '')
    if (tokenCount + tokens > MAX_HISTORY_TOKENS && selected.length > 0) break
    selected.unshift(msg)
    tokenCount += tokens
  }

  // 如果第一条是 assistant，往前多取一条 user 消息
  if (selected.length > 0 && selected[0].role === 'assistant') {
    const firstIdx = messages.indexOf(selected[0])
    if (firstIdx > 0) {
      selected.unshift(messages[firstIdx - 1])
    }
  }

  return selected
}

// 发送消息
const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || !selectedModel.value || isGenerating.value) return

  let session = activeSession.value
  if (!session) return

  // 临时保存当前引擎，发送后恢复
  const previousEngine = settings.aiEngine
  settings.aiEngine = selectedEngine.value

  // 1. 添加用户消息
  session.messages.push({ role: 'user', content: text })

  if (session.messages.length <= 2) {
    session.title = text.length > 15 ? text.substring(0, 15) + '...' : text
  }

  session.updatedAt = Date.now()
  userInput.value = ''
  currentReply.value = ''
  isGenerating.value = true
  scrollToBottom()

  // 2. 准备对话历史 (裁剪后发送，避免超出上下文窗口)
  const allHistory = session.messages.map(m => ({ role: m.role, content: m.content }))
  const history = trimHistory(allHistory)

  // 3. 占位 AI 消息
  session.messages.push({ role: 'assistant', content: '' })
  const assistantMsgIndex = session.messages.length - 1

  try {
    // 根据引擎类型调用对应 AI 服务
    if (selectedEngine.value === 'local') {
      // 本地模型需要通过 localAiService
      const { localAiService } = await import('@/services/localAi')
      const localType = settings.localAiType || 'gpu'
      const modelId = selectedModel.value
      await localAiService.chatCompletion(
        modelId,
        localType,
        history,
        (_delta, fullText) => {
          currentReply.value = fullText
          session.messages[assistantMsgIndex].content = fullText
          scrollToBottom()
        }
      )
    } else {
      // 在线 API 和 Ollama 都通过 AIService
      await AIService.chatCompletion(
        history,
        (_delta, fullText) => {
          currentReply.value = fullText
          session.messages[assistantMsgIndex].content = fullText
          scrollToBottom()
        },
        null,
        { model: selectedModel.value }
      )
    }
  } catch (error) {
    console.error('调用 AI 失败:', error)
    if (session.messages[assistantMsgIndex].content === '') {
       session.messages[assistantMsgIndex].content = '请求失败: ' + (error.message || '请检查配置及网络状况。')
    } else {
       session.messages[assistantMsgIndex].content += '\n\n**[请求中断或发生错误: ' + (error.message || '未知错误') + ']**'
    }
  } finally {
    isGenerating.value = false
    session.updatedAt = Date.now()
    settings.aiEngine = previousEngine
    scrollToBottom()
  }
}

const previousAiEngine = ref(null)

onMounted(() => {
  previousAiEngine.value = settings.aiEngine
  selectedEngine.value = settings.aiEngine || 'ollama'
  fetchModels()
  scrollToBottom()
})

onUnmounted(() => {
  if (previousAiEngine.value && previousAiEngine.value !== selectedEngine.value) {
    settings.aiEngine = previousAiEngine.value
  }
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

.context-hint {
  text-align: center;
  font-size: 12px;
  color: var(--el-color-warning);
  padding: 4px 0;
  margin-bottom: 4px;
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

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100%;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: none;
  }

  .chat-sidebar.sidebar-open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .new-chat-btn {
    flex: 1;
  }

  .sidebar-close-btn {
    display: inline-flex;
  }

  .session-title {
    max-width: 140px;
  }

  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
  }

  .menu-toggle {
    display: inline-flex;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .chat-page {
    padding: 12px 12px;
    max-width: 100%;
  }

  .chat-header {
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
    padding-bottom: 10px;
  }

  .chat-header h2 {
    font-size: 16px;
  }

  .header-right {
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
  }

  .header-right .model-label {
    font-size: 12px;
    margin-right: 4px;
  }

  .chat-body {
    padding: 10px 12px;
    margin-bottom: 12px;
  }

  .message-wrapper {
    max-width: 92%;
  }

  .message-content {
    font-size: 14px;
    padding: 10px 12px;
  }

  .avatar {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }

  .chat-footer {
    padding: 10px;
  }

  .chat-footer .el-textarea__inner {
    font-size: 14px;
  }

  .action-bar {
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .hint-text {
    display: none;
  }
}

/* 桌面端：隐藏移动端按钮 */
@media (min-width: 769px) {
  .menu-toggle {
    display: none;
  }

  .sidebar-close-btn {
    display: none;
  }

  .sidebar-overlay {
    display: none;
  }
}
</style>
