<template>
  <div class="mindmap-toolbar">
    <el-button @click="router.back()" :icon="ArrowLeft" title="返回">返回</el-button>
    <div class="toolbar-divider"></div>

    <el-button @click="handleReset" :icon="DocumentAdd" title="重置导图">重置</el-button>
    <div class="toolbar-divider"></div>

    <el-dropdown @command="toggleLayoutMode">
      <el-button :icon="Switch">
        切换结构 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="mindMap">中心分布 (默认)</el-dropdown-item>
          <el-dropdown-item command="logicalStructure">逻辑右排</el-dropdown-item>
          <el-dropdown-item command="organizationStructure">组织结构图 (向下)</el-dropdown-item>
          <el-dropdown-item command="catalogOrganization">目录组织图</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <div class="toolbar-divider"></div>

    <el-button-group>
      <el-button @click="undo" :icon="Back" title="撤销"></el-button>
      <el-button @click="redo" :icon="Right" title="重做"></el-button>
    </el-button-group>
    
    <div class="toolbar-divider"></div>

    <el-button plain type="primary" @click="handleExport" :icon="Download">导出超清图</el-button>

    <div class="toolbar-divider"></div>
    <el-button plain type="info" @click="showHelp = true" :icon="QuestionFilled" title="操作指南">
      帮助与快捷键
    </el-button>

    <el-dialog 
      v-model="showHelp" 
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
          <el-button type="primary" @click="showHelp = false">我学会了</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'
// 🚨 别忘了引入新加的 QuestionFilled 图标
import { Back, Right, Download, DocumentAdd, ArrowLeft, Switch, ArrowDown, QuestionFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const { undo, redo, exportToImage, toggleLayoutMode, resetMap } = inject('mindmap-context', {})

// 控制指南弹窗的显示状态
const showHelp = ref(false)

const handleReset = () => {
  ElMessageBox.confirm('重置导图将清空当前所有内容，是否继续？', '重置', { type: 'warning' })
    .then(() => resetMap()).catch(() => {})
}

const handleExport = async () => {
  try {
    await exportToImage()
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}
</script>

<style scoped>
.mindmap-toolbar {
  position: absolute; top: 20px; left: 20px; z-index: 100;
  display: flex; align-items: center; gap: 12px; padding: 8px 12px;
  background: var(--el-bg-color); border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid var(--el-border-color-lighter);
}
.toolbar-divider { width: 1px; height: 24px; background-color: var(--el-border-color-lighter); }

/* --- 帮助弹窗的美化样式 --- */
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

/* 快捷键列表对齐样式 */
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