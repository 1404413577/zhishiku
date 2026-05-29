<template>
  <div 
    v-if="contextMenu?.visible"
    class="mindmap-context-menu"
    :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
  >
    <div class="menu-item" @click="exec('INSERT_CHILD_NODE')">
      <el-icon><Plus /></el-icon> 添加子节点 (Tab)
    </div>
    <div class="menu-item" @click="exec('INSERT_NODE')">
      <el-icon><Right /></el-icon> 添加同级节点 (Enter)
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item" @click="exec('UP_NODE')">
      <el-icon><Top /></el-icon> 上移节点
    </div>
    <div class="menu-item" @click="exec('DOWN_NODE')">
      <el-icon><Bottom /></el-icon> 下移节点
    </div>
    <div class="menu-divider"></div>
    <div class="menu-item danger" @click="exec('REMOVE_NODE')">
      <el-icon><Delete /></el-icon> 删除节点 (Delete)
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { Plus, Right, Top, Bottom, Delete } from '@element-plus/icons-vue'

const { contextMenu, hideContextMenu, mindMap } = inject('mindmap-context', {})

// 统一执行引擎原生命令
const exec = (cmd) => {
  if (mindMap?.value) {
    mindMap.value.execCommand(cmd)
  }
  if (hideContextMenu) hideContextMenu()
}
</script>

<style scoped>
.mindmap-context-menu {
  position: fixed; z-index: 9999;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  padding: 6px 0; min-width: 180px;
}
.menu-item {
  padding: 10px 16px; font-size: 13px; color: var(--el-text-color-primary);
  display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.15s;
}
.menu-item:hover { background: var(--el-fill-color-light); }
.menu-item.danger { color: var(--el-color-danger); }
.menu-item.danger:hover { background: var(--el-color-danger-light-9); }
.menu-divider { height: 1px; background: var(--el-border-color-lighter); margin: 4px 0; }
</style>