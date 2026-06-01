<template>
  <div class="mindmap-app" :style="{ background: currentTheme.bg }">
    
    <MindMapSidebar
      :sessions="sessions"
      :activeSessionId="activeSessionId"
      :isSidebarOpen="isSidebarOpen"
      @update:isSidebarOpen="isSidebarOpen = $event"
      @create="createNewSession"
      @select="switchSession"
      @delete="handleDeleteSession"
    />

    <div v-if="isSidebarOpen" class="sidebar-overlay" @click="isSidebarOpen = false"></div>

    <div class="mm-main-content">
      <MindMapToolbar 
        :zoom="zoom" 
        :canUndo="canUndo" 
        :canRedo="canRedo" 
        :themeNames="themeNames"
        v-model:currentThemeName="currentThemeName"
        @toggle-menu="isSidebarOpen = true"
        @new="createNewSession"
        @save="saveMindMap"
        @zoom-in="zoomIn" 
        @zoom-out="zoomOut"
        @fit-center="fitToCenter" 
        @undo="undo" 
        @redo="redo"
        @export-json="exportAsJSONFn" 
        @export-png="exportAsPNGFn"
      />

      <div
        class="mm-canvas-container"
        ref="canvasContainer"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseup="onCanvasMouseUp"
        @wheel.prevent="onWheel"
        @contextmenu.prevent
      >
        <svg ref="svgRef" class="mm-svg" :style="{ cursor: isPanning ? 'grabbing' : 'grab' }">
          <g :transform="`translate(${panX}, ${panY}) scale(${zoom})`">
            <path
              v-for="conn in connections" 
              :key="conn.id" 
              :d="conn.path"
              :stroke="conn.color" 
              stroke-width="2" 
              fill="none" 
              stroke-linecap="round"
            />
            <g
              v-for="node in flatNodes" 
              :key="node.id"
              :transform="`translate(${node._x}, ${node._y})`"
              class="mm-node-group"
              :class="{ selected: selectedNodeId === node.id, dragging: dragNodeId === node.id }"
              @mousedown.stop="onNodeMouseDown($event, node)"
              @dblclick.stop="startEdit(node)"
            >
              <rect
                :width="node._width" :height="node._height"
                :rx="node._level === 0 ? 30 : 8" :ry="node._level === 0 ? 30 : 8"
                :fill="node.style?.fillColor || (node._level === 0 ? currentTheme.rootFill : currentTheme.nodeFill)"
                :stroke="selectedNodeId === node.id ? currentTheme.rootFill : (node.style?.borderColor || currentTheme.nodeBorder)"
                :stroke-width="selectedNodeId === node.id ? 2 : (node.style?.borderWidth || 1)"
                :style="{ filter: node._level === 0 ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))' }"
              />
              <text
                :x="node._width / 2" :y="node._height / 2 + 1"
                text-anchor="middle" dominant-baseline="central"
                :fill="node.style?.fontColor || (node._level === 0 ? currentTheme.rootText : currentTheme.nodeText)"
                :font-size="node.style?.fontSize || (node._level === 0 ? 16 : 13)"
                :font-weight="node._level === 0 ? 600 : 400"
                style="pointer-events: none; user-select: none;"
              >{{ node.title.length > 18 ? node.title.slice(0, 17) + '…' : node.title }}</text>
              
              <g 
                v-if="node.children && node.children.length > 0" 
                class="collapse-toggle" 
                @mousedown.stop 
                @click.stop="toggleCollapse(node)" 
                :transform="`translate(${node._width + 4}, ${node._height / 2})`" 
                style="cursor: pointer;"
              >
                <circle r="8" :fill="node.collapsed ? currentTheme.rootFill : '#fff'" :stroke="currentTheme.rootFill" stroke-width="1.5" />
                <text text-anchor="middle" dominant-baseline="central" :fill="node.collapsed ? '#fff' : currentTheme.rootFill" font-size="12" font-weight="bold">{{ node.collapsed ? '+' : '−' }}</text>
              </g>
              
              <g 
                class="add-child-btn" 
                @mousedown.stop 
                @click.stop="addChildNode(node)" 
                :transform="`translate(${node._width + 4}, ${node._height / 2 + 22})`" 
                style="cursor: pointer; opacity: 0; transition: opacity 0.15s;"
              >
                <circle r="7" fill="#67c23a" stroke="#fff" stroke-width="1" />
                <text text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="12" font-weight="bold">+</text>
              </g>
            </g>
          </g>
        </svg>

        <input
          v-if="editingNode" 
          ref="editInputRef" 
          class="mm-inline-edit" 
          :style="editInputStyle"
          v-model="editText" 
          @blur="finishEdit" 
          @keydown.enter="finishEdit" 
          @keydown.escape="cancelEdit" 
          @mousedown.stop
        />
      </div>

      <div class="mm-hint">
        Tab 添加子节点 | Enter 添加同级 | Delete 删除 | 双击编辑 | 滚轮缩放 | 拖拽画布平移 | 拖拽节点移动
      </div>
    </div>

    <MindMapStylePanel 
      :selectedNode="selectedNode" 
      :currentTheme="currentTheme"
      @close="selectedNodeId = null" 
      @apply-style="applyStyleFromPanel"
      @add-child="addChildNode" 
      @add-sibling="addSiblingNode"
      @delete="deleteNode" 
      @reset-style="resetNodeStyle"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 1. 导入已拆分的 UI 组件
