<template>
  <div class="chat-layout">
    <ChatSidebar 
      :sessions="sessions"
      v-model:activeSessionId="activeSessionId"
      v-model:isSidebarOpen="isSidebarOpen"
      @create="createNewSession"
      @delete="deleteSession"
    />

    <div v-if="isSidebarOpen" class="sidebar-overlay" @click="isSidebarOpen = false"></div>

    <div class="chat-main">
      <ChatHeader 
        v-model:selectedEngine="selectedEngine"
        v-model:selectedModel="selectedModel"
        :availableModels="availableModels"
        :loadingModels="loadingModels"
        :modelPlaceholder="modelPlaceholder"
        :canArchive="messages.length > 0"
        @refresh="fetchModels"
        @archive="archiveToDocument"
        @toggle-menu="isSidebarOpen = true"
        @update:selectedEngine="onEngineChange"
        @update:selectedModel="onModelChange"
      />

      <div class="chat-body-container" ref="chatBodyRef">
        <div class="chat-body-inner">
          <div v-if="messages.length === 0" class="empty-state">
            <div class="empty-icon-wrapper">
              <el-icon class="empty-icon"><MagicStick /></el-icon>
            </div>
            <h3>有什么我可以帮你的吗？</h3>
            <p class="sub-text" v-if="!selectedModel">请先在右上角选择一个模型，或去设置中检查引擎配置。</p>
          </div>

          <div class="messages" v-else>
            <div 
              v-for="(msg, index) in messages" 
              :key="index"
              :class="['message-row', msg.role]"
              @mouseenter="hoveredMessageIndex = index"
              @mouseleave="hoveredMessageIndex = -1"
            >
              <div class="avatar-col" v-if="msg.role === 'assistant'">
                <div class="avatar ai-avatar"><el-icon><Monitor /></el-icon></div>
              </div>

              <div class="content-col">
                <div class="message-bubble">
                  <div v-if="msg.role === 'user'" class="user-text">{{ msg.content }}</div>
                  <div v-else class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
                </div>

                <div class="message-actions" :class="{ 'show-actions': hoveredMessageIndex === index }">
                  <el-tooltip content="删除此问答对" placement="top">
                    <el-button type="danger" :icon="Delete" circle text size="small" @click="deleteMessagePair(index)" />
                  </el-tooltip>
                </div>
              </div>
            </div>
            
            <div v-if="isGenerating && !currentReply" class="message-row assistant">
              <div class="avatar-col">
                <div class="avatar ai-avatar"><el-icon><Loading /></el-icon></div>
              </div>
              <div class="content-col">
                <div class="message-bubble typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
          <div class="context-hint" v-if="messageCount > 8">
            对话较长，较早的消息将自动裁剪以适配上下文窗口
          </div>
        </div>
      </div>

      <ChatInput 
        :isGenerating="isGenerating"
        :disabled="!selectedModel"
        @send="sendMessage"
        @stop="stopGeneration"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { MagicStick, Monitor, Loading, Delete } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { chatService } from '@/services/chatService'
import { ElMessage, ElMessageBox } from 'element-plus'
import { markdownService as markdownProcessor } from '@/services/markdownService'
import 'highlight.js/styles/github.css'

// 导入拆分的子组件
import ChatSidebar from '@/components/Chat/ChatSidebar.vue'
import ChatHeader from '@/components/Chat/ChatHeader.vue'
import ChatInput from '@/components/Chat/ChatInput.vue'

const settings = useSettingsStore()
const documentsStore = useDocumentsStore()

// AI 模型状态
const selectedEngine = ref(settings.aiEngine || 'ollama')
const availableModels = ref([])
const selectedModel = ref('')
const loadingModels = ref(false)
const isGenerating = ref(false)
const currentReply = ref('')
const chatBodyRef = ref(null)
const abortController = ref(null)
const hoveredMessageIndex = ref(-1)

const safeJsonParse = (str, fallback = []) => {
  if (!str) return fallback
  try { 
    const parsed = JSON.parse(str)
    return parsed !== null ? parsed : fallback
  } catch { 
    return fallback 
  }
}

// 多会话状态
const sessions = ref(safeJsonParse(localStorage.getItem('ollama-chat-sessions'), []))
const activeSessionId = ref(localStorage.getItem('ollama-active-session') || null)
const isSidebarOpen = ref(false)

// 兼容迁移旧版的单一历史记录
if (sessions.value.length === 0) {
  const oldHistory = safeJsonParse(localStorage.getItem('ollama-chat-history'), [])
  if (oldHistory.length > 0) {
    sessions.value.push({ id: Date.now().toString(), title: '历史对话', updatedAt: Date.now(), messages: oldHistory })
    activeSessionId.value = sessions.value[0].id
    localStorage.removeItem('ollama-chat-history')
  } else {
    const id = Date.now().toString()
    sessions.value.push({ id, title: '新对话', updatedAt: Date.now(), messages: [] })
    activeSessionId.value = id
  }
}

