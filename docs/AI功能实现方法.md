# AI 功能具体实现方法

本文档总结本项目的 AI 接入方式，适合迁移到其它前端项目中。核心思路是：把不同 AI 引擎统一封装成一个 `AIService`，页面只调用 `chatCompletion`、`polishText`、`generateSummary` 等上层方法，不直接关心在线 API、Ollama 或本地模型的差异。

## 1. 实现目标

- 支持 OpenAI 兼容接口。
- 支持 Ollama 本地服务。
- 支持浏览器本地模型，可按项目需要后置。
- 支持流式输出。
- 支持停止生成。
- 支持编辑器场景：AI 帮写、润色、总结。
- 支持对话场景：多轮消息、历史裁剪、归档。

## 2. 推荐目录

```text
src/
├── services/
│   ├── ai.js
│   └── localAi.js
├── stores/
│   └── settings.js
└── composables/
    └── editor/
        └── useEditorAi.js
```

如果项目不是 Vue，也可以保留 `services/ai.js`，把 `useEditorAi.js` 改成普通函数模块。

## 3. 设置项设计

AI 配置建议统一存储，至少包含这些字段：

```js
const aiSettings = {
  aiEngine: 'online', // online | ollama | local
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-3.5-turbo',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: '',
  localAiType: 'gpu',
  localModelId: 'SmolLM2-135M-Instruct-q0f32-MLC',
  localCpuModelId: 'Xenova/Qwen1.5-0.5B-Chat',
}
```

在本项目中，这些配置通过 Pinia + `localStorage` 持久化。迁移到其它项目时，可以换成 Redux、Zustand、Vuex、普通 `localStorage` 或后端用户配置。

## 4. 核心服务：AIService

核心服务的职责：

- 读取当前 AI 配置。
- 根据 `aiEngine` 分流到在线 API、Ollama 或本地模型。
- 统一暴露 `chatCompletion`。
- 统一处理流式输出。
- 统一支持 `AbortController` 停止请求。

简化版实现：

```js
const DEFAULT_TIMEOUT_MS = 120000

function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new Error('AI 请求超时，请检查网络或服务状态'))
  }, timeoutMs)

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

export class AIService {
  static getConfigs() {
    const settings = getAiSettings()

    if (settings.aiEngine === 'ollama') {
      return {
        aiEngine: 'ollama',
        baseUrl: (settings.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, ''),
        model: settings.ollamaModel || '',
      }
    }

    return {
      aiEngine: 'online',
      apiKey: settings.aiApiKey || '',
      baseUrl: settings.aiBaseUrl || 'https://api.openai.com/v1',
      model: settings.aiModel || 'gpt-3.5-turbo',
    }
  }

  static async chatCompletion(messages, onChunk = null, onProgress = null, options = {}) {
    const configs = this.getConfigs()

    if (configs.aiEngine === 'ollama') {
      return this.ollamaChatCompletion(configs, messages, onChunk, options)
    }

    if (!configs.apiKey) {
      throw new Error('请先配置 AI API Key')
    }

    const apiUrl = configs.baseUrl.endsWith('/')
      ? `${configs.baseUrl}chat/completions`
      : `${configs.baseUrl}/chat/completions`

    const { signal, clear } = options.signal
      ? { signal: options.signal, clear: () => {} }
      : createTimeoutSignal()

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${configs.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || configs.model,
          messages,
          stream: !!onChunk,
        }),
        signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `请求失败，状态码: ${response.status}`)
      }

      if (!onChunk) {
        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              const delta = data.choices[0]?.delta?.content || ''
              fullText += delta
              if (delta) onChunk(delta, fullText)
            } catch (error) {
              console.warn('SSE 解析异常', error)
            }
          }
        }
      }

      return fullText
    } finally {
      clear()
    }
  }

  static async ollamaChatCompletion(configs, messages, onChunk, options = {}) {
    const model = options.model || configs.model
    if (!model) throw new Error('请先选择 Ollama 模型')

    const { signal, clear } = options.signal
      ? { signal: options.signal, clear: () => {} }
      : createTimeoutSignal()

    try {
      const response = await fetch(`${configs.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: !!onChunk }),
        signal,
      })

      if (!response.ok) {
        throw new Error(`Ollama 请求失败: ${response.status}`)
      }

      if (!onChunk) {
        const data = await response.json()
        return data.message?.content || ''
      }

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
          if (!line.trim()) continue
          const parsed = JSON.parse(line)
          const delta = parsed.message?.content || ''
          fullText += delta
          if (delta) onChunk(delta, fullText)
        }
      }

      return fullText
    } finally {
      clear()
    }
  }

  static async generateSummary(content, onChunk = null) {
    return this.chatCompletion([
      {
        role: 'system',
        content: '你是一个擅长知识提炼的 AI 助手。请用简洁中文总结以下文档内容。',
      },
      {
        role: 'user',
        content: String(content || '').slice(0, 10000),
      },
    ], onChunk)
  }

  static async polishText(text, instruction, onChunk = null) {
    return this.chatCompletion([
      {
        role: 'system',
        content: `你是一个专业文字编辑。请根据指令处理文本，直接返回处理后的结果。指令：${instruction}`,
      },
      {
        role: 'user',
        content: text,
      },
    ], onChunk)
  }
}
```

`getAiSettings()` 需要替换成你项目里的配置读取方法。

## 5. 编辑器 AI 用法

编辑器层不直接写 fetch，只调用 `AIService`。

### 5.1 AI 帮写

```js
const AI_WRITE_SYSTEM_PROMPT =
  '你是一个专业的文档撰写助手。请根据用户提供的标题，撰写一篇完整、结构清晰的 Markdown 文档。直接返回 Markdown 内容。'

