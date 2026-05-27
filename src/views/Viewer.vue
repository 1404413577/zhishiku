<template>
  <div class="viewer-page" @scroll="handleScroll" ref="pageRef">
    <!-- 阅读进度条 -->
    <div class="reading-progress-bar" :style="{ width: readingProgress + '%' }"></div>

    <!-- 文档头部 -->
    <div class="document-header">
      <div class="header-left">
        <el-button
          v-if="canGoBack"
          circle
          size="small"
          :icon="ArrowLeft"
          @click="goBack"
          class="back-button"
          title="返回前一页"
        />
        <div class="header-content">
          <h1 class="document-title">{{ currentDoc?.title }}</h1>
          <div class="document-meta">
            <span class="meta-item">
              创建时间: {{ formatDate(currentDoc?.createdAt) }}
            </span>
            <span class="meta-item">
              更新时间: {{ formatDate(currentDoc?.updatedAt) }}
            </span>
          </div>
          <div class="document-tags" v-if="currentDoc?.tags && currentDoc.tags.length > 0">
            <el-tag
              v-for="tag in currentDoc.tags"
              :key="tag"
              type="info"
              size="small"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>
      
      <div class="header-actions">
        <el-button
          type="success"
          @click="generateSummary"
          :icon="MagicStick"
          size="small"
          round
        >
          AI 总结
        </el-button>

        <el-button
          type="primary"
          @click="editDocument"
          :icon="Edit"
          size="small"
          round
        >
          编辑
        </el-button>

        <el-button
          @click="exportDocument"
          :icon="Download"
          size="small"
          plain
        >
          导出
        </el-button>

        <el-button
          @click="shareDocument"
          :icon="Share"
          size="small"
          plain
        >
          分享
        </el-button>
      </div>
    </div>

    <!-- 目录面板 -->
    <div
      v-if="headings.length > 0"
      class="toc-panel"
      :class="{ 'toc-collapsed': tocCollapsed }"
    >
      <div class="toc-header">
        <h3>目录</h3>
        <el-button
          size="small"
          text
          @click="toggleToc"
          :icon="tocCollapsed ? Expand : Fold"
          :title="tocCollapsed ? '展开目录' : '折叠目录'"
          circle
        />
      </div>

      <div class="toc-content" v-show="!tocCollapsed">
        <ul class="toc-list" v-if="headings.length > 0">
          <li
            v-for="heading in headings"
            :key="heading.anchor"
            :class="[
              `toc-level-${heading.level}`,
              { 'toc-active': activeHeading === heading.anchor }
            ]"
            class="toc-item"
          >
            <a
              :href="`#${heading.anchor}`"
              @click.prevent="scrollToHeading(heading.anchor)"
              class="toc-link"
            >
              {{ heading.text }}
            </a>
          </li>
        </ul>

        <!-- 使用提示 -->
        <div class="toc-tip" v-if="headings.length > 0">
          <div class="tip-text">
            <el-icon><InfoFilled /></el-icon>
            快捷键: Ctrl+Shift+T
          </div>

          <!-- 开发环境调试按钮 -->
          <!-- <div v-if="isDev" class="debug-actions">
            <el-button size="small" @click="runTocDiagnosis">
              🔍 诊断目录
            </el-button>
          </div> -->
        </div>
      </div>
    </div>

    <!-- 文档内容区域 -->
    <div class="document-content-wrapper">
      <!-- 文档内容 -->
      <div class="document-content" :class="{ 'with-toc': headings.length > 0 }">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <el-skeleton :rows="8" animated />
        </div>

        <!-- 文档内容 -->
        <div
          v-else-if="currentDoc"
          class="markdown-content"
          v-html="renderedContent"
          @click="handleContentClick"
          ref="contentRef"
        />

        <!-- 空状态 -->
        <div v-else class="empty-container">
          <el-empty description="文档不存在" />
        </div>
      </div>
    </div>

    <!-- 返回顶部按钮 -->
    <el-backtop target=".viewer-page" />

    <!-- AI 总结抽屉 -->
    <el-drawer
      v-model="aiSummaryDrawerVisible"
      title="✨ AI 智能总结"
      direction="rtl"
      size="350px"
    >
      <div class="ai-summary-content" v-loading="aiSummaryLoading">
        <div v-if="aiSummaryContent" class="markdown-body" v-html="markdownProcessor.render(aiSummaryContent)"></div>
        <div v-else-if="aiSummaryLoading" class="loading-tips">
          正在思考中，请稍候...
        </div>
        <div v-else class="empty-tips">
          未能生成总结。
        </div>
      </div>
    </el-drawer>

    <!-- 分享对话框 -->
    <el-dialog
      v-model="shareDialogVisible"
      title="分享文档"
      width="500px"
    >
      <div class="share-content">
        <p>您可以通过以下方式分享此文档：</p>
        
        <el-form label-width="80px">
          <el-form-item label="链接">
            <el-input
              v-model="shareUrl"
              readonly
              class="share-input"
            >
              <template #append>
                <el-button @click="copyToClipboard(shareUrl)" size="small" type="primary">复制</el-button>
              </template>
            </el-input>
          </el-form-item>
          
          <el-form-item label="Markdown">
            <el-button @click="copyMarkdown" size="small" plain>复制 Markdown</el-button>
            <el-button @click="downloadMarkdown" size="small" plain>下载 .md 文件</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentsStore } from '@/stores/documents.js'
