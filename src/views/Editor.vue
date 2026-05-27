<template>
  <div class="editor-page" :class="{
    'preview-only': editorMode === 'preview',
    'split-view': editorMode === 'split',
    'focus-mode': isFocusMode
  }">
    <!-- 预览区阅读进度条 -->
    <div v-show="editorMode === 'preview'" class="reading-progress-bar" :style="{ width: readingProgress + '%' }"></div>

    <!-- 工具栏 -->
    <div class="toolbar" v-show="!isFocusMode">
      <div class="toolbar-left">
        <el-button
          v-if="canGoBack"
          circle
          size="small"
          :icon="ArrowLeft"
          @click="goBack"
          title="返回"
          style="margin-right: 8px;"
        />
        <el-input
          v-model="documentTitle"
          placeholder="文档标题"
          class="title-input"
          @blur="saveDocument"
          ref="titleInputRef"
        />
        <el-button
          type="primary"
          @click="saveDocument"
          :loading="saving"
          :icon="Document"
          size="small"
          round
        >
          保存
        </el-button>
        <el-button
          type="success"
          :icon="MagicStick"
          @click="handleAIWrite"
          :loading="aiWritingLoading"
          size="small"
          round
        >
          AI帮写
        </el-button>
      </div>

      <div class="toolbar-right">
        <el-button
          @click="toggleTablePicker"
          :icon="Grid"
          size="small"
          plain
          title="插入表格"
        >
          表格
        </el-button>

        <el-button
          @click="cycleEditorMode"
          :type="editorMode !== 'preview' ? 'primary' : 'default'"
          :icon="editorMode === 'split' ? View : editorMode === 'preview' ? Reading : Edit"
          size="small"
          plain
        >
          {{ editorMode === 'edit' ? '编辑模式' : editorMode === 'split' ? '分屏模式' : '预览模式' }}
        </el-button>

        <el-button
          @click="toggleFocusMode"
          :icon="FullScreen"
          size="small"
          plain
          title="专注模式 (Ctrl+Shift+F)"
        />

        <el-button
          @click="$router.push(`/view/${documentId}`)"
          :icon="Reading"
          size="small"
          plain
        >
          查看
        </el-button>
      </div>
    </div>

    <!-- 标签编辑 -->
    <div class="tags-section" v-show="!isFocusMode">
      <el-tag
        v-for="tag in documentTags"
        :key="tag"
        closable
        @close="removeTag(tag)"
        class="tag-item"
      >
        {{ tag }}
      </el-tag>

      <el-input
        v-if="inputVisible"
        ref="inputRef"
        v-model="inputValue"
        size="small"
        class="tag-input"
        @keyup.enter="handleInputConfirm"
        @blur="handleInputConfirm"
      />

      <el-button
        v-else
        size="small"
        @click="showInput"
        :icon="Plus"
        text
        bg
      >
        添加标签
      </el-button>
    </div>

    <!-- 编辑器 + 预览 + TOC 区域 -->
    <div class="editor-container">
      <!-- 左侧编辑器 -->
      <div v-show="editorMode !== 'preview'" class="editor-panel" :class="{ split: editorMode === 'split' }">
        <editor-content
          v-if="editor"
          :editor="editor"
          class="tiptap-editor"
        />

        <floating-menu v-if="editor" :editor="editor" :tippy-options="{ duration: 100 }" class="floating-menu">
          <el-button-group>
            <el-button size="small" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :type="editor.isActive('heading', { level: 1 }) ? 'primary' : 'default'">H1</el-button>
            <el-button size="small" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :type="editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'">H2</el-button>
            <el-button size="small" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :type="editor.isActive('heading', { level: 3 }) ? 'primary' : 'default'">H3</el-button>
            <el-button size="small" @click="editor.chain().focus().toggleBulletList().run()" :type="editor.isActive('bulletList') ? 'primary' : 'default'">
              列表
            </el-button>
            <el-button size="small" @click="editor.chain().focus().toggleTaskList().run()" :type="editor.isActive('taskList') ? 'primary' : 'default'">
              待办
            </el-button>
            <el-button size="small" @click="editor.chain().focus().toggleCodeBlock().run()" :type="editor.isActive('codeBlock') ? 'primary' : 'default'">
              代码
            </el-button>
          </el-button-group>
        </floating-menu>

        <bubble-menu v-if="editor" :editor="editor" :tippy-options="{ duration: 100 }" class="bubble-menu">
          <el-button-group>
            <el-button size="small" @click="editor.chain().focus().toggleBold().run()" :type="editor.isActive('bold') ? 'primary' : 'default'"><b>B</b></el-button>
            <el-button size="small" @click="editor.chain().focus().toggleItalic().run()" :type="editor.isActive('italic') ? 'primary' : 'default'"><i>I</i></el-button>
            <el-button size="small" @click="editor.chain().focus().toggleStrike().run()" :type="editor.isActive('strike') ? 'primary' : 'default'"><s>S</s></el-button>
            <el-button size="small" @click="editor.chain().focus().toggleCode().run()" :type="editor.isActive('code') ? 'primary' : 'default'"><code>&lt;&gt;</code></el-button>
            <el-button size="small" @click="handleAIPolish" :loading="aiLoading" type="success" :icon="MagicStick">润色</el-button>
          </el-button-group>
        </bubble-menu>
      </div>

      <!-- 右侧预览区 -->
      <div v-show="editorMode !== 'edit'" ref="previewRef" class="preview-panel" :class="{ split: editorMode === 'split' }" @scroll="handleTocScroll">
        <el-scrollbar class="content-scrollbar" @scroll="handlePreviewScroll">
          <div
            class="markdown-preview markdown-body"
            v-html="renderedContent"
            @click="handlePreviewClick"
          ></div>
        </el-scrollbar>
      </div>

      <!-- TOC 侧边栏 -->
      <div v-if="tocHeadings.length > 0 && !isFocusMode" class="toc-sidebar">
        <div class="toc-title">目录</div>
        <div class="toc-list">
          <div
            v-for="(h, i) in tocHeadings"
            :key="i"
            :class="['toc-item', `toc-level-${h.level}`, { active: i === tocActiveIndex }]"
            @click="scrollToHeading(h)"
          >
            {{ h.text }}
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar" v-show="!isFocusMode">
      <span>字符数: {{ documentContent.length }}</span>
      <span>行数: {{ lineCount }}</span>
      <span v-if="estimatedReadTime > 0">预计阅读: {{ estimatedReadTime }}</span>
      <span v-if="lastSaved">最后保存: {{ formatTime(lastSaved) }}</span>
    </div>

    <!-- 专注模式退出按钮 -->
    <div v-if="isFocusMode" class="focus-exit-bar" @click="toggleFocusMode">
      <el-icon><Close /></el-icon>
      <span>退出专注模式 (Esc)</span>
    </div>

    <!-- 表格插入选择器 -->
    <teleport to="body">
      <div v-if="showTablePicker" class="table-picker-overlay" @click="showTablePicker = false">
        <div class="table-picker-popover" @click.stop>
          <div class="table-picker-label">{{ tablePickerRows }} x {{ tablePickerCols }} 表格</div>
          <div class="table-picker-grid">
            <div v-for="row in 8" :key="row" class="table-picker-row">
              <div
                v-for="col in 8"
                :key="col"
                :class="['table-picker-cell', { active: row <= tablePickerRows && col <= tablePickerCols }]"
                @mouseenter="tablePickerRows = row; tablePickerCols = col"
                @click="insertTable"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentsStore } from '@/stores/documents.js'
