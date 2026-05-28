<template>
  <teleport to="body">
    <transition name="fade-scale">
      <div v-if="visible" class="global-search-overlay" @click.self="close">
        <div class="global-search-modal">
          <div class="search-input-wrapper">
            <el-icon class="search-icon"><Search /></el-icon>
            <input
              ref="inputRef"
              v-model="query"
              placeholder="搜索文档... (支持拼音/全文)"
              class="search-input"
              @keydown.down.prevent="selectNext"
              @keydown.up.prevent="selectPrev"
              @keydown.enter.prevent="goToSelected"
              @keydown.esc="close"
            />
            <div class="shortcut-hint">
              <span class="key">ESC</span> 退出
            </div>
          </div>

          <div class="search-results" v-if="results.length > 0">
            <div
              v-for="(res, index) in results"
              :key="res.item.id"
              :class="['result-item', { active: index === selectedIndex }]"
              @mouseenter="selectedIndex = index"
              @click="goToSelected"
            >
              <el-icon class="doc-icon"><Document /></el-icon>
              <div class="result-content">
                <div class="result-title">{{ res.item.title }}</div>
                <div class="result-summary" v-html="res.item.highlightedSummary || res.item.summary"></div>
              </div>
              <el-icon class="enter-icon" v-show="index === selectedIndex"><ArrowRight /></el-icon>
            </div>
          </div>

          <div class="empty-state" v-else-if="query && results.length === 0">
            没有找到与 "<span>{{ query }}</span>" 相关的文档
          </div>
          <div class="empty-state" v-else>
            输入关键词开始搜索，支持键盘 ⬆️ ⬇️ 切换
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Document, ArrowRight } from '@element-plus/icons-vue'
import { searchEngine } from '@/utils/search.js'

const router = useRouter()
const visible = ref(false)
const query = ref('')
const results = ref([])
const selectedIndex = ref(0)
const inputRef = ref(null)

// 监听快捷键 Ctrl+K / Cmd+K
const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    toggleSearch()
  }
}

const toggleSearch = () => {
  visible.value = !visible.value
  if (visible.value) {
    query.value = ''
    results.value = []
    selectedIndex.value = 0
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

const close = () => {
  visible.value = false
}

// 监听输入并触发底层的 FlexSearch
watch(query, async (newQuery) => {
  if (!newQuery.trim()) {
    results.value = []
    return
  }
  // 调用上一轮重写的极速搜索引擎
  const searchResults = await searchEngine.search(newQuery)
  // 只取前 8 条结果，保持弹窗简洁
  results.value = searchResults.slice(0, 8)
  selectedIndex.value = 0
})

// 键盘导航逻辑
const selectNext = () => {
  if (results.value.length > 0) {
    selectedIndex.value = (selectedIndex.value + 1) % results.value.length
  }
}

const selectPrev = () => {
  if (results.value.length > 0) {
    selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length
  }
}

const goToSelected = () => {
  if (results.value.length > 0 && results.value[selectedIndex.value]) {
    const docId = results.value[selectedIndex.value].item.id
    close()
    // 跳转到查看页 (或编辑页，根据你的习惯)
    router.push(`/view/${docId}`)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* 全局蒙层 */
.global-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}

/* 弹窗主体 - 类似 Raycast 的质感 */
.global-search-modal {
  width: 100%;
  max-width: 640px;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
}

/* 输入区 */
.search-input-wrapper {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.search-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  margin-right: 12px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 18px;
  background: transparent;
  color: var(--el-text-color-primary);
}

.search-input::placeholder {
  color: var(--el-text-color-placeholder);
}

.shortcut-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.shortcut-hint .key {
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  font-family: monospace;
}

/* 结果列表 */
.search-results {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 12px;
}

.result-item.active {
  background: var(--el-color-primary-light-9);
}

.doc-icon {
  font-size: 20px;
  color: var(--el-color-primary);
  opacity: 0.8;
}

.result-content {
  flex: 1;
  overflow: hidden;
}

.result-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.result-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enter-icon {
  color: var(--el-color-primary);
  font-size: 16px;
}

/* 搜索高亮词样式 (继承我们在上一轮设定的样式) */
:deep(.search-highlight) {
  background-color: rgba(255, 213, 0, 0.3);
  color: #b06a00;
  font-weight: 600;
  padding: 0 2px;
  border-radius: 3px;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 弹窗动画 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-10px);
}
</style>