async function aiWrite({ title, editor, setContent, saveDocument }) {
  const abortController = new AbortController()

  const fullText = await AIService.chatCompletion(
    [
      { role: 'system', content: AI_WRITE_SYSTEM_PROMPT },
      { role: 'user', content: `标题：${title}` },
    ],
    (_delta, fullText) => {
      setContent(fullText)
      editor?.commands?.setContent(fullText)
    },
    null,
    { signal: abortController.signal },
  )

  await saveDocument({ title, content: fullText })

  return {
    fullText,
    stop: () => abortController.abort(),
  }
}
```

实际产品中，建议把 `abortController` 放到组件状态里，这样“停止生成”按钮可以调用：

```js
abortController.abort()
```

### 5.2 AI 润色

```js
async function polishSelectedText(editor) {
  const { empty, from, to } = editor.state.selection
  if (empty) throw new Error('请先选中文本')

  const selectedText = editor.state.doc.textBetween(from, to, ' ')
  if (!selectedText.trim()) return

  const polishedText = await AIService.polishText(
    selectedText,
    '请润色并优化这段文字，使其更加通顺、专业，修正错别字。',
  )

  editor.chain().focus().insertContent(polishedText).run()
}
```

如果你不是 Tiptap 编辑器，只需要把“获取选中文本”和“替换选中文本”换成对应编辑器 API。

### 5.3 AI 总结

```js
async function summarizeDocument(content) {
  if (!content.trim()) throw new Error('文档内容为空')
  return AIService.generateSummary(content)
}
```

## 6. 对话页用法

对话页的核心是维护 `messages` 数组：

```js
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，有什么我可以帮你？' },
]
```

发送消息时：

```js
async function sendMessage(text) {
  messages.push({ role: 'user', content: text })
  messages.push({ role: 'assistant', content: '' })

  const assistantIndex = messages.length - 1
  const abortController = new AbortController()

  try {
    await AIService.chatCompletion(
      trimHistory(messages),
      (_delta, fullText) => {
        messages[assistantIndex].content = fullText
      },
      null,
      { signal: abortController.signal },
    )
  } catch (error) {
    if (error.name !== 'AbortError') {
      messages[assistantIndex].content += `\n\n**[异常: ${error.message || '请求失败'}]**`
    }
  }

  return {
    stop: () => abortController.abort(),
  }
}
```

历史裁剪建议保留最近消息，避免上下文过长：

```js
function trimHistory(messages) {
  const selected = []
  let tokenCount = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const tokens = Math.ceil((msg.content || '').length / 2)
    if (tokenCount + tokens > 3000 && selected.length > 0) break
    selected.unshift(msg)
    tokenCount += tokens
  }

  return selected
}
```

## 7. 浏览器本地模型：WebLLM / Transformers.js

本项目的本地 AI 思路是：优先用 WebLLM 走 GPU/WebGPU；如果浏览器或硬件不支持 WebGPU，则用 Transformers.js 走 CPU/WASM。这样可以做到“模型在浏览器里运行，文本不发到远程服务器”。

### 7.1 安装依赖

```bash
npm install @mlc-ai/web-llm @xenova/transformers
```

注意：

- WebLLM 首次运行会下载模型权重，适合现代 Chromium 浏览器和支持 WebGPU 的显卡。
- Transformers.js CPU/WASM 模式兼容性更好，但速度更慢。
- 权重会进入浏览器缓存，首次加载慢，后续会快很多。

### 7.2 推荐配置项

```js
const localAiSettings = {
  aiEngine: 'local',
  localAiType: 'gpu', // gpu | cpu
  localModelId: 'SmolLM2-135M-Instruct-q0f32-MLC',
  localCpuModelId: 'Xenova/Qwen1.5-0.5B-Chat',
}
```

推荐先用小模型验证流程：

- WebLLM GPU：`SmolLM2-135M-Instruct-q0f32-MLC`
- WebLLM GPU：`Llama-3.2-1B-Instruct-q4f16_1-MLC`
- Transformers.js CPU：`Xenova/Qwen1.5-0.5B-Chat`
- Transformers.js CPU：`Xenova/TinyLlama-1.1B-Chat-v1.0`

### 7.3 WebGPU 支持检测

```js
export async function checkWebGPUSupport() {
  if (!navigator.gpu) {
    return { supported: false, message: '您的浏览器不支持 WebGPU。' }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })

    if (!adapter) {
      return {
        supported: false,
        message: '未能找到支持 WebGPU 的显卡设备。',
      }
    }

    return { supported: true, message: '支持 WebGPU。' }
  } catch (err) {
    return {
      supported: false,
      message: `WebGPU 初始化失败: ${err.message}`,
    }
  }
}
```

设置页可以根据检测结果禁用 GPU 模式，并提示用户切换到 CPU 模式。

### 7.4 LocalAIService 完整结构

这个服务负责延迟加载 WebLLM / Transformers.js，避免首屏 bundle 过大。

```js
let webllm = null
let transformersPipeline = null
let transformersEnv = null

