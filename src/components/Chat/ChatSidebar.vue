<template>
  <div :class="['chat-sidebar', { 'sidebar-open': isSidebarOpen }]">
    <div class="sidebar-header">
      <el-button type="primary" :icon="Plus" class="new-chat-btn" @click="$emit('create')" round>
        创建新对话
      </el-button>
      <el-button class="sidebar-close-btn" :icon="Close" circle text @click="$emit('update:isSidebarOpen', false)" />
    </div>
    <el-scrollbar class="session-list">
      <div 
        v-for="session in sortedSessions" 
        :key="session.id"
        :class="['session-item', { active: session.id === activeSessionId }]"
        @click="$emit('update:activeSessionId', session.id)"
      >
        <div class="session-info">
          <el-icon class="session-icon"><ChatDotRound /></el-icon>
          <span class="session-title">{{ session.title || '新对话' }}</span>
        </div>
        <el-button 
          type="danger" 
          :icon="Delete" 
          circle 
          text
          size="small" 
          class="delete-btn" 
          @click.stop="$emit('delete', session.id)"
          title="删除会话"
        />
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Plus, Close, ChatDotRound, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  sessions: { type: Array, required: true },
  activeSessionId: { type: String, default: null },
  isSidebarOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['update:activeSessionId', 'update:isSidebarOpen', 'create', 'delete'])

const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
})
</script>

<style scoped>
.chat-sidebar {
  width: 240px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  gap: 10px;
}
.new-chat-btn {
  flex: 1;
  font-weight: 500;
  min-height: 36px;
}
.session-list {
  flex: 1;
  padding: 8px 6px;
}
.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--el-text-color-regular);
}
.session-item:hover {
  background-color: var(--el-fill-color-light);
}
.session-item.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
}
.session-icon { font-size: 16px; }
.session-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 142px;
}
.delete-btn {
  flex: 0 0 auto;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.session-item:hover .delete-btn {
  opacity: 1;
  transform: scale(1);
}

@media (max-width: 768px) {
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: min(82vw, 300px);
    height: 100%;
    z-index: 1000;
    transform: translateX(-100%);
  }
  .chat-sidebar.sidebar-open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }
}
@media (min-width: 769px) {
  .sidebar-close-btn { display: none; }
}
</style>