import { markdownProcessor } from '@/utils/markdown.js'
import { AIService } from '@/services/ai.js'
import { ImageService } from '@/services/image.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Plus, Edit, Reading, ArrowLeft, MagicStick, Grid, View, FullScreen, Close } from '@element-plus/icons-vue'

// Tiptap imports
import { EditorContent, useEditor, mergeAttributes } from '@tiptap/vue-3'
import { FloatingMenu, BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { Commands, suggestionConfig } from '@/utils/suggestion.js'
import { ExcalidrawExtension } from '@/utils/excalidrawExtension.js'
import { Markdown } from 'tiptap-markdown'

// Excalidraw 样式
import '@excalidraw/excalidraw/index.css'

const route = useRoute()
const router = useRouter()
const documentsStore = useDocumentsStore()

const canGoBack = computed(() => window.history.length > 1)
const goBack = () => {
  router.back()
}

// 响应式数据
const documentId = ref(route.params.id)
const documentTitle = ref('')
const documentContent = ref('')
const documentTags = ref([])
const editorMode = ref('edit') // 'edit' | 'split' | 'preview'
const isFocusMode = ref(false)
const saving = ref(false)
const lastSaved = ref(null)
const titleInputRef = ref(null)
const readingProgress = ref(0)

// 标签输入
const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref(null)

// 编辑器引用
const previewRef = ref(null)

const aiLoading = ref(false)
const aiWritingLoading = ref(false)

// TOC
const tocActiveIndex = ref(0)

// 表格选择器
const showTablePicker = ref(false)
const tablePickerRows = ref(3)
const tablePickerCols = ref(3)

// 自定义支持异步加载的 Tiptap 图片扩展
const LazyImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const { src, ...rest } = HTMLAttributes
    const isLazy = src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')

    return ['img', mergeAttributes(this.options.HTMLAttributes, rest, {
      src: isLazy ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : src,
      'data-src': isLazy ? src : null,
      class: isLazy ? 'zhishiku-lazy-image' : null
    })]
  }
})