async function getWebLLM() {
  if (webllm) return webllm
  webllm = await import('@mlc-ai/web-llm')
  return webllm
}

async function initTransformersEnv() {
  if (transformersEnv) return transformersEnv

  const mod = await import('@xenova/transformers')
  transformersEnv = mod.env
  transformersEnv.allowLocalModels = true
  transformersEnv.allowRemoteModels = true
  transformersEnv.useBrowserCache = true
  transformersEnv.localModelPath = `${import.meta.env.BASE_URL}models/`
  transformersEnv.fetch_options = { credentials: 'omit' }

  return transformersEnv
}

async function getPipeline() {
  if (transformersPipeline) return transformersPipeline

  const mod = await import('@xenova/transformers')
  transformersPipeline = mod.pipeline
  await initTransformersEnv()

  return transformersPipeline
}

export class LocalAIService {
  constructor() {
    this.engine = null
    this.pipeline = null
    this.loading = false
    this.progress = 0
    this.statusText = ''
    this.currentType = null
  }

  async getEngine(modelId, type = 'gpu', onProgress) {
    if (this.currentType === type) {
      if (type === 'gpu' && this.engine) return this.engine
      if (type === 'cpu' && this.pipeline) return this.pipeline
    }

    if (this.loading) {
      throw new Error('模型正在加载中，请稍候...')
    }

    this.loading = true
    this.currentType = type
    this.progress = 0
    this.statusText = '准备加载...'

    try {
      if (type === 'gpu') {
        this.pipeline = null

        const wllm = await getWebLLM()
        this.engine = new wllm.MLCEngine()

        this.engine.setInitProgressCallback((report) => {
          this.progress = Math.round(report.progress * 100)
          this.statusText = report.text
          onProgress?.({
            progress: this.progress,
            statusText: this.statusText,
          })
        })

        await this.engine.reload(modelId)
        return this.engine
      }

      this.engine = null
      this.statusText = '正在初始化 CPU 文本生成管道...'

      const pipeline = await getPipeline()
      this.pipeline = await pipeline('text-generation', modelId, {
        progress_callback: (report) => {
          if (report.status === 'progress') {
            this.progress = Math.round(report.progress)
            this.statusText = `正在下载权重: ${report.file} (${this.progress}%)`
            onProgress?.({
              progress: this.progress,
              statusText: this.statusText,
            })
          } else if (report.status === 'done') {
            this.statusText = `加载完成: ${report.file}`
          }
        },
      })

      this.statusText = 'CPU 模型加载成功'
      return this.pipeline
    } finally {
      this.loading = false
    }
  }