import MindMapSidebar from '@/components/MindMap/MindMapSidebar.vue'
import MindMapToolbar from '@/components/MindMap/MindMapToolbar.vue'
import MindMapStylePanel from '@/components/MindMap/MindMapStylePanel.vue'

// 2. 导入核心逻辑 (Composables)
import { createNode } from '@/composables/mindmap/useNodeModel'
import { useCreate } from '@/composables/mindmap/useCreate'
import { cleanNodeForExport, exportAsPNG } from '@/composables/mindmap/useExport'
import { useLayout } from '@/composables/mindmap/useLayout'
import { useUndoRedo } from '@/composables/mindmap/useUndoRedo'
import { useNodeOperations } from '@/composables/mindmap/useNodeOperations'
import { usePersist } from '@/composables/mindmap/usePersist'

// ==================== 状态管理 ====================
// 数据层绑定
const rootData = ref(createNode('中心主题', 0)) // 初始化空数据，会被 loadSessions 覆盖
const selectedNodeId = ref(null)
const editingNode = ref(null)
const editText = ref('')
const isSidebarOpen = ref(false)

// DOM 引用
const canvasContainer = ref(null)
const svgRef = ref(null)
const editInputRef = ref(null)

// 视图属性
const zoom = ref(1)
const panX = ref(40)
const panY = ref(40)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

// 拖拽属性
const dragNodeId = ref(null)
const dragStart = ref({ x: 0, y: 0 })
const dragTargetParent = ref(null)

// 主题配置
const themes = {
  default: { label: '默认蓝', bg: '#f0f2f5', rootFill: '#409eff', rootText: '#ffffff', lineColor: '#b3c6e0', nodeFill: '#ffffff', nodeText: '#303133', nodeBorder: '#dcdfe6' },
  dark: { label: '暗夜黑', bg: '#1e1e2e', rootFill: '#7c3aed', rootText: '#ffffff', lineColor: '#4a4a6a', nodeFill: '#2d2d3f', nodeText: '#e0e0e0', nodeBorder: '#4a4a6a' },
  forest: { label: '森林绿', bg: '#f0f5f0', rootFill: '#2e8b57', rootText: '#ffffff', lineColor: '#b3d0c0', nodeFill: '#ffffff', nodeText: '#2c3e50', nodeBorder: '#c0d8c8' },
  sunset: { label: '日落橙', bg: '#fef9f0', rootFill: '#e67e22', rootText: '#ffffff', lineColor: '#e8c9a0', nodeFill: '#ffffff', nodeText: '#4a3728', nodeBorder: '#e0d0c0' },
  minimal: { label: '极简灰', bg: '#fafafa', rootFill: '#333333', rootText: '#ffffff', lineColor: '#d0d0d0', nodeFill: '#ffffff', nodeText: '#333333', nodeBorder: '#e0e0e0' }
}
const themeNames = Object.keys(themes).map(k => ({ label: themes[k].label, value: k }))
const currentThemeName = ref('default')
const currentTheme = computed(() => themes[currentThemeName.value])

// ==================== 接入 Composables ====================
// 布局引擎
const { flatNodes, connections, recalc } = useLayout(rootData, currentTheme)

// 历史记录与撤销重做
const { canUndo, canRedo, pushUndo, undo, redo, clearHistory } = useUndoRedo(rootData, () => {
  selectedNodeId.value = null
  recalc()
})