import { markdownProcessor } from '@/utils/markdown.js'
import { AIService } from '@/services/ai.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Download, Share, Expand, Fold, ArrowLeft, MagicStick } from '@element-plus/icons-vue'
import { saveAs } from 'file-saver'

// 在开发环境中引入调试工具
if (import.meta.env.DEV) {
  import('@/utils/tocDebug.js')
}

const route = useRoute()
const router = useRouter()
const documentsStore = useDocumentsStore()

const canGoBack = computed(() => window.history.length > 1)
const goBack = () => {
  router.back()
}

// 响应式数据
const currentDoc = ref(null)
const shareDialogVisible = ref(false)
const contentRef = ref(null)
const pageRef = ref(null)
const loading = ref(false)

const aiSummaryDrawerVisible = ref(false)
const aiSummaryContent = ref('')
const aiSummaryLoading = ref(false)

// 目录相关状态
const tocCollapsed = ref(false)
const activeHeading = ref('')
const headingObserver = ref(null)

// 阅读进度
const readingProgress = ref(0)

// 计算属性
const renderedContent = computed(() => {
  const content = currentDoc.value?.content || ''
  if (!content) return ''
  return markdownProcessor.render(content)
})

const headings = computed(() => {
  if (!currentDoc.value?.content) return []
  return markdownProcessor.extractHeadings(currentDoc.value.content)
})

const shareUrl = computed(() => {
  return `${window.location.origin}${window.location.pathname}#/view/${currentDoc.value?.id}`
})

// 开发环境标识
const isDev = computed(() => import.meta.env.DEV)

// 方法
const loadDocument = async () => {
  const documentId = route.params.id
  if (!documentId) {
    ElMessage.error('文档ID无效')
    router.push('/')
    return
  }

  loading.value = true
  try {
    const doc = await documentsStore.getDocument(documentId)
    if (doc) {
      currentDoc.value = doc
      // 设置页面标题（使用全局 window.document）
      window.document.title = `${doc.title} - 知识库`
    } else {
      ElMessage.error('文档不存在')
      router.push('/')
    }
  } catch (error) {
    console.error('加载文档失败:', error)
    ElMessage.error('加载文档失败')
    router.push('/')
  } finally {
    loading.value = false
  }
}

const generateSummary = async () => {
  if (!currentDoc.value || !currentDoc.value.content) {
    ElMessage.warning('文档内容为空')
    return
  }
  
  aiSummaryDrawerVisible.value = true
  aiSummaryContent.value = ''
  aiSummaryLoading.value = true
  
  try {
    const summary = await AIService.generateSummary(currentDoc.value.content, (chunk, fullText) => {
      aiSummaryLoading.value = false
      aiSummaryContent.value = fullText
    })
    aiSummaryContent.value = summary
  } catch (err) {
    ElMessage.error(err.message || 'AI 总结失败')
  } finally {
    aiSummaryLoading.value = false
  }
}

const editDocument = () => {
  if (!currentDoc.value) return
  router.push(`/editor/${currentDoc.value.id}`)
}

const exportDocument = () => {
  if (!currentDoc.value) return

  const content = `# ${currentDoc.value.title}\n\n${currentDoc.value.content}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, `${currentDoc.value.title}.md`)
  ElMessage.success('文档已导出')
}

const shareDocument = () => {
  shareDialogVisible.value = true
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const copyMarkdown = async () => {
  if (!currentDoc.value) return

  const content = `# ${currentDoc.value.title}\n\n${currentDoc.value.content}`
  await copyToClipboard(content)
}