if (!activeSessionId.value && sessions.value.length > 0) {
  activeSessionId.value = sessions.value[0].id
}

watch(sessions, (newVal) => localStorage.setItem('ollama-chat-sessions', JSON.stringify(newVal)), { deep: true })
watch(activeSessionId, (newVal) => { if (newVal) localStorage.setItem('ollama-active-session', newVal) })

const modelPlaceholder = computed(() => {
  const placeholders = { 'online': '选择模型', 'local': '选择本地模型', 'ollama': '正在加载模型...' }
  return placeholders[selectedEngine.value] || '选择模型'
})

const activeSession = computed(() => sessions.value.find(s => s.id === activeSessionId.value) || null)
const messages = computed(() => activeSession.value ? activeSession.value.messages : [])
const messageCount = computed(() => messages.value.length)

const createNewSession = () => {
  if (isGenerating.value) return ElMessage.warning('请等待当前对话生成完毕再创建新对话')
  const hasEmpty = sessions.value.find(s => s.messages.length === 0)
  if (hasEmpty) { activeSessionId.value = hasEmpty.id; return }
  const id = Date.now().toString()
  sessions.value.push({ id, title: '新对话', updatedAt: Date.now(), messages: [] })
  activeSessionId.value = id
  scrollToBottom()
}

const deleteSession = async (id) => {
  if (isGenerating.value && id === activeSessionId.value) return ElMessage.warning('当前对话正在生成中，无法删除')
  try {
    await ElMessageBox.confirm('确定要彻底删除这条历史对话记录吗？', '确认操作', { type: 'warning' })
    const index = sessions.value.findIndex(s => s.id === id)
    if (index > -1) {
      sessions.value.splice(index, 1)
      if (activeSessionId.value === id) {
        if (sessions.value.length > 0) activeSessionId.value = sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)[0].id
        else createNewSession()
      }
    }
  } catch {}
}

const renderMarkdown = (text) => markdownProcessor.render(text || '')

const fetchModels = async () => {
  loadingModels.value = true
  availableModels.value = []
  try {
    const { models, selectedModel: defaultModel } = await chatService.listAvailableModels(selectedEngine.value, settings)
    availableModels.value = models
    selectedModel.value = defaultModel

    if (selectedEngine.value === 'online' && !selectedModel.value) {
      ElMessage.info('请先在设置中配置在线 API 模型')
    }

    if (selectedModel.value) {
      chatService.persistSelectedModel(selectedEngine.value, selectedModel.value, settings)
    }
  } catch (error) { ElMessage.error('无法获取模型列表，请检查配置') } finally { loadingModels.value = false }
}

const onEngineChange = () => {
  settings.aiEngine = selectedEngine.value
  selectedModel.value = ''
  availableModels.value = []
  fetchModels()
}

const onModelChange = () => {
  chatService.persistSelectedModel(selectedEngine.value, selectedModel.value, settings)
}

const scrollToBottom = () => {
  nextTick(() => { if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight })
}

const archiveToDocument = async () => {
  if (messages.value.length === 0) return
  let content = `# AI 对话归档 (${new Date().toLocaleString('zh-CN')})\n\n**AI 引擎**: ${selectedEngine.value} | **模型**: ${selectedModel.value}\n\n---\n\n`
  for (const msg of messages.value) {
    if (msg.role === 'user') content += `**🧑 User:**\n${msg.content}\n\n`
    else content += `**🤖 AI:**\n${msg.content}\n\n`
  }
  const title = activeSession.value?.title && activeSession.value.title !== '新对话' 
    ? `AI 对话：${activeSession.value.title}` : `AI 对话归档 - ${new Date().toLocaleDateString('zh-CN')}`
  try {
    await documentsStore.createDocument(title, content)
    ElMessage.success('对话已成功归档到“我的文档”！')
  } catch (error) { ElMessage.error('归档失败') }
}

const stopGeneration = () => { if (abortController.value) abortController.value.abort() }

const deleteMessagePair = (index) => {
  const session = activeSession.value
  if (!session || isGenerating.value) return
  ElMessageBox.confirm('确定要删除此消息吗？(对应的问答将一起被删除)', '删除确认', { type: 'warning' }).then(() => {
    const msg = session.messages[index]
    let startIndex = index
    let deleteCount = 1
    if (msg.role === 'user' && index + 1 < session.messages.length && session.messages[index + 1].role === 'assistant') deleteCount = 2
    else if (msg.role === 'assistant' && index - 1 >= 0 && session.messages[index - 1].role === 'user') {
      startIndex = index - 1; deleteCount = 2
    }
    session.messages.splice(startIndex, deleteCount)
    session.updatedAt = Date.now()
  }).catch(() => {})
}