// 节点操作方法包
const { findNode, findParent, addChildNode, addSiblingNode, deleteNode, toggleCollapse } = useNodeOperations({
  rootData, 
  selectedNodeId, 
  pushUndo, 
  recalc, 
  startEdit: (node) => startEdit(node)
})

const selectedNode = computed(() => selectedNodeId.value ? findNode(selectedNodeId.value) : null)

// 持久化与多会话管理
const { sessions, activeSessionId, loadSessions, saveMindMap, createNewSession, switchSession, deleteSession } = usePersist(rootData, () => {
  // 当侧边栏切换导图文件时，清理画布状态并重新渲染
  selectedNodeId.value = null
  if (clearHistory) clearHistory()
  recalc()
  fitToCenter()
})

// 监听主题切换，重新生成线条颜色
watch(currentThemeName, () => recalc())

// ==================== 侧边栏与工具栏操作 ====================
function handleDeleteSession(id) {
  ElMessageBox.confirm('确定要彻底删除这个思维导图吗？', '删除确认', { 
    type: 'warning', 
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => deleteSession(id)).catch(() => {})
}

function applyStyleFromPanel(newStyle) {
  if (!selectedNode.value) return // 移除 _level === 0 的限制
  pushUndo()
  selectedNode.value.style = { ...newStyle }
  recalc()
}

function resetNodeStyle(node) {
  if (!node) return
  pushUndo()
  node.style = null
  recalc()
}

// 居中画布
const { getCenterViewport } = useCreate()
function fitToCenter() {
  const vp = getCenterViewport()
  zoom.value = vp.zoom
  panX.value = vp.panX
  panY.value = vp.panY
}

// 缩放
function zoomIn() { zoom.value = Math.min(3, zoom.value * 1.2) }
function zoomOut() { zoom.value = Math.max(0.2, zoom.value / 1.2) }

// 导出
function exportAsJSONFn() {
  const json = JSON.stringify(cleanNodeForExport(rootData.value), null, 2)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = `${rootData.value.title || '思维导图'}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  ElMessage.success('JSON 导出成功')
}

function exportAsPNGFn() { 
  exportAsPNG(svgRef.value, flatNodes.value, currentTheme.value) 
}

// ==================== 画布核心交互 ====================
// 鼠标按下：拖拽画布空白处
function onCanvasMouseDown(e) {
  if (e.target === svgRef.value || e.target.classList.contains('mm-svg')) {
    isPanning.value = true
    panStart.value = { x: e.clientX - panX.value, y: e.clientY - panY.value }
  }
  selectedNodeId.value = null
  if (editingNode.value && e.target !== editInputRef.value) finishEdit()
}

// 鼠标移动：实现平移和拖拽释放位置预览
function onCanvasMouseMove(e) {
  if (isPanning.value) { 
    panX.value = e.clientX - panStart.value.x
    panY.value = e.clientY - panStart.value.y 
  }
  
  if (dragNodeId.value) {
    const scale = zoom.value
    const svgX = (e.clientX - panX.value) / scale
    const svgY = (e.clientY - panY.value) / scale
    let closest = null
    let closestDist = 80 / scale
    
    function findClosest(node) {
      const cx = node._x + node._width / 2
      const cy = node._y + node._height / 2
      const dist = Math.hypot(svgX - cx, svgY - cy)
      if (dist < closestDist && node.id !== dragNodeId.value) { 
        closest = node
        closestDist = dist 
      }
      if (node.children && !node.collapsed) {
        for (const c of node.children) findClosest(c)
      }
    }
    findClosest(rootData.value)
    dragTargetParent.value = closest
  }
}

// 节点按下：开启节点拖拽
function onNodeMouseDown(e, node) {
  selectedNodeId.value = node.id
  if (node !== rootData.value && e.button === 0) {
    dragNodeId.value = node.id
    dragStart.value = { x: e.clientX, y: e.clientY }
  }
}

// 节点释放算法：变更层级与父节点
function handleDrop() {
  const node = findNode(dragNodeId.value)
  const target = dragTargetParent.value
  if (!node || !target) return
  
  function isDescendant(ancestor, child) {
    if (!child.children) return false
    for (const c of child.children) {
      if (c.id === ancestor.id || isDescendant(ancestor, c)) return true
    }
    return false
  }
  
  if (node === target || isDescendant(target, node)) return
  
  pushUndo()
  const oldParent = findParent(node.id)
  if (oldParent) {
    oldParent.children = oldParent.children.filter(c => c.id !== node.id)
  }
  if (!target.children) target.children = []
  target.children.push(node)
  node._level = target._level + 1
  selectedNodeId.value = node.id
}

function onCanvasMouseUp() {
  isPanning.value = false
  if (dragNodeId.value) {
    handleDrop()
    dragNodeId.value = null
    dragTargetParent.value = null
    recalc()
  }
}

// 鼠标滚轮缩放
function onWheel(e) {
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(3, Math.max(0.2, zoom.value * delta))
  const rect = canvasContainer.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const scale = newZoom / zoom.value
  panX.value = cx - scale * (cx - panX.value)
  panY.value = cy - scale * (cy - panY.value)
  zoom.value = newZoom
}

// ==================== 内联编辑 ====================
const editInputStyle = computed(() => {
  if (!editingNode.value) return {}
  const node = editingNode.value
  return {
    left: `${panX.value + (node._x + 4) * zoom.value}px`, 
    top: `${panY.value + (node._y + 4) * zoom.value}px`,
    width: `${Math.max(node._width - 8, 60) * zoom.value}px`,
    fontSize: `${(node._level === 0 ? 16 : (node.style?.fontSize || 13)) * zoom.value}px`,
  }
})

function startEdit(node) {
  editingNode.value = node
  editText.value = node.title
  nextTick(() => { 
    if (editInputRef.value) { 
      editInputRef.value.focus()
      editInputRef.value.select() 
    } 
  })
}

function finishEdit() {
  if (editingNode.value && editText.value.trim() && editText.value !== editingNode.value.title) {
    pushUndo()
    editingNode.value.title = editText.value.trim()
    recalc()
  }
  cancelEdit()
}

function cancelEdit() { 
  editingNode.value = null 
}

// ==================== 快捷键绑定 ====================
function onKeydown(e) {
  if (editingNode.value || ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target !== editInputRef.value)) return
  
  const node = selectedNode.value
  if (!node) return
  
  if (e.key === 'Tab') { e.preventDefault(); addChildNode(node) }
  else if (e.key === 'Enter') { e.preventDefault(); addSiblingNode(node) }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteNode(node) }
  else if (e.key === 'F2') { e.preventDefault(); startEdit(node) }
  else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
  else if (e.key === ' ' && node.children?.length > 0) { e.preventDefault(); toggleCollapse(node) }
}

// ==================== 生命周期钩子 ====================
onMounted(() => { 
  loadSessions()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', onCanvasMouseUp) 
})

onUnmounted(() => { 
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseup', onCanvasMouseUp) 
})
</script>

<style scoped>
/* 最外层应用布局 */
.mindmap-app { 
  display: flex; 
  flex-direction: row; 
  height: calc(100vh - 60px); 
  position: relative; 
  overflow: hidden; 
  user-select: none; 
}

/* 主内容区占用剩余空间 */
.mm-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0; 
}

/* 移动端侧边栏遮罩 */
.sidebar-overlay {
  position: fixed;
  top: 0; 
  left: 0;
  width: 100%; 
  height: 100%;
  background: rgba(0,0,0,0.4);
  z-index: 14;
}

/* SVG 画布容器 */
.mm-canvas-container { 
  flex: 1; 
  overflow: hidden; 
  position: relative; 
}

.mm-svg { 
  width: 100%; 
  height: 100%; 
  display: block; 
}

/* 节点交互效果 */
.mm-node-group { 
  cursor: pointer; 
}

.mm-node-group:hover .add-child-btn { 
  opacity: 1 !important; 
}

.mm-node-group.selected rect:first-child { 
  filter: drop-shadow(0 0 0 2px var(--el-color-primary)) !important; 
}

/* 悬浮输入编辑框 */
.mm-inline-edit { 
  position: absolute; 
  border: 2px solid var(--el-color-primary); 
  border-radius: 7px; 
  padding: 2px 8px; 
  outline: none; 
  font-family: inherit; 
  z-index: 100; 
  background: #fff; 
  box-sizing: border-box; 
}

/* 底部操作提示文本 */
.mm-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  background: rgba(255,255,255,0.85);
  padding: 6px 16px;
  border-radius: 20px;
  pointer-events: none;
  white-space: nowrap;
}
</style>