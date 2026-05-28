<template>
  <div class="toolbar" v-show="!isFocusMode">
    <div class="toolbar-left">
      <el-button
        v-if="canGoBack"
        circle
        size="small"
        :icon="ArrowLeft"
        @click="$emit('goBack')"
        title="返回"
        style="margin-right: 8px;"
      />
      <el-input
        :model-value="title"
        @update:model-value="$emit('update:title', $event)"
        placeholder="文档标题"
        class="title-input"
        @blur="$emit('save')"
      />
      <el-button type="primary" @click="$emit('save')" :loading="saving" :icon="Document" size="small" round>保存</el-button>
      <el-button type="success" :icon="MagicStick" @click="$emit('aiWrite')" :loading="aiWritingLoading" size="small" round>AI帮写</el-button>
    </div>

    <div class="toolbar-right">
      <el-button @click="toggleTablePicker" :icon="Grid" size="small" plain title="插入表格">表格</el-button>

      <el-dropdown @command="$emit('export', $event)" trigger="click">
        <el-button :icon="Download" size="small" plain>
          导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="md"><el-icon><Document /></el-icon> Markdown (.md)</el-dropdown-item>
            <el-dropdown-item command="html"><el-icon><Notebook /></el-icon> HTML (.html)</el-dropdown-item>
            <el-dropdown-item command="pdf"><el-icon><Printer /></el-icon> PDF 打印</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button
        @click="$emit('cycleMode')"
        :type="editorMode !== 'preview' ? 'primary' : 'default'"
        :icon="editorMode === 'split' ? View : editorMode === 'preview' ? Reading : Edit"
        size="small" plain
      >
        {{ editorMode === 'edit' ? '编辑模式' : editorMode === 'split' ? '分屏模式' : '预览模式' }}
      </el-button>

      <el-button @click="$emit('toggleFocus')" :icon="FullScreen" size="small" plain title="专注模式 (Ctrl+Shift+F)" />
      <el-button @click="$emit('viewDocument')" :icon="Reading" size="small" plain>查看</el-button>
    </div>

    <!-- 表格插入选择器 -->
    <teleport to="body">
      <div v-if="showTablePicker" class="table-picker-overlay" @click="showTablePicker = false">
        <div class="table-picker-popover" @click.stop>
          <div class="table-picker-label">{{ tablePickerRows }} x {{ tablePickerCols }} 表格</div>
          <div class="table-picker-grid">
            <div v-for="row in 8" :key="row" class="table-picker-row">
              <div
                v-for="col in 8" :key="col"
                :class="['table-picker-cell', { active: row <= tablePickerRows && col <= tablePickerCols }]"
                @mouseenter="tablePickerRows = row; tablePickerCols = col"
                @click="handleInsertTable"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Document, Edit, Reading, ArrowLeft, MagicStick, Grid, View, FullScreen, Download, ArrowDown, Printer, Notebook } from '@element-plus/icons-vue'

defineProps({
  title: String,
  saving: Boolean,
  aiWritingLoading: Boolean,
  editorMode: String,
  isFocusMode: Boolean,
  canGoBack: Boolean
})

const emit = defineEmits(['update:title', 'save', 'aiWrite', 'goBack', 'export', 'cycleMode', 'toggleFocus', 'viewDocument', 'insertTable'])

const showTablePicker = ref(false)
const tablePickerRows = ref(3)
const tablePickerCols = ref(3)

const toggleTablePicker = () => {
  showTablePicker.value = !showTablePicker.value
  tablePickerRows.value = 3
  tablePickerCols.value = 3
}

const handleInsertTable = () => {
  emit('insertTable', { rows: tablePickerRows.value, cols: tablePickerCols.value })
  showTablePicker.value = false
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--el-border-color-light); background: var(--el-bg-color-page); flex-shrink: 0; }
.toolbar-left { display: flex; align-items: center; gap: 15px; }
.title-input { width: 300px; }
.toolbar-right { display: flex; gap: 10px; }
.table-picker-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; }
.table-picker-popover { position: fixed; background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); top: 50%; left: 50%; transform: translate(-50%, -50%); }
.table-picker-label { text-align: center; font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.table-picker-grid { display: flex; flex-direction: column; gap: 2px; }
.table-picker-row { display: flex; gap: 2px; }
.table-picker-cell { width: 24px; height: 24px; border: 1px solid var(--el-border-color-lighter); border-radius: 2px; cursor: pointer; transition: background 0.1s; }
.table-picker-cell.active { background: var(--el-color-primary-light-5); border-color: var(--el-color-primary); }
@media (max-width: 768px) {
  .toolbar { flex-direction: column; gap: 10px; }
  .title-input { width: 100%; }
}
</style>