// 自动保存定时器
let autoSaveTimer = null

// Tiptap 实例
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    ExcalidrawExtension,
    Markdown.configure({
      html: true,
      transformPastedText: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
      nodes: {
        excalidraw: {
          serialize: (state, node) => {
            state.write('```excalidraw\n')
            state.write(node.attrs.data || '')
            state.write('\n```')
            state.closeBlock(node)
          },
          parse: {
            setup(markdownit) {
              markdownit.use((md) => {
                const defaultRender = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
                  return self.renderToken(tokens, idx, options)
                }
                md.renderer.rules.fence = (tokens, idx, options, env, self) => {
                  const token = tokens[idx]
                  if (token.info === 'excalidraw') {
                    return `<div data-type="excalidraw" data-data="${md.utils.escapeHtml(token.content)}"></div>`
                  }
                  return defaultRender(tokens, idx, options, env, self)
                }
              })
            },
            updateDOM(dom) {
              if (dom.getAttribute('data-type') === 'excalidraw') {
                return {
                  type: 'excalidraw',
                  attrs: {
                    data: dom.getAttribute('data-data')
                  }
                }
              }
            }
          }
        }
      }
    }),
    Placeholder.configure({
      placeholder: '开始编写您的内容... (输入 / 唤出快捷菜单)'
    }),
    TaskList,
    TaskItem.configure({
      nested: true
    }),
    LazyImage.configure({
      inline: false,
      allowBase64: true
    }),
    Commands.configure({
      suggestion: suggestionConfig,
    }),
  ],
  editorProps: {
    handlePaste(view, event, slice) {
      const items = event.clipboardData?.items
      if (!items) return false

      let hasImage = false
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          if (file) {
            hasImage = true
            handleImageUpload(file)
          }
        }
      }
      return hasImage
    }
  },
  onUpdate: ({ editor }) => {
    const markdown = editor.storage.markdown.getMarkdown()
    if (documentContent.value !== markdown) {
      documentContent.value = markdown
      handleContentChange()
    }
    nextTick(() => {
      resolveEditorImages()
    })
  }
})

// 解析编辑器内的懒加载图片
const resolveEditorImages = async () => {
  if (editor.value && editor.value.view.dom) {
    await markdownProcessor.resolveLazyImages(
      editor.value.view.dom,
      documentId.value,
      documentsStore.workspaceMode,
      documentsStore.localDirHandle
    )
  }
}

