<template>
  <div class="mm-toolbar">
    <div class="toolbar-left">
      <el-button class="menu-toggle" :icon="Menu" text circle @click="$emit('toggle-menu')" />
      <el-button size="small" @click="$emit('new')" :icon="DocumentAdd">新建</el-button>
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
      <el-select 
        :model-value="currentLineStyle" 
        size="small" 
        style="width: 100px; margin-right: 8px;" 
        @update:model-value="$emit('update:currentLineStyle', $event)"
      >
        <el-option label="贝塞尔曲线" value="curve" />
        <el-option label="直角折线" value="orthogonal" />
        <el-option label="直线连接" value="straight" />
      </el-select>
      
      <el-select 
        :model-value="currentThemeName" 
        size="small" 
        style="width: 100px" 
        @update:model-value="$emit('update:currentThemeName', $event)"
      >
        <el-option v-for="t in themeNames" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
      
      <el-button size="small" style="margin-left:8px" @click="$emit('export-json')" :icon="Download">导出</el-button>
      <el-button size="small" @click="$emit('export-png')" :icon="Picture">图片</el-button>
    </div>
  </div>
</template>

<script setup>
import { DocumentAdd, Select, ZoomIn, ZoomOut, RefreshLeft, RefreshRight, Download, Picture, Menu } from '@element-plus/icons-vue'

defineProps({
  zoom: { type: Number, required: true },
  canUndo: { type: Boolean, required: true },
  canRedo: { type: Boolean, required: true },
  themeNames: { type: Array, required: true },
  currentThemeName: { type: String, required: true },
  currentLineStyle: { type: String, required: true }
})

defineEmits([
  'new', 'save', 'zoom-in', 'zoom-out', 'fit-center', 
  'undo', 'redo', 'export-json', 'export-png', 
  'update:currentThemeName', 'update:currentLineStyle', 'toggle-menu'
])
</script>

<style scoped>
.mm-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
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
  margin: 0 4px;
}
</style>