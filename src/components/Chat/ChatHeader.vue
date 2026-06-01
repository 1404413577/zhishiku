<template>
  <div class="chat-header">
    <div class="header-left">
      <el-button class="menu-toggle" :icon="Menu" text circle @click="$emit('toggle-menu')" />
      <h2 class="header-title">AI 对话</h2>
    </div>
    <div class="header-right">
      <div class="engine-selector">
        <el-select 
          :model-value="selectedEngine" 
          @update:model-value="$emit('update:selectedEngine', $event)" 
          placeholder="引擎" 
          size="default" 
          style="width: 110px"
        >
          <el-option label="在线 API" value="online" />
          <el-option label="本地模型" value="local" />
          <el-option label="Ollama" value="ollama" />
        </el-select>
      </div>
      <div class="model-selector">
        <el-select 
          :model-value="selectedModel" 
          @update:model-value="$emit('update:selectedModel', $event)" 
          :placeholder="modelPlaceholder" 
          size="default" 
          style="width: 180px"
          :loading="loadingModels"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.value || model.name"
            :label="model.label || model.name"
            :value="model.value || model.name"
          />
        </el-select>
        <el-button size="default" :icon="Refresh" circle text @click="$emit('refresh')" title="刷新模型" />
      </div>
      <div class="header-actions">
        <el-button size="default" type="primary" plain :icon="Download" @click="$emit('archive')" title="保存为 Markdown" :disabled="!canArchive">
          归档
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Menu, Refresh, Download } from '@element-plus/icons-vue'

defineProps({
  selectedEngine: String,
  selectedModel: String,
  availableModels: Array,
  loadingModels: Boolean,
  modelPlaceholder: String,
  canArchive: Boolean
})

defineEmits(['update:selectedEngine', 'update:selectedModel', 'refresh', 'archive', 'toggle-menu'])
</script>

<style scoped>
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  z-index: 10;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--el-text-color-primary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.engine-selector, .model-selector {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .chat-header {
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .header-right {
    width: 100%;
    justify-content: space-between;
  }
  .model-selector .el-select {
    width: 140px !important;
  }
}
@media (min-width: 769px) {
  .menu-toggle { display: none; }
}
</style>