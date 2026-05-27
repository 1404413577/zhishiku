<template>
  <div class="editor-page" :class="{ 'preview-only': !isEditing }">
    <!-- 预览区阅读进度条 -->
    <div v-show="!isEditing" class="reading-progress-bar" :style="{ width: readingProgress + '%' }"></div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
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
      </div>
      
      <div class="toolbar-right">
        <el-button
          @click="toggleEditMode"
          :type="isEditing ? 'primary' : 'default'"
          :icon="Edit"
          size="small"
          plain
        >
          {{ isEditing ? '编辑模式' : '预览模式' }}
        </el-button>

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
    <div class="tags-section">
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

    <!-- 编辑器区域 -->
    <div class="editor-container">
      <!-- 左侧编辑器 -->
      <div v-show="isEditing" class="editor-panel">
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
      <div v-show="!isEditing" ref="previewRef" class="preview-panel">
        <el-scrollbar class="content-scrollbar" @scroll="handlePreviewScroll">
          <div 
            class="markdown-preview markdown-body" 
            v-html="renderedContent"
            @click="handlePreviewClick"
          ></div>
        </el-scrollbar>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span>字符数: {{ documentContent.length }}</span>
      <span>行数: {{ lineCount }}</span>
      <span v-if="lastSaved">最后保存: {{ formatTime(lastSaved) }}</span>
    </div>
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
import { Document, Plus, Edit, Reading, ArrowLeft, MagicStick } from '@element-plus/icons-vue'

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
const isEditing = ref(true) // 控制编辑/预览模式
const saving = ref(false)
const lastSaved = ref(null)
const titleInputRef = ref(null)
const readingProgress = ref(0) // 预览区阅读进度

// 标签输入
const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref(null)

// 编辑器引用
const previewRef = ref(null) 

const aiLoading = ref(false)

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
        // 关键：确保这里的 key 'excalidraw' 与 ExcalidrawExtension 的 name 一致
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
                    // 渲染为能被 Tiptap 或 Viewer 识别的格式
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
    // 同步到 documentContent
    const markdown = editor.storage.markdown.getMarkdown()
    if (documentContent.value !== markdown) {
      documentContent.value = markdown
      handleContentChange()
    }
    // 处理刚输入或粘帖进来的图片
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

// 计算属性
const renderedContent = computed(() => {
  return markdownProcessor.render(documentContent.value)
})

const lineCount = computed(() => {
  return documentContent.value.split('\n').length
})

// 方法
const loadDocument = async () => {
  if (!documentId.value) {
    // 新文档
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
      
      // 更新 Tiptap 内容
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
      null // 这里暂时不使用流式输出，直接等待完整结果
    )
    
    // 替换选中的文本
    editor.value.chain().focus().insertContent(polishedText).run()
    ElMessage.success('润色完成')
  } catch (err) {
    ElMessage.error(err.message || 'AI 润色失败')
  } finally {
    aiLoading.value = false
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
      await saveDocument() // 强制保存当前文档以获取 ID
      if (!documentId.value) return // 保存失败
    }

    const mode = documentsStore.workspaceMode
    const handle = documentsStore.localDirHandle
    
    // 显示上传中提示 (这里简单用 ElMessage，也可做个局部 loading)
    const uploadMessage = ElMessage({
      message: '图片保存中...',
      type: 'info',
      duration: 0
    })

    const imagePath = await ImageService.saveImage(file, documentId.value, mode, handle)
    uploadMessage.close()
    
    // 如果保存成功，插入到编辑器光标位置
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
  // 清除之前的定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  // 设置新的自动保存定时器（3秒后保存）
  autoSaveTimer = setTimeout(() => {
    saveDocument()
  }, 3000)

  // 延迟渲染 Mermaid 和解析图片
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

const toggleEditMode = () => {
  isEditing.value = !isEditing.value
  if (!isEditing.value) {
    // 进入预览模式时，确保渲染
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

// 滚动同步 (仅在编辑模式下，且预览面板可见时)
const syncScroll = () => {
  // This function is for editor scroll, no longer directly syncing with previewRef
  // as preview now uses el-scrollbar and has its own scroll handler.
  // If a split view is re-introduced, this would need adjustment.
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

// 处理预览区点击（事件代理用于代码复制、复选框同步、双向链接等）
const handlePreviewClick = async (event) => {
  // 处理代码复制
  markdownProcessor.handleCopyClick(event)

  const target = event.target

  // 处理双向链接点击
  if (target && target.tagName === 'A' && target.classList.contains('obsidian-link')) {
    event.preventDefault()
    const docTitle = target.getAttribute('data-doc-title')
    if (!docTitle) return

    // 在 store 中按标题查找文档（模糊或精确匹配均可，这里用精确匹配）
    const allDocs = documentsStore.documents
    const targetDoc = allDocs.find(d => d.title === docTitle && !d.isFolder)

    if (targetDoc) {
      // 存在，则保存当前进度并跳转过去阅读
      handleContentChange() // 手动保存当前
      router.push(`/view/${encodeURIComponent(targetDoc.id)}`)
    } else {
      // 不存在，询问是否创建
      try {
        await ElMessageBox.confirm(
          `文档 "[[${docTitle}]]" 尚不存在，是否立即创建？`,
          '发现新链接',
          { confirmButtonText: '创建', cancelButtonText: '取消', type: 'info' }
        )
        // 创建新文档
        const newDoc = await documentsStore.createDocument(docTitle)
        router.push(`/editor/${encodeURIComponent(newDoc.id)}`)
      } catch (e) {
        // 用户取消创建
      }
    }
    return
  }

  // 处理待办事项复选框点击
  if (target && target.tagName === 'INPUT' && target.type === 'checkbox' && target.classList.contains('task-list-item-checkbox')) {
    const newMarkdown = markdownProcessor.syncCheckboxUpdate(documentContent.value, target)
    if (newMarkdown !== null) {
      documentContent.value = newMarkdown
      // 触发自动保存
      handleContentChange()
    } else {
      // 还原 checkbox 状态，因为同步失败
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
    }
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
    AIService.generateSummary(content, (chunk, fullText) => {
      // 流式更新在 ElMessageBox 中无法实时显示，使用 loading 等待
    }).then((summary) => {
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

  // 设置编辑模式
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

  // 退出编辑模式
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
}

/* Removed split-view class as it's now controlled by v-show */
/* .editor-container.split-view .editor-panel {
  width: 50%;
  border-right: 1px solid #e0e0e0;
} */

.editor-panel {
  flex: 1; /* Occupy full width when visible */
  display: flex;
  flex-direction: column;
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

.preview-panel {
  flex: 1; /* Occupy full width when visible */
  background: var(--el-bg-color);
  overflow: hidden; /* el-scrollbar handles its own overflow */
}

.markdown-preview {
  padding: 40px;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
  /* height: 100%; el-scrollbar handles height */
  /* overflow-y: auto; el-scrollbar handles overflow */
}

.status-bar {
  padding: 8px 20px;
  background: #f0f0f0;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
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
  .editor-container.split-view {
    flex-direction: column;
  }
  
  .editor-container.split-view .editor-panel {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .preview-panel {
    width: 100%;
    height: 50%;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 10px;
  }
  
  .title-input {
    width: 100%;
  }
}

/* 工具栏布局 */
.toolbar-right {
  display: flex;
  gap: 8px;
}
/* Excalidraw 渲染容器样式 (Viewer 模式) */
:deep(.excalidraw-render-container) {
  margin: 1.5rem 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff; /* Excalidraw 默认背景 */
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
