<template>
  <div class="mm-style-panel" v-if="selectedNode && selectedNode._level > 0">
    <div class="panel-header">
      <span>节点样式</span>
      <el-button :icon="Close" circle size="small" text @click="$emit('close')" />
    </div>
    <div class="panel-body">
      <div class="style-row">
        <label>填充颜色</label>
        <el-color-picker v-model="nodeStyle.fillColor" size="small" @change="applyStyle" />
      </div>
      <div class="style-row">
        <label>文字颜色</label>
        <el-color-picker v-model="nodeStyle.fontColor" size="small" @change="applyStyle" />
      </div>
      <div class="style-row">
        <label>边框颜色</label>
        <el-color-picker v-model="nodeStyle.borderColor" size="small" @change="applyStyle" />
      </div>
      <div class="style-row">
        <label>边框宽度</label>
        <el-slider v-model="nodeStyle.borderWidth" :min="0" :max="5" size="small" @change="applyStyle" />
      </div>
      <div class="style-row">
        <label>字号</label>
        <el-slider v-model="nodeStyle.fontSize" :min="10" :max="24" size="small" @change="applyStyle" />
      </div>
      <el-divider />
      <div class="panel-actions">
        <el-button size="small" @click="$emit('add-child', selectedNode)" :icon="Plus">子节点</el-button>
        <el-button size="small" @click="$emit('add-sibling', selectedNode)" :icon="Plus">同级</el-button>
        <el-button size="small" type="danger" @click="$emit('delete', selectedNode)" :icon="Delete">删除</el-button>
      </div>
      <el-divider />
      <el-button class="reset-button" size="small" type="warning" @click="$emit('reset-style', selectedNode)">重置样式</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { Close, Plus, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  selectedNode: { type: Object, default: null },
  currentTheme: { type: Object, required: true }
})

const emit = defineEmits(['close', 'apply-style', 'add-child', 'add-sibling', 'delete', 'reset-style'])

const nodeStyle = reactive({
  fillColor: '#ffffff',
  fontColor: '#303133',
  borderColor: '#dcdfe6',
  borderWidth: 1,
  fontSize: 13,
})

// 监听选中的节点，同步其样式到表单
watch(() => props.selectedNode, (node) => {
  if (node && node._level > 0) {
    nodeStyle.fillColor = node.style?.fillColor || props.currentTheme.nodeFill
    nodeStyle.fontColor = node.style?.fontColor || props.currentTheme.nodeText
    nodeStyle.borderColor = node.style?.borderColor || props.currentTheme.nodeBorder
    nodeStyle.borderWidth = node.style?.borderWidth ?? 1
    nodeStyle.fontSize = node.style?.fontSize ?? 13
  }
}, { immediate: true })

const applyStyle = () => {
  emit('apply-style', { ...nodeStyle })
}
</script>

<style scoped>
.mm-style-panel {
  position: absolute;
  top: 68px;
  right: 14px;
  width: 260px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: 0 16px 42px rgba(47, 72, 96, 0.14);
  backdrop-filter: blur(12px);
  z-index: 20;
  overflow: hidden;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: rgba(64, 158, 255, 0.08);
}
.panel-body {
  padding: 16px;
}
.style-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.style-row label {
  flex-shrink: 0;
  margin-right: 12px;
}
.style-row .el-slider {
  flex: 1;
}
.panel-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.panel-actions :deep(.el-button) {
  margin: 0;
}
.reset-button {
  width: 100%;
}
@media (max-width: 768px) {
  .mm-style-panel {
    top: auto;
    right: 10px;
    left: 10px;
    bottom: 62px;
    width: auto;
  }
}
</style>
