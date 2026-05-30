<template>
  <div class="capsule-toolbar">
    <el-tooltip content="重置导图" placement="bottom">
      <el-button @click="handleReset" :icon="DocumentAdd" text circle />
    </el-tooltip>
    
    <div class="toolbar-divider"></div>

    <el-dropdown @command="toggleLayoutMode" trigger="click">
      <el-button text round :icon="Switch">
        布局 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="mindMap">中心分布 (默认)</el-dropdown-item>
          <el-dropdown-item command="logicalStructure">逻辑右排</el-dropdown-item>
          <el-dropdown-item command="organizationStructure">组织结构图</el-dropdown-item>
          <el-dropdown-item command="catalogOrganization">目录组织图</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <div class="toolbar-divider"></div>

    <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
      <el-button @click="undo" :icon="Back" text circle />
    </el-tooltip>
    <el-tooltip content="重做 (Ctrl+Y)" placement="bottom">
      <el-button @click="redo" :icon="Right" text circle />
    </el-tooltip>

    <div class="toolbar-divider"></div>

    <el-button @click="exportToImage" type="primary" :icon="Download" round size="small" class="export-btn">
      导出图片
    </el-button>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { DocumentAdd, Switch, ArrowDown, Back, Right, Download } from '@element-plus/icons-vue'

const { undo, redo, exportToImage, toggleLayoutMode, resetMap } = inject('mindmap-context', {})

const handleReset = () => {
  if (resetMap) resetMap()
}
</script>

<style scoped>
.capsule-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 999px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background-color: var(--el-border-color-darker);
  opacity: 0.2;
  margin: 0 4px;
}

.export-btn {
  margin-left: 4px;
}
</style>