  async chatCompletion(modelId, type, messages, onChunk = null, onProgress = null) {
    const instance = await this.getEngine(modelId, type, onProgress)

    if (type === 'gpu') {
      const completion = await instance.chat.completions.create({
        messages,
        stream: !!onChunk,
      })

      if (!onChunk) {
        return completion.choices[0].message.content || ''
      }

      let fullText = ''
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        fullText += delta
        if (delta) onChunk(delta, fullText)
      }
      return fullText
    }

    const prompt =
      messages
        .map((message) => {
          if (message.role === 'system') return `System: ${message.content}\n`
          if (message.role === 'user') return `User: ${message.content}\n`
          return `Assistant: ${message.content}\n`
        })
        .join('') + 'Assistant: '

    const output = await instance(prompt, {
      max_new_tokens: 512,
      temperature: 0.7,
      do_sample: true,
    })

    const fullText = output[0].generated_text.slice(prompt.length)
    if (onChunk) onChunk(fullText, fullText)
    return fullText
  }
}

export const localAiService = new LocalAIService()
```

### 7.5 接入 AIService

在 `AIService.chatCompletion` 里加一个 local 分支：

```js
import { localAiService } from './localAi'

static async chatCompletion(messages, onChunk = null, onProgress = null, options = {}) {
  const configs = this.getConfigs()

  if (configs.aiEngine === 'local') {
    return localAiService.chatCompletion(
      configs.localModelId,
      configs.localAiType,
      messages,
      onChunk,
      onProgress,
    )
  }

  // ollama / online...
}
```

`getConfigs()` 里补 local 配置：

```js
if (settings.aiEngine === 'local') {
  const localAiType = settings.localAiType || 'gpu'
  const localModelId =
    localAiType === 'gpu'
      ? settings.localModelId
      : settings.localCpuModelId

  return {
    aiEngine: 'local',
    localAiType,
    localModelId,
  }
}
```

### 7.6 设置页初始化和测试

```js
const loadingLocal = ref(false)
const localAiProgress = ref(0)
const localAiStatus = ref('')

