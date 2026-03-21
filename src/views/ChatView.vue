<template>
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
        <el-button size="small" type="primary" :icon="Delete" @click="clearMessages" title="清空对话" style="margin-left: 8px">新对话</el-button>
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
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { ChatLineRound, Refresh, MagicStick, User, Monitor, Promotion, Loading, Delete, Download } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { ElMessage, ElMessageBox } from 'element-plus'
import { markdownProcessor } from '@/utils/markdown.js'
import 'highlight.js/styles/github.css' // 可以改用其他样式

const settings = useSettingsStore()
const documentsStore = useDocumentsStore()

// 状态
const availableModels = ref([])
const selectedModel = ref(settings.ollamaModel || '')
const loadingModels = ref(false)
const messages = ref(JSON.parse(localStorage.getItem('ollama-chat-history') || '[]'))
const userInput = ref('')
const isGenerating = ref(false)
const currentReply = ref('')
const chatBodyRef = ref(null)

// 监听并保存记录
watch(messages, (newVal) => {
  localStorage.setItem('ollama-chat-history', JSON.stringify(newVal))
}, { deep: true })

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

// 清空对话
const clearMessages = async () => {
  if (messages.value.length > 0) {
    try {
      await ElMessageBox.confirm('确定要清空当前对话记录吗？', '确认', { type: 'warning' })
    } catch {
      return
    }
  }
  messages.value = []
  localStorage.removeItem('ollama-chat-history')
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
  
  // 避免标题过长，提取第一句话的前 15 个字作为标题的一部分
  const firstUserMsg = messages.value.find(m => m.role === 'user')?.content || ''
  const snippet = firstUserMsg ? ` - ${firstUserMsg.substring(0, 15)}...` : ''
  const title = `AI 对话归档${snippet}`
  
  try {
    const doc = await documentsStore.createDocument(title, content)
    ElMessage.success({
      message: '对话已成功归档到“我的文档”！',
      duration: 3000
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

  // 1. 添加用户消息
  messages.value.push({
    role: 'user',
    content: text
  })
  userInput.value = ''
  currentReply.value = ''
  isGenerating.value = true
  scrollToBottom()

  // 2. 准备请求 Ollama
  const baseUrl = settings.ollamaBaseUrl.replace(/\/$/, '')
  // 将之前的系统/助手消息构造进去上下文
  const history = messages.value.map(m => ({ role: m.role, content: m.content }))
  
  // 先占位助理消息
  messages.value.push({
    role: 'assistant',
    content: ''
  })
  const assistantMsgIndex = messages.value.length - 1

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
      // 可能会有多个 JSON 对象黏在一个 chunk 里，需要按包含的换行符切分
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          if (parsed.message && parsed.message.content) {
            currentReply.value += parsed.message.content
            // 更新刚才占位的那条信息
            messages.value[assistantMsgIndex].content = currentReply.value
            scrollToBottom()
          }
        } catch (e) {
          console.warn('解析 JSON 失败:', line, e)
        }
      }
    }
  } catch (error) {
    console.error('调用 Ollama 失败:', error)
    if (messages.value[assistantMsgIndex].content === '') {
       messages.value[assistantMsgIndex].content = '请求失败，请检查 Ollama 服务及网络状况。'
    } else {
       messages.value[assistantMsgIndex].content += '\n\n**[请求中断或发生错误]**'
    }
    scrollToBottom()
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}

onMounted(() => {
  fetchModels()
  scrollToBottom()
})

</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); /* 排除顶部导航的高度 */
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
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
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 20px;
  scroll-behavior: smooth;
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
  background-color: var(--el-bg-color);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
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