const downloadMarkdown = () => {
  exportDocument()
  shareDialogVisible.value = false
}

// 处理内容区域点击（如代码复制、复选框同步、双向链接）
const handleContentClick = async (e) => {
  markdownProcessor.handleCopyClick(e)

  const target = e.target

  // 处理双向链接点击
  if (target && target.tagName === 'A' && target.classList.contains('obsidian-link')) {
    e.preventDefault()
    const docTitle = target.getAttribute('data-doc-title')
    if (!docTitle) return

    const allDocs = documentsStore.documents
    const targetDoc = allDocs.find(d => d.title === docTitle && !d.isFolder)

    if (targetDoc) {
      router.push(`/view/${encodeURIComponent(targetDoc.id)}`)
    } else {
      try {
        await ElMessageBox.confirm(
          `文档 "[[${docTitle}]]" 尚不存在，是否立即创建并跳转？`,
          '发现新链接',
          { confirmButtonText: '创建并前往', cancelButtonText: '取消', type: 'info' }
        )
        const newDoc = await documentsStore.createDocument(docTitle)
        router.push(`/editor/${encodeURIComponent(newDoc.id)}`)
      } catch (err) {
        // 取消
      }
    }
    return
  }
  
  // 处理待办事项复选框点击
  if (target && target.tagName === 'INPUT' && target.type === 'checkbox' && target.classList.contains('task-list-item-checkbox')) {
    if (!currentDoc.value || !currentDoc.value.content) return

    const newMarkdown = markdownProcessor.syncCheckboxUpdate(currentDoc.value.content, target)
    if (newMarkdown !== null) {
      try {
        currentDoc.value.content = newMarkdown
        await documentsStore.saveDocument(currentDoc.value.id, { content: newMarkdown })
      } catch (error) {
        console.error('Failed to save document:', error)
        target.checked = !target.checked // 还原状态
        ElMessage.error('无法保存待办状态更改')
      }
    } else {
      target.checked = !target.checked
      ElMessage.warning('未能同步待办事项状态')
    }
  }
}

// 获取最近的可滚动容器（垂直方向）
const getScrollContainer = (el) => {
  let node = el?.parentElement
  while (node && node !== document.body) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY)) return node
    node = node.parentElement
  }
  // 回退到 Element Plus 的 el-main 或 window
  return document.querySelector('.el-main') || window
}

const scrollToHeading = (anchor) => {
  const element = document.getElementById(anchor)
  if (!element) {
    // 调试输出
    console.error('❌ 未找到锚点元素:', anchor)
    return
  }

  const container = getScrollContainer(element)

  // 如果容器是 window，使用 window.scrollTo；否则使用容器.scrollTo
  const offset = 100 // 顶部预留空间，避免被顶部遮住
  if (container === window) {
    const rect = element.getBoundingClientRect()
    const top = window.pageYOffset + rect.top - offset
    window.scrollTo({ top, behavior: 'smooth' })
  } else {
    const elRect = element.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    const current = container.scrollTop
    const targetTop = current + (elRect.top - cRect.top) - offset
    container.scrollTo({ top: targetTop, behavior: 'smooth' })
  }

  // 更新活跃标题
  activeHeading.value = anchor
}

// 切换目录显示/隐藏
const toggleToc = () => {
  tocCollapsed.value = !tocCollapsed.value
  // 保存用户偏好
  localStorage.setItem('toc-collapsed', tocCollapsed.value.toString())
}

// 设置滚动监听，自动高亮当前查看的标题
const setupScrollSpy = () => {
  if (!contentRef.value) return

  // 清理之前的观察器
  if (headingObserver.value) {
    headingObserver.value.disconnect()
  }

  // 创建 Intersection Observer
  headingObserver.value = new IntersectionObserver(
    (entries) => {
      // 找到当前可见的标题
      const visibleHeadings = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => entry.target.id)
        .filter(id => id)

      if (visibleHeadings.length > 0) {
        // 选择第一个可见的标题作为活跃标题
        activeHeading.value = visibleHeadings[0]
      }
    },
    {
      rootMargin: '-20% 0px -70% 0px', // 在视口上方20%到下方70%的区域内触发
      threshold: 0
    }
  )

  // 观察所有标题元素
  const headingElements = contentRef.value.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headingElements.forEach(el => {
    if (el.id) {
      headingObserver.value.observe(el)
    }
  })
}

