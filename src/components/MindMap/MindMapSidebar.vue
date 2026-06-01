<template>
  <div :class="['mm-sidebar', { 'sidebar-open': isSidebarOpen }]">
    <div class="sidebar-header">
      <el-dropdown
        trigger="click"
        @command="handleCreate"
        class="new-mm-dropdown"
      >
        <el-button type="primary" class="new-mm-btn" round>
          <el-icon><Plus /></el-icon>
          <span style="margin-left: 4px; margin-right: 4px">新建</span>
          <el-icon><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="blank">📄 空白导图</el-dropdown-item>
            <el-dropdown-item command="project">📊 项目计划</el-dropdown-item>
            <el-dropdown-item command="meeting">📝 会议纪要</el-dropdown-item>
            <el-dropdown-item command="brainstorm"
              >💡 头脑风暴</el-dropdown-item
            >
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button
        class="sidebar-close-btn"
        :icon="Close"
        circle
        text
        @click="$emit('update:isSidebarOpen', false)"
      />
    </div>

    <el-tabs v-model="activeTab" class="sidebar-tabs" stretch>
      <el-tab-pane label="文档列表" name="sessions">
        <el-scrollbar class="session-list">
          <div
            v-for="session in sortedSessions"
            :key="session.id"
            :class="[
              'session-item',
              { active: session.id === activeSessionId },
            ]"
            @click="$emit('select', session.id)"
          >
            <div class="session-info">
              <el-icon class="session-icon"><Share /></el-icon>
              <span class="session-title">{{
                session.title || "未命名导图"
              }}</span>
            </div>
            <el-button
              type="danger"
              :icon="Delete"
              circle
              text
              size="small"
              class="delete-btn"
              @click.stop="$emit('delete', session.id)"
            />
          </div>
        </el-scrollbar>
      </el-tab-pane>

      <el-tab-pane label="大纲视图" name="outline">
        <el-scrollbar class="outline-tree">
          <el-tree
            :data="treeData"
            node-key="id"
            default-expand-all
            draggable
            :expand-on-click-node="false"
            @node-drag-start="$emit('push-undo')"
            @node-drop="handleOutlineDrop"
          >
            <template #default="{ node, data }">
              <div
                class="custom-tree-node"
                @click="$emit('focus-node', data.id)"
              >
                <span>{{ data.title }}</span>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { Plus, Close, Share, Delete, ArrowDown } from "@element-plus/icons-vue";

const props = defineProps({
  sessions: { type: Array, required: true },
  activeSessionId: { type: String, default: null },
  isSidebarOpen: { type: Boolean, default: false },
  rootData: { type: Object, required: true }, // 接收画布根数据用于渲染大纲
});

const emit = defineEmits([
  "update:isSidebarOpen",
  "create",
  "select",
  "delete",
  "focus-node",
  "push-undo",
  "recalc",
]);

const activeTab = ref("sessions");

const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
});

// 大纲树的数据源包装
const treeData = computed(() => {
  return props.rootData ? [props.rootData] : [];
});

function handleCreate(command) {
  emit("create", command);
}

// 大纲拖拽结束后，通知画布重新计算布局
function handleOutlineDrop() {
  emit("recalc");
}
</script>

<style scoped>
.mm-sidebar {
  width: 280px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 15;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  gap: 10px;
}
.new-mm-dropdown {
  flex: 1;
  display: flex;
}
.new-mm-btn {
  width: 100%;
  font-weight: 500;
}
.sidebar-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
:deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
:deep(.el-tab-pane) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.session-list,
.outline-tree {
  flex: 1;
  padding: 8px;
}
.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
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
  gap: 10px;
  overflow: hidden;
}
.session-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}
.delete-btn {
  opacity: 0;
  transform: scale(0.8);
}
.session-item:hover .delete-btn {
  opacity: 1;
  transform: scale(1);
}
.custom-tree-node {
  font-size: 13px;
  color: var(--el-text-color-primary);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
