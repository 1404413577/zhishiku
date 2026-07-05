<template>
  <div id="app">
    <AppLayout />
    <GlobalSearch />
  </div>
</template>

<script setup>
import { watchEffect, onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/Layout/AppLayout.vue'
import { useSettingsStore } from '@/stores/settings.js'
import { useDocumentsStore } from '@/stores/documents.js'
import GlobalSearch from '@/components/GlobalSearch.vue'

const settings = useSettingsStore()

// 应用全局样式设置
watchEffect(() => {
  const root = document.documentElement
  const color = settings.primaryColor
  
  // 设置主题色
  root.style.setProperty('--el-color-primary', color)
  
  // 生成一些衍生的颜色变体 (Element Plus 常用后缀)
  // 简单的透明度叠加模拟
  root.style.setProperty('--el-color-primary-light-3', color + 'b3') 
  root.style.setProperty('--el-color-primary-light-5', color + '80')
  root.style.setProperty('--el-color-primary-light-7', color + '4d')
  root.style.setProperty('--el-color-primary-light-8', color + '33')
  root.style.setProperty('--el-color-primary-light-9', color + '1a')
  root.style.setProperty('--el-color-primary-dark-2', color) // 简单模拟深色

  // 设置字体大小和行高
  root.style.setProperty('--md-font-size', settings.fontSize + 'px')
  root.style.setProperty('--md-line-height', settings.lineWeight)
})

onMounted(async () => {
  // 自动同步逻辑 (WebDAV)
  const performSync = async () => {
    if (settings.webdavUrl && settings.webdavUsername && settings.webdavPassword) {
      const { syncWithWebDAV } = await import('@/utils/webdav.js')
      const docsStore = useDocumentsStore()
      try {
        await syncWithWebDAV(settings, docsStore.documents)
        console.log('✅ 自动同步完成')
      } catch (err) {
        console.warn('自动同步失败:', err.message)
      }
    }
  }

  if (settings.syncOnOpen) {
    console.log('🔄 正在执行打开时自动同步...')
    await performSync()
  }

  // 定期自动备份逻辑 (每10分钟)
  const backupInterval = setInterval(() => {
    if (settings.autoBackup) {
      console.log('⏰ 正在执行定期自动备份...')
      performSync()
    }
  }, 10 * 60 * 1000)

  // 组件卸载时清理定时器
  onUnmounted(() => {
    clearInterval(backupInterval)
  })
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100vh;
  overflow: hidden;
}

/* Element Plus 样式覆盖 */
.el-aside {
  overflow: hidden;
}

.el-main {
  padding: 0;
  overflow: auto;
}

/* 代码高亮样式 */
.hljs {
  background: #f6f8fa !important;
  color: #24292e;
}

.hljs-comment,
.hljs-quote {
  color: #6a737d;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #d73a49;
}

.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
  color: #005cc5;
}

.hljs-string,
.hljs-doctag {
  color: #032f62;
}

.hljs-title,
.hljs-section,
.hljs-selector-id {
  color: #6f42c1;
  font-weight: bold;
}

.hljs-subst {
  font-weight: normal;
}

.hljs-type,
.hljs-class .hljs-title,
.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #22863a;
  font-weight: normal;
}

.hljs-regexp,
.hljs-link {
  color: #032f62;
}

.hljs-symbol,
.hljs-bullet {
  color: #e36209;
}

.hljs-built_in,
.hljs-builtin-name {
  color: #005cc5;
}

.hljs-meta {
  color: #6a737d;
}

.hljs-deletion {
  background: #ffeef0;
}

.hljs-addition {
  background: #f0fff4;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}

/* 任务列表样式适配 */
.markdown-body :deep(.task-list-item) {
  list-style-type: none;
}

.markdown-body :deep(.task-list-item-checkbox) {
  margin: 0 8px 0 -24px;
  vertical-align: middle;
  cursor: pointer;
}

.markdown-body {
  font-size: var(--md-font-size, 16px);
  line-height: var(--md-line-height, 1.6);
}

/* Obsidian 双向链接样式 */
.markdown-body :deep(.obsidian-link) {
  color: var(--el-color-primary);
  text-decoration: none;
  font-weight: 500;
  padding: 0 2px;
  border-bottom: 1px dashed var(--el-color-primary-light-3);
  transition: all 0.2s;
}

.markdown-body :deep(.obsidian-link:hover) {
  background-color: var(--el-color-primary-light-9);
  border-bottom: 1px solid var(--el-color-primary);
}

/* 响应式设计 */
.code-block-wrapper {
  position: relative;
  margin: 16px 0;
  border-radius: 8px;
  background: var(--el-bg-color-page, #f6f8fa);
  border: 1px solid var(--el-border-color-lighter, #e1e4e8);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-fill-color-light, #eaedf1);
  border-bottom: 1px solid var(--el-border-color-lighter, #e1e4e8);
}

.code-lang {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular, #5c6c7f);
  text-transform: uppercase;
  font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
}

.code-copy-btn {
  background: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color, #d1d5da);
  color: var(--el-text-color-regular, #586069);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-copy-btn:hover {
  background: var(--el-fill-color-light, #f3f4f6);
  border-color: var(--el-color-primary, #409eff);
  color: var(--el-color-primary, #409eff);
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
}

.code-copy-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

.code-copy-btn.copied {
  color: var(--el-color-success, #67c23a);
  border-color: var(--el-color-success-light-5, #a4da89);
  background: var(--el-color-success-light-9, #f0f9eb);
}

.code-block-wrapper pre {
  margin: 0 !important;
  padding: 16px;
  overflow-x: auto;
}

.code-block-wrapper pre code {
  background: none !important;
}

/* 轻量公式样式，不再加载重型公式渲染库 */
.math-inline {
  padding: 0 4px;
  border-radius: 4px;
  font-family: "Times New Roman", "Cambria Math", serif;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.math-block {
  margin: 16px 0;
  padding: 12px 16px;
  overflow-x: auto;
  border-radius: 6px;
  text-align: center;
  font-family: "Times New Roman", "Cambria Math", serif;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}

/* 阅读进度条全局样式 */
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background-color: var(--el-color-primary);
  z-index: 9999;
  transition: width 0.1s ease-out;
  pointer-events: none; /* 防止遮挡下方事件 */
}

/* Element Plus 按钮主题适配 */
.el-button {
  transition: all 0.2s ease-in-out;
}
</style>
