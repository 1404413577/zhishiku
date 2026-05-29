<template>
  <el-dialog 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
    title="💡 思维导图操作指南" 
    width="500px"
    destroy-on-close
  >
    <div class="help-content">
      <div class="help-section">
        <h3>🖱️ 鼠标交互</h3>
        <ul>
          <li><b>双击节点：</b>进入内联文本编辑模式。</li>
          <li><b>左键按住空白处：</b>可自由拖拽平移整块无限画布。</li>
          <li><b>鼠标滚轮：</b>以鼠标为中心，丝滑缩放画布大小。</li>
          <li><b>节点拖拽重组：</b>按住任意节点拖动，可将其挂载到其他分支下，连线将自动重绘。</li>
        </ul>
      </div>
      
      <div class="help-section">
        <h3>⌨️ 常用快捷键</h3>
        <ul class="shortcut-list">
          <li>
            <span>添加子节点</span>
            <kbd>Tab</kbd>
          </li>
          <li>
            <span>添加同级节点</span>
            <kbd>Enter</kbd>
          </li>
          <li>
            <span>删除选中节点</span>
            <kbd>Delete</kbd>
          </li>
          <li>
            <span>撤销操作</span>
            <kbd>Ctrl</kbd> + <kbd>Z</kbd>
          </li>
          <li>
            <span>重做操作</span>
            <kbd>Ctrl</kbd> + <kbd>Y</kbd>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="$emit('update:modelValue', false)">我学会了</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
// 使用 v-model 控制弹窗显示隐藏
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.help-content {
  color: var(--el-text-color-regular);
}

.help-section {
  margin-bottom: 24px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-section ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}

.help-section li b {
  color: var(--el-text-color-primary);
}

.shortcut-list {
  list-style: none !important;
  padding: 0 !important;
}

.shortcut-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.shortcut-list li:last-child {
  border-bottom: none;
}

kbd {
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-darker);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
  color: var(--el-text-color-primary);
  box-shadow: 0 1px 0 rgba(0,0,0,0.05);
}
</style>