// TOC 标题提取
const tocHeadings = computed(() => {
  const content = documentContent.value
  if (!content) return []
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const headings = []
  let match
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const anchor = text
      .toLowerCase()
      .replace(/[^\w一-龥\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    headings.push({ level, text, anchor })
  }
  return headings
})

// 计算属性
const renderedContent = computed(() => {
  return markdownProcessor.render(documentContent.value)
})

const lineCount = computed(() => {
  return documentContent.value.split('\n').length
})

const estimatedReadTime = computed(() => {
  const len = documentContent.value.length
  if (len === 0) return 0
  // 中文阅读速度约 400字/分钟
  const minutes = Math.ceil(len / 400)
  return minutes <= 1 ? '1 分钟' : `${minutes} 分钟`
})

// 方法
const loadDocument = async () => {
  if (!documentId.value) {
    documentTitle.value = '新文档'
    documentContent.value = ''
    documentTags.value = []
    return
  }

  try {
    const doc = await documentsStore.getDocument(documentId.value)
    if (doc) {
      documentTitle.value = doc.title
      documentContent.value = doc.content || ''
      documentTags.value = doc.tags || []

      if (editor.value) {
        editor.value.commands.setContent(documentContent.value)
        nextTick(() => {
          resolveEditorImages()
        })
      }
    }
  } catch (error) {
    ElMessage.error('加载文档失败')
    router.push('/')
  }
}

const handleAIPolish = async () => {
  if (!editor.value) return

  const { empty, from, to } = editor.value.state.selection
  if (empty) {
    ElMessage.warning('请先选中文本')
    return
  }

  const selectedText = editor.value.state.doc.textBetween(from, to, ' ')
  if (!selectedText.trim()) return

  aiLoading.value = true
  try {
    const polishedText = await AIService.polishText(
      selectedText,
      '请润色并优化这段文字，使其更加通顺、专业，修正错别字。',
      null
    )

    editor.value.chain().focus().insertContent(polishedText).run()
    ElMessage.success('润色完成')
  } catch (err) {
    ElMessage.error(err.message || 'AI 润色失败')
  } finally {
    aiLoading.value = false
  }
}

// AI 帮写
const handleAIWrite = async () => {
  const currentContent = editor.value?.storage.markdown.getMarkdown() || ''
  if (currentContent.trim()) {
    try {
      await ElMessageBox.confirm(
        '当前文档已有内容，AI 帮写将覆盖现有内容，是否继续？',
        'AI 帮写',
        { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }

  try {
    const { value: title } = await ElMessageBox.prompt(
      '请输入文档标题，AI 将根据标题自动生成文档内容',
      'AI 帮写',
      { confirmButtonText: '开始生成', cancelButtonText: '取消', inputPlaceholder: '输入标题...' }
    )

    if (!title || !title.trim()) return

    documentTitle.value = title.trim()
    aiWritingLoading.value = true

    editor.value?.commands.setContent('')
    documentContent.value = ''

    const systemPrompt = `你是一个专业的文档撰写助手。请根据用户提供的标题，撰写一篇完整、结构清晰的Markdown文档。要求：
1. 使用适当的标题层级（##、###）
2. 包含段落、列表、代码块等丰富的内容结构
3. 内容专业、准确、有条理
4. 直接返回Markdown内容，不要包含"好的"、"以下是"等开头语`

    await AIService.chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `标题：${title}` }
      ],
      (_delta, fullText) => {
        editor.value?.commands.setContent(fullText)
        documentContent.value = fullText
      }
    )

    await saveDocument()
    ElMessage.success('AI 帮写完成')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || 'AI 帮写失败')
    }
  } finally {
    aiWritingLoading.value = false
  }
}