// 监听阅读进度
const handleScroll = (e) => {
  const target = e.target
  if (!target) return
  
  const scrollTop = target.scrollTop
  const scrollHeight = target.scrollHeight
  const clientHeight = target.clientHeight
  
  if (scrollHeight <= clientHeight) {
    readingProgress.value = 0
    return
  }
  
  const percent = (scrollTop / (scrollHeight - clientHeight)) * 100
  readingProgress.value = Math.min(100, Math.max(0, percent))
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

// 调试方法
// const runTocDiagnosis = () => {
//   if (window.tocDebug) {
//     window.tocDebug.fullDiagnosis()
//   } else {
//     console.log('调试工具未加载')
//   }
// }

// 键盘快捷键处理
const handleKeydown = (event) => {
  // Ctrl/Cmd + Shift + T: 切换目录显示
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
    event.preventDefault()
    toggleToc()
  }
}

// 生命周期
onMounted(async () => {
  await loadDocument()
  addHeadingIds()

  // 恢复目录折叠状态
  const savedTocState = localStorage.getItem('toc-collapsed')
  if (savedTocState !== null) {
    tocCollapsed.value = savedTocState === 'true'
  }

  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时清理观察器和事件监听
onUnmounted(() => {
  if (headingObserver.value) {
    headingObserver.value.disconnect()
  }
  document.removeEventListener('keydown', handleKeydown)
})

// 监听路由参数变化
watch(() => route.params.id, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    await loadDocument()
    // 延迟执行，确保DOM完全更新
    setTimeout(() => {
      addHeadingIds()
      markdownProcessor.renderExcalidraw()
    }, 200)
  }
}, { immediate: false })

// 监听文档内容变化，确保在内容更新后重新设置ID
watch(() => currentDoc.value, () => {
  if (currentDoc.value) {
    setTimeout(() => {
      addHeadingIds()
      markdownProcessor.renderMermaid()
      markdownProcessor.renderExcalidraw()
      if (contentRef.value) {
        markdownProcessor.resolveLazyImages(
          contentRef.value,
          currentDoc.value.id,
          documentsStore.workspaceMode,
          documentsStore.localDirHandle
        )
      }
    }, 100)
  }
}, { flush: 'post' })

// 为标题添加 ID 的辅助函数（按顺序一一对应，确保唯一）
const addHeadingIds = () => {
  nextTick(() => {
    if (!contentRef.value) return

    const headingElements = contentRef.value.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const used = new Set()

    headingElements.forEach((el, index) => {
      // 优先使用预生成的唯一锚点（按顺序）
      let anchor = headings.value[index]?.anchor

      // 退化处理：根据可见文本再次生成
      if (!anchor) {
        const text = (el.textContent || '').trim()
        anchor = markdownProcessor.generateAnchor(text) || `heading-${index}`
      }

      // 确保唯一
      let unique = anchor
      let i = 1
      while (used.has(unique)) {
        unique = `${anchor}-${i++}`
      }
      used.add(unique)

      el.id = unique
      el.classList.add('heading-anchor')
    })

    // 启动滚动监听
    setupScrollSpy()

    // 如果 URL 中有锚点，滚动到对应位置（稍作延迟等待布局完成）
    if (route.hash) {
      const anchor = route.hash.substring(1)
      setTimeout(() => scrollToHeading(anchor), 200)
    }
  })
}
</script>

<style scoped>
.viewer-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: var(--el-bg-color);
  height: 100vh;
  overflow-y: auto;
  position: relative;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-content {
  flex: 1;
}

.document-title {
  font-size: 2.5em;
  color: var(--el-text-color-primary);
  margin: 0 0 15px 0;
  line-height: 1.2;
}

.document-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}

