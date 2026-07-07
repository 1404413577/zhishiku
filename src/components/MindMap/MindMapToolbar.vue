<template>
  <div class="mm-toolbar">
    <div class="toolbar-left">
      <el-button class="menu-toggle" :icon="Menu" text circle @click="$emit('toggle-menu')" />
      <el-button class="primary-action" type="primary" plain size="small" @click="$emit('ai-generate')">
        AI 生成
      </el-button>
      <el-button size="small" @click="$emit('import-md')" :icon="Document">导入 MD</el-button>
      <el-button size="small" @click="$emit('save')" :icon="Select">保存</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" :icon="ZoomIn" @click="$emit('zoom-in')" circle />
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <el-button size="small" :icon="ZoomOut" @click="$emit('zoom-out')" circle />
      <el-button size="small" @click="$emit('fit-center')" title="居中显示">居中</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" @click="$emit('undo')" :disabled="!canUndo" :icon="RefreshLeft">撤销</el-button>
      <el-button size="small" @click="$emit('redo')" :disabled="!canRedo" :icon="RefreshRight">重做</el-button>
    </div>
    <div class="toolbar-right">
      <el-select class="toolbar-select layout-select" :model-value="currentLayoutMode" size="small" @update:model-value="$emit('update:currentLayoutMode', $event)">
        <el-option label="向右展开" value="right" />
        <el-option label="两边散开" value="centered" />
      </el-select>
      
      <el-select class="toolbar-select line-select" :model-value="currentLineStyle" size="small" @update:model-value="$emit('update:currentLineStyle', $event)">
        <el-option label="贝塞尔曲线" value="curve" />
        <el-option label="直角折线" value="orthogonal" />
        <el-option label="直线连接" value="straight" />
      </el-select>
      
      <el-select class="toolbar-select theme-select" :model-value="currentThemeName" size="small" @update:model-value="$emit('update:currentThemeName', $event)">
        <el-option v-for="t in themeNames" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
      
      <el-button size="small" @click="$emit('export-json')" :icon="Download">导出</el-button>
      <el-button size="small" @click="$emit('export-png')" :icon="Picture">图片</el-button>
    </div>
  </div>
</template>

<script setup>
import { Select, ZoomIn, ZoomOut, RefreshLeft, RefreshRight, Download, Picture, Menu, Document } from '@element-plus/icons-vue'

defineProps({
  zoom: Number, canUndo: Boolean, canRedo: Boolean, themeNames: Array,
  currentThemeName: String, currentLineStyle: String, currentLayoutMode: String
})

defineEmits([
  'ai-generate',
  'import-md', 'save', 'zoom-in', 'zoom-out', 'fit-center', 'undo', 'redo', 
  'export-json', 'export-png', 'update:currentThemeName', 'update:currentLineStyle', 
  'update:currentLayoutMode', 'toggle-menu'
])
</script>
<style scoped>
.mm-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 1px 10px rgba(47, 72, 96, 0.06);
  backdrop-filter: blur(10px);
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}
.toolbar-right {
  justify-content: flex-end;
}
.primary-action {
  font-weight: 650;
}
.toolbar-select {
  width: 112px;
}
.line-select {
  width: 124px;
}
.theme-select {
  width: 96px;
}
.zoom-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
:deep(.el-divider--vertical) {
  height: 20px;
  margin: 0 2px;
}
@media (max-width: 900px) {
  .mm-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
  }

  .toolbar-right {
    justify-content: flex-start;
  }
}
@media (max-width: 560px) {
  .toolbar-select,
  .line-select,
  .theme-select {
    width: calc(50% - 4px);
  }

  .zoom-label {
    min-width: 38px;
  }
}
</style>