const saveDocument = async () => {
  if (saving.value) return

  saving.value = true
  try {
    const updates = {
      title: documentTitle.value,
      content: editor.value ? editor.value.storage.markdown.getMarkdown() : documentContent.value,
      tags: documentTags.value
    }

    if (documentId.value) {
      await documentsStore.saveDocument(documentId.value, updates)
    } else {
      const doc = await documentsStore.createDocument(documentTitle.value, documentContent.value)
      documentId.value = doc.id
      router.replace(`/editor/${doc.id}`)
    }

    lastSaved.value = new Date()
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleImageUpload = async (file) => {
  try {
    const defaultTitle = '未命名文档'
    if (!documentId.value) {
      if (!documentTitle.value || documentTitle.value === '新文档') {
        documentTitle.value = defaultTitle
      }
      await saveDocument()
      if (!documentId.value) return
    }

    const mode = documentsStore.workspaceMode
    const handle = documentsStore.localDirHandle

    const uploadMessage = ElMessage({
      message: '图片保存中...',
      type: 'info',
      duration: 0
    })

    const imagePath = await ImageService.saveImage(file, documentId.value, mode, handle)
    uploadMessage.close()

    if (editor.value && imagePath) {
      const markdownImage = `\n![](${imagePath})\n`
      editor.value.chain().focus().insertContent(markdownImage).run()
      ElMessage.success('图片粘帖成功')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('图片保存失败: ' + err.message)
  }
}

const handleContentChange = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  autoSaveTimer = setTimeout(() => {
    saveDocument()
  }, 3000)

  setTimeout(() => {
    markdownProcessor.renderMermaid()
    if (previewRef.value) {
      markdownProcessor.resolveLazyImages(
        previewRef.value,
        documentId.value,
        documentsStore.workspaceMode,
        documentsStore.localDirHandle
      )
    }
  }, 100)
}

// 编辑器模式切换 (edit → split → preview → edit)
const cycleEditorMode = () => {
  const modes = ['edit', 'split', 'preview']
  const idx = modes.indexOf(editorMode.value)
  editorMode.value = modes[(idx + 1) % 3]
  if (editorMode.value !== 'edit') {
    nextTick(() => {
      markdownProcessor.renderMermaid()
      if (previewRef.value) {
        markdownProcessor.resolveLazyImages(
          previewRef.value,
          documentId.value,
          documentsStore.workspaceMode,
          documentsStore.localDirHandle
        )
      }
    })
  }
}

// 专注模式
const toggleFocusMode = () => {
  isFocusMode.value = !isFocusMode.value
}

// 表格选择器
const toggleTablePicker = () => {
  if (!editor.value) return
  showTablePicker.value = !showTablePicker.value
  tablePickerRows.value = 3
  tablePickerCols.value = 3
}

const insertTable = () => {
  if (!editor.value) return
  const rows = tablePickerRows.value
  const cols = tablePickerCols.value

  // 构建 Markdown 表格
  let md = '\n'
  // 表头
  md += '|' + ' 列 |'.repeat(cols) + '\n'
  // 分隔行
  md += '|' + ' --- |'.repeat(cols) + '\n'
  // 数据行
  for (let i = 1; i < rows; i++) {
    md += '|' + '  |'.repeat(cols) + '\n'
  }

  editor.value.chain().focus().insertContent(md).run()
  showTablePicker.value = false
}

// TOC 导航
const scrollToHeading = (heading) => {
  if (editorMode.value !== 'edit') {
    // 在预览区查找并滚动
    const previewEl = previewRef.value
    if (!previewEl) return
    const allHeadings = previewEl.querySelectorAll('h1, h2, h3')
    for (const h of allHeadings) {
      if (h.textContent?.trim() === heading.text) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }
  // 在编辑器中查找
  if (editor.value) {
    const content = editor.value.storage.markdown.getMarkdown()
    const headingLine = new RegExp(`^#{1,3}\\s+${heading.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm')
    const match = content.match(headingLine)
    if (match) {
      const pos = match.index
      editor.value.commands.setTextSelection(Math.min(pos + 1, content.length))
      editor.value.commands.scrollIntoView()
    }
  }
}

const handleTocScroll = () => {
  if (editorMode.value === 'edit' || tocHeadings.value.length === 0) return

  const previewEl = previewRef.value
  if (!previewEl) return
  const allHeadings = previewEl.querySelectorAll('h1, h2, h3')
  if (allHeadings.length === 0) return

  const containerTop = previewEl.getBoundingClientRect().top
  let activeIndex = 0
  for (let i = 0; i < allHeadings.length; i++) {
    const rect = allHeadings[i].getBoundingClientRect()
    if (rect.top <= containerTop + 100) {
      activeIndex = i
    }
  }
  tocActiveIndex.value = activeIndex
}

// 标签管理
const removeTag = (tag) => {
  documentTags.value = documentTags.value.filter(t => t !== tag)
  saveDocument()
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value && !documentTags.value.includes(inputValue.value)) {
    documentTags.value.push(inputValue.value)
    saveDocument()
  }
  inputVisible.value = false
  inputValue.value = ''
}

const formatTime = (date) => {
  return date.toLocaleTimeString('zh-CN')
}

const handlePreviewScroll = ({ scrollTop }) => {
  const scrollWrap = document.querySelector('.preview-panel .el-scrollbar__wrap')
  if (!scrollWrap) return

  const scrollHeight = scrollWrap.scrollHeight
  const clientHeight = scrollWrap.clientHeight

  if (scrollHeight <= clientHeight) {
    readingProgress.value = 0
    return
  }

  const percent = (scrollTop / (scrollHeight - clientHeight)) * 100
  readingProgress.value = Math.min(100, Math.max(0, percent))
}

const handlePreviewClick = async (event) => {
  markdownProcessor.handleCopyClick(event)

  const target = event.target

  if (target && target.tagName === 'A' && target.classList.contains('obsidian-link')) {
    event.preventDefault()
    const docTitle = target.getAttribute('data-doc-title')
    if (!docTitle) return

    const allDocs = documentsStore.documents
    const targetDoc = allDocs.find(d => d.title === docTitle && !d.isFolder)

    if (targetDoc) {
      handleContentChange()
      router.push(`/view/${encodeURIComponent(targetDoc.id)}`)
    } else {
      try {
        await ElMessageBox.confirm(
          `文档 "[[${docTitle}]]" 尚不存在，是否立即创建？`,
          '发现新链接',
          { confirmButtonText: '创建', cancelButtonText: '取消', type: 'info' }
        )
        const newDoc = await documentsStore.createDocument(docTitle)
        router.push(`/editor/${encodeURIComponent(newDoc.id)}`)
      } catch (e) {
        // 用户取消创建
      }
    }
    return
  }

  if (target && target.tagName === 'INPUT' && target.type === 'checkbox' && target.classList.contains('task-list-item-checkbox')) {
    const newMarkdown = markdownProcessor.syncCheckboxUpdate(documentContent.value, target)
    if (newMarkdown !== null) {
      documentContent.value = newMarkdown
      handleContentChange()
    } else {
      target.checked = !target.checked
      ElMessage.warning('未能同步待办事项状态')
    }
  }
}

// 键盘快捷键
const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 's') {
      event.preventDefault()
      saveDocument()
    } else if (event.key === 'F' && event.shiftKey) {
      event.preventDefault()
      toggleFocusMode()
    }
  }

  if (event.key === 'Escape' && isFocusMode.value) {
    toggleFocusMode()
  }
}

// 斜杠命令 AI 动作处理
const handleEditorAiAction = (event) => {
  const { type } = event.detail
  if (type === 'summary') {
    const content = editor.value?.storage.markdown.getMarkdown() || ''
    if (!content.trim()) {
      ElMessage.warning('文档内容为空，无法生成总结')
      return
    }
    aiLoading.value = true
    AIService.generateSummary(content, (_chunk, _fullText) => {}).then((summary) => {
      ElMessageBox.alert(
        `<div class="markdown-body">${markdownProcessor.render(summary)}</div>`,
        'AI 总结',
        { dangerouslyUseHTMLString: true, confirmButtonText: '关闭' }
      )
    }).catch((err) => {
      ElMessage.error(err.message || 'AI 总结失败')
    }).finally(() => {
      aiLoading.value = false
    })
  } else if (type === 'polish') {
    handleAIPolish()
  }
}

// 生命周期
onMounted(async () => {
  await loadDocument()
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('editor-ai-action', handleEditorAiAction)

  documentsStore.setEditMode(true)

  setTimeout(() => {
    markdownProcessor.renderMermaid()
  }, 300)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('editor-ai-action', handleEditorAiAction)
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }

  documentsStore.setEditMode(false)
})

// 监听路由变化
watch(() => route.params.id, async (newId) => {
  documentId.value = newId
  await loadDocument()
})
</script>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: background 0.3s;
}

.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background-color: var(--el-color-primary);
  z-index: 9999;
  transition: width 0.1s ease-out;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f9f9f9;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.title-input {
  width: 300px;
}

.toolbar-right {
  display: flex;
  gap: 10px;
}

.tags-section {
  padding: 10px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tag-item {
  margin: 2px;
}

.tag-input {
  width: 100px;
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* ---- 编辑面板 ---- */
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-panel.split {
  flex: 0 0 50%;
  border-right: 1px solid var(--el-border-color-lighter);
}

.tiptap-editor {
  flex: 1;
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  font-size: var(--md-font-size, 16px);
  line-height: var(--md-line-height, 1.6);
}

.tiptap-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
}

.tiptap-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* 列表样式适配 */
.tiptap-editor :deep(ul.tight) {
  padding-left: 20px;
}
.tiptap-editor :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding: 0;
}
.tiptap-editor :deep(ul[data-type="taskList"] li) {
  display: flex;
  margin-bottom: 0.5rem;
}
.tiptap-editor :deep(ul[data-type="taskList"] li > label) {
  margin-right: 0.5rem;
  user-select: none;
}
.tiptap-editor :deep(ul[data-type="taskList"] li > div) {
  flex: 1;
}

/* 浮动菜单样式 */
.floating-menu, .bubble-menu {
  background: var(--el-bg-color);
  padding: 4px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--el-border-color-light);
}

/* ---- 预览面板 ---- */
.preview-panel {
  flex: 1;
  background: var(--el-bg-color);
  overflow: hidden;
}

.preview-panel.split {
  flex: 0 0 50%;
}

.markdown-preview {
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ---- TOC 侧边栏 ---- */
.toc-sidebar {
  width: 200px;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.toc-title {
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-extra-light);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.toc-item {
  padding: 5px 16px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all 0.15s;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc-item:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.toc-item.active {
  color: var(--el-color-primary);
  border-left-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.toc-level-1 { padding-left: 16px; font-weight: 600; }
.toc-level-2 { padding-left: 28px; }
.toc-level-3 { padding-left: 40px; font-size: 12px; }

.status-bar {
  padding: 8px 20px;
  background: #f0f0f0;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

/* ---- 专注模式 ---- */
.editor-page.focus-mode {
  background: var(--el-bg-color);
}

.focus-mode .editor-container {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.focus-mode .tiptap-editor {
  padding: 60px 40px;
}

.focus-exit-bar {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 20px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-top: none;
  border-radius: 0 0 8px 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.focus-exit-bar:hover {
  opacity: 1;
}

/* ---- 表格选择器 ---- */
.table-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.table-picker-popover {
  position: fixed;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.table-picker-label {
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.table-picker-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.table-picker-row {
  display: flex;
  gap: 2px;
}

.table-picker-cell {
  width: 24px;
  height: 24px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.1s;
}

.table-picker-cell.active {
  background: var(--el-color-primary-light-5);
  border-color: var(--el-color-primary);
}

/* Markdown 预览样式 */
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-preview :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 10px;
}

.markdown-preview :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 8px;
}

.markdown-preview :deep(code) {
  background: #f6f8fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 85%;
}

.markdown-preview :deep(pre) {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-preview :deep(blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 16px;
  color: #6a737d;
  margin: 16px 0;
}

.markdown-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid #dfe2e5;
  padding: 8px 12px;
  text-align: left;
}

.markdown-preview :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

@media (max-width: 768px) {
  .editor-panel.split {
    flex: 0 0 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .preview-panel.split {
    flex: 0 0 100%;
    height: 50%;
  }

  .toc-sidebar {
    display: none;
  }

  .toolbar {
    flex-direction: column;
    gap: 10px;
  }

  .title-input {
    width: 100%;
  }

  .editor-page.focus-mode .editor-container {
    max-width: 100%;
  }
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

:deep(.excalidraw-render-container) {
  margin: 1.5rem 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

:deep(.excalidraw-loading-placeholder) {
  padding: 40px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.render-error) {
  color: var(--el-color-danger);
  padding: 20px;
}
</style>