.meta-item {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.document-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* 目录面板样式 */
.toc-panel {
  position: fixed;
  top: 120px;
  right: 20px;
  width: 280px;
  max-height: calc(100vh - 160px);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  transition: all 0.3s ease;
}

.toc-panel.toc-collapsed {
  width: 120px;
}

.toc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.toc-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.toc-toggle {
  padding: 4px;
}

.toc-content {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  padding: 10px 0;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 2px 0;
}

.toc-link {
  color: var(--el-text-color-secondary);
  text-decoration: none;
  display: block;
  padding: 6px 20px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  font-size: 14px;
  line-height: 1.4;
}

.toc-link:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

@media (max-width: 768px) {
  .toc-panel {
    display: none;
  }
}

.toc-item.toc-active .toc-link {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-left-color: var(--el-color-primary);
  font-weight: 500;
}

/* 不同级别的缩进 */
.toc-level-1 .toc-link {
  font-weight: 600;
  font-size: 15px;
}

.toc-level-2 .toc-link {
  padding-left: 30px;
}

.toc-level-3 .toc-link {
  padding-left: 40px;
  font-size: 13px;
}

.toc-level-4 .toc-link {
  padding-left: 50px;
  font-size: 13px;
}

.toc-level-5 .toc-link,
.toc-level-6 .toc-link {
  padding-left: 60px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* 目录提示样式 */
.toc-tip {
  padding: 10px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.tip-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.tip-text .el-icon {
  font-size: 14px;
}

/* 文档内容区域 */
.document-content-wrapper {
  position: relative;
}

.document-content {
  line-height: var(--md-line-height, 1.8);
  transition: margin-right 0.3s ease;
}

.document-content.with-toc {
  margin-right: 320px; /* 为目录面板留出空间 */
}

@media (max-width: 768px) {
  .document-content.with-toc {
    margin-right: 0;
  }
  
  .document-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .document-title {
    font-size: 1.8em;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

/* 标题锚点样式 */
.heading-anchor {
  scroll-margin-top: 100px; /* 滚动时的顶部偏移 */
  scroll-behavior: smooth; /* 平滑滚动 */
  position: relative;
}

.heading-anchor:hover::before {
  content: '#';
  position: absolute;
  left: -25px;
  color: var(--el-color-primary);
  font-weight: normal;
  opacity: 0.7;
}

/* 确保页面可以滚动 */
html {
  scroll-behavior: smooth;
}

.viewer-page {
  scroll-behavior: smooth;
}

/* 确保标题元素可见 */
.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  scroll-margin-top: 100px;
  position: relative;
}

.markdown-content {
  font-size: var(--md-font-size, 16px);
  color: var(--el-text-color-primary, #333);
}

/* Markdown 内容样式 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 32px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--el-text-color-primary);
}

.markdown-content :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 10px;
}

.markdown-content :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 8px;
}

.markdown-content :deep(h3) {
  font-size: 1.25em;
}

.markdown-content :deep(p) {
  margin: 16px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 16px 0;
  padding-left: 30px;
}

.markdown-content :deep(li) {
  margin: 8px 0;
}

.markdown-content :deep(code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 85%;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-content :deep(pre) {
  background: var(--el-fill-color-light);
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--el-border-color);
  padding-left: 16px;
  color: var(--el-text-color-secondary);
  margin: 16px 0;
  font-style: italic;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  border: 1px solid var(--el-border-color);
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 12px 16px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 16px 0;
}

.markdown-content :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.share-content {
  padding: 10px 0;
}

.share-input {
  margin-bottom: 10px;
}

.loading-container {
  padding: 20px;
}

.empty-container {
  padding: 60px 20px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .document-content.with-toc {
    margin-right: 300px;
  }

  .toc-panel {
    width: 260px;
  }
}

@media (max-width: 768px) {
  .viewer-page {
    padding: 15px;
  }

  .document-header {
    flex-direction: column;
    gap: 20px;
  }

  .document-title {
    font-size: 2em;
  }

  .header-actions {
    width: 100%;
    justify-content: center;
  }

  .document-meta {
    flex-direction: column;
    gap: 8px;
  }

  .markdown-content {
    font-size: calc(var(--md-font-size, 16px) - 1px);
  }

  /* 移动端目录样式 */
  .document-content.with-toc {
    margin-right: 0;
  }

  .toc-panel {
    position: fixed;
    top: auto;
    bottom: 20px;
    right: 20px;
    left: 20px;
    width: auto;
    max-height: 50vh;
  }

  .toc-panel.toc-collapsed {
    width: auto;
    height: 50px;
  }

  .toc-panel.toc-collapsed .toc-header {
    border-bottom: none;
  }
}

@media (max-width: 480px) {
  .toc-panel {
    left: 10px;
    right: 10px;
    bottom: 10px;
  }

  .toc-header h3 {
    font-size: 14px;
  }

  .toc-link {
    font-size: 13px;
    padding: 5px 15px;
  }

  .toc-level-2 .toc-link {
    padding-left: 25px;
  }

  .toc-level-3 .toc-link {
    padding-left: 35px;
  }
}

/* 头部操作区布局 */
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Excalidraw 渲染容器样式 (Viewer 模式) */
:deep(.excalidraw-render-container) {
  margin: 1.5rem 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  min-height: 200px;
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