async function initLocalModel() {
  loadingLocal.value = true

  try {
    await localAiService.getEngine(
      settings.localAiType === 'gpu'
        ? settings.localModelId
        : settings.localCpuModelId,
      settings.localAiType,
      (report) => {
        localAiProgress.value = report.progress
        localAiStatus.value = report.statusText
      },
    )

    ElMessage.success('本地模型加载成功')
  } catch (err) {
    ElMessage.error(`模型加载失败: ${err.message}`)
  } finally {
    loadingLocal.value = false
  }
}

async function testLocalModel() {
  const type = settings.localAiType
  const modelId = type === 'gpu'
    ? settings.localModelId
    : settings.localCpuModelId

  const reply = await localAiService.chatCompletion(modelId, type, [
    { role: 'user', content: '请返回一条简短回复，确认本地模型可用。' },
  ])

  ElMessage.success(`本地模型测试成功：${reply.slice(0, 80)}`)
}
```

进度条 UI 可以绑定：

```vue
<el-progress :percentage="localAiProgress" />
<span>{{ localAiStatus }}</span>
```

### 7.7 本地模型的限制

- WebLLM 依赖 WebGPU，不是所有浏览器都支持。
- 首次下载模型可能需要几十 MB 到数 GB。
- Transformers.js CPU 模式速度较慢，更适合短文本、轻量模型和兜底体验。
- 前端本地模型没有服务端并发能力，每个用户都要在自己的设备上加载模型。
- 本地模型更适合隐私优先、离线辅助、简单问答、轻量总结，不适合复杂长文生成。

### 7.8 本地模式的价值

- 数据不出浏览器。
- 没有 API Key 成本。
- 可作为在线 API 不可用时的备用引擎。
- 适合私有知识库、个人笔记、内网工具、离线演示。

## 8. Ollama 注意事项

前端直连 Ollama 时，经常遇到 CORS 问题。需要给 Ollama 设置跨域：

```bash
OLLAMA_ORIGINS=*
```

然后重启 Ollama。

常用接口：

```text
GET  /api/tags      获取模型列表
POST /api/chat      聊天补全
```

`/api/chat` 返回 NDJSON 流，不是 OpenAI 的 SSE 格式，所以要单独解析。

## 9. 迁移步骤

1. 拷贝 `AIService` 到目标项目。
2. 实现 `getAiSettings()` 或接入项目自己的设置 Store。
3. 在设置页提供 Base URL、API Key、模型名、AI 引擎选项。
4. 在编辑器中接入 `AIService.polishText`、`AIService.generateSummary`。
5. 在帮写和对话场景中使用 `chatCompletion(messages, onChunk, null, { signal })`。
6. 用 `AbortController` 实现停止生成。
7. 给错误提示做统一展示。

## 10. 最小可用版本

如果只想快速接入在线 OpenAI 兼容 API，最小版本只需要：

```js
export async function streamChat({ baseUrl, apiKey, model, messages, onChunk, signal }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const data = JSON.parse(line.slice(6))
        const delta = data.choices[0]?.delta?.content || ''
        fullText += delta
        onChunk?.(delta, fullText)
      }
    }
  }

  return fullText
}
```

调用：

```js
const controller = new AbortController()

await streamChat({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '你的 API Key',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: '帮我写一个项目计划' }],
  signal: controller.signal,
  onChunk: (_delta, fullText) => {
    console.log(fullText)
  },
})

// 停止生成
controller.abort()
```

## 11. 关键经验

- 页面不要直接写多套 fetch，把差异集中到 `AIService`。
- 流式输出统一使用 `onChunk(delta, fullText)`，调用方会非常简单。
- 停止生成统一使用 `AbortController`。
- 在线 API 是 SSE，Ollama 是 NDJSON，解析逻辑不能混用。
- WebLLM 走 WebGPU，Transformers.js 可作为 CPU/WASM 兜底。
- 编辑器 AI 功能要做成 composable 或 service，不要堆在页面组件里。
- API Key 放前端只适合个人工具或内网工具；公开产品建议走后端代理。