const sendMessage = async (text) => {
  let session = activeSession.value
  if (!session) return

  session.messages.push({ role: 'user', content: text })
  if (session.messages.length <= 2) session.title = text.length > 15 ? text.substring(0, 15) + '...' : text
  session.updatedAt = Date.now()
  currentReply.value = ''
  isGenerating.value = true
  scrollToBottom()

  const history = chatService.trimHistory(session.messages.map(m => ({ role: m.role, content: m.content })))
  session.messages.push({ role: 'assistant', content: '' })
  const assistantMsgIndex = session.messages.length - 1
  abortController.value = new AbortController()

  try {
    await chatService.completeChat({
      engine: selectedEngine.value,
      model: selectedModel.value,
      localAiType: settings.localAiType || 'gpu',
      messages: history,
      signal: abortController.value.signal,
      onChunk: (_delta, fullText) => {
        currentReply.value = fullText
        session.messages[assistantMsgIndex].content = fullText
        scrollToBottom()
      },
    })
  } catch (error) {
    if (error.name !== 'AbortError') session.messages[assistantMsgIndex].content += '\n\n**[异常: ' + (error.message || '网络或配置错误') + ']**'
  } finally {
    isGenerating.value = false
    session.updatedAt = Date.now()
    abortController.value = null
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
onUnmounted(() => { if (previousAiEngine.value && previousAiEngine.value !== selectedEngine.value) settings.aiEngine = previousAiEngine.value })
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: calc(100dvh - 51px);
  min-height: 0;
  background-color: var(--el-bg-color-page);
}
.sidebar-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.4);
  z-index: 999;
}
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: var(--el-bg-color);
}
.chat-body-container {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding-bottom: 20px;
}
.chat-body-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 40vh;
  text-align: center;
  color: var(--el-text-color-primary);
}
.empty-icon-wrapper {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px;
}
.empty-icon { font-size: 32px; color: var(--el-color-primary); }
.empty-state h3 { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
.sub-text { font-size: 14px; color: var(--el-text-color-secondary); }
.messages { display: flex; flex-direction: column; gap: 32px; }
.message-row { display: flex; gap: 16px; width: 100%; }
.message-row.user { flex-direction: row-reverse; }
.message-row.assistant { flex-direction: row; }
.avatar-col { flex-shrink: 0; width: 32px; }
.ai-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--el-color-success-light-8);
  color: var(--el-color-success);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.content-col { max-width: 80%; display: flex; flex-direction: column; align-items: flex-start; }
.message-row.user .content-col { align-items: flex-end; }
.message-bubble { font-size: 15px; line-height: 1.6; }
.message-row.user .message-bubble {
  background-color: var(--el-fill-color);
  padding: 12px 18px;
  border-radius: 18px; border-bottom-right-radius: 4px;
  color: var(--el-text-color-primary);
}
.user-text { white-space: pre-wrap; word-break: break-word; }
.message-row.assistant .message-bubble { background: transparent; padding: 4px 0; width: 100%; color: var(--el-text-color-primary); }
.markdown-body { word-break: break-word; background-color: transparent !important; font-size: 15px; }
.message-actions { display: flex; margin-top: 6px; opacity: 0; transition: opacity 0.2s; }
.message-actions.show-actions { opacity: 1; }
.context-hint { text-align: center; font-size: 12px; color: var(--el-color-warning); margin-top: 24px; }
.typing-indicator span {
  display: inline-block; width: 6px; height: 6px;
  background-color: var(--el-text-color-secondary); border-radius: 50%; margin: 0 3px;
  animation: typing 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
@media (max-width: 768px) {
  .chat-body-inner { padding: 16px 12px; }
  .message-row { gap: 10px; }
  .content-col { max-width: 90%; }
}

.sidebar-overlay {
  inset: 0;
  background: rgba(0, 0, 0, 0.36);
}

.chat-main {
  min-width: 0;
}

.chat-body-container {
  min-height: 0;
  padding: 4px 0 18px;
}

.chat-body-inner {
  max-width: 860px;
  padding: 24px 24px 12px;
}

.empty-state {
  min-height: 48vh;
  height: auto;
  padding: 24px 0;
}

.empty-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  border: 1px solid var(--el-color-primary-light-7);
  margin-bottom: 18px;
}

.empty-icon {
  font-size: 28px;
}

.empty-state h3 {
  margin: 0 0 10px;
  font-weight: 650;
}

.sub-text {
  max-width: 420px;
  margin: 0;
  line-height: 1.6;
}

.messages {
  gap: 24px;
}

.message-row {
  gap: 14px;
}

.ai-avatar {
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
  font-size: 17px;
}

.content-col {
  max-width: min(78%, 720px);
}

.message-bubble {
  line-height: 1.7;
}

.message-row.user .message-bubble {
  background-color: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  padding: 10px 14px;
  border-radius: 12px;
  border-bottom-right-radius: 4px;
}

.markdown-body :deep(pre) {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .chat-layout {
    height: calc(100dvh - 50px);
  }

  .chat-body-inner {
    padding: 16px 12px 8px;
  }

  .avatar-col {
    width: 28px;
  }

  .ai-avatar {
    width: 28px;
    height: 28px;
    font-size: 15px;
  }

  .content-col {
    max-width: 92%;
  }

  .messages {
    gap: 20px;
  }

  .empty-state {
    min-height: 42vh;
  }
}
</style>
