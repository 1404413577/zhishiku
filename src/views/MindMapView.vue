<template>
  <div class="mindmap-app" :style="{ background: currentTheme.bg }">
    <!-- 顶部工具栏 -->
    <div class="mm-toolbar">
      <div class="toolbar-left">
        <el-button size="small" @click="newMindMap" :icon="DocumentAdd">新建</el-button>
        <el-button size="small" @click="saveMindMap" :icon="Select">保存</el-button>
        <el-divider direction="vertical" />
        <el-button size="small" :icon="ZoomIn" @click="zoomIn" circle />
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <el-button size="small" :icon="ZoomOut" @click="zoomOut" circle />
        <el-button size="small" @click="fitToCenter" title="居中显示">居中</el-button>
        <el-divider direction="vertical" />
        <el-button size="small" @click="undo" :disabled="undoStack.length === 0" :icon="RefreshLeft">撤销</el-button>
        <el-button size="small" @click="redo" :disabled="redoStack.length === 0" :icon="RefreshRight">重做</el-button>
      </div>
      <div class="toolbar-right">
        <el-select v-model="currentThemeName" size="small" style="width: 120px" @change="switchTheme">
          <el-option v-for="t in themeNames" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-button size="small" @click="exportAsJSON" :icon="Download">导出 JSON</el-button>
        <el-button size="small" @click="exportAsPNG" :icon="Picture">导出图片</el-button>
      </div>
    </div>

    <!-- 主画布 -->
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
          <!-- 连线 -->
          <path
            v-for="conn in connections"
            :key="conn.id"
            :d="conn.path"
            :stroke="conn.color"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          />
          <!-- 节点 -->
          <g
            v-for="node in flatNodes"
            :key="node.id"
            :transform="`translate(${node._x}, ${node._y})`"
            class="mm-node-group"
            :class="{ selected: selectedNodeId === node.id, dragging: dragNodeId === node.id }"
            @mousedown.stop="onNodeMouseDown($event, node)"
            @dblclick.stop="startEdit(node)"
            @mouseup.stop="onNodeMouseUp($event, node)"
          >
            <!-- 节点主体 -->
            <rect
              :width="node._width"
              :height="node._height"
              :rx="node._level === 0 ? 30 : 8"
              :ry="node._level === 0 ? 30 : 8"
              :fill="node._level === 0 ? currentTheme.rootFill : (node.style?.fillColor || currentTheme.nodeFill)"
              :stroke="selectedNodeId === node.id ? currentTheme.rootFill : (node.style?.borderColor || currentTheme.nodeBorder)"
              :stroke-width="selectedNodeId === node.id ? 2 : (node.style?.borderWidth || 1)"
              :style="{ filter: node._level === 0 ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))' }"
            />
            <!-- 节点文字 -->
            <text
              :x="node._width / 2"
              :y="node._height / 2 + 1"
              text-anchor="middle"
              dominant-baseline="central"
              :fill="node._level === 0 ? currentTheme.rootText : (node.style?.fontColor || currentTheme.nodeText)"
              :font-size="node._level === 0 ? 16 : (node.style?.fontSize || 13)"
              :font-weight="node._level === 0 ? 600 : 400"
              style="pointer-events: none; user-select: none;"
            >{{ node.title.length > 18 ? node.title.slice(0, 17) + '…' : node.title }}</text>
            <!-- 折叠/展开按钮 -->
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
            <!-- 快捷添加子节点按钮 -->
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

      <!-- 浮动的内联编辑输入框 -->
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

    <!-- 右侧样式面板 -->
    <div class="mm-style-panel" v-if="selectedNode && selectedNode._level > 0">
      <div class="panel-header">
        <span>节点样式</span>
        <el-button :icon="Close" circle size="small" text @click="selectedNodeId = null" />
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
        <el-button size="small" @click="addChildNode(selectedNode)" :icon="Plus">添加子节点</el-button>
        <el-button size="small" style="margin-left:8px" @click="addSiblingNode(selectedNode)" :icon="Plus">添加同级</el-button>
        <el-button size="small" style="margin-left:8px" type="danger" @click="deleteNode(selectedNode)" :icon="Delete">删除</el-button>
        <el-divider />
        <el-button size="small" type="warning" @click="resetNodeStyle(selectedNode)">重置样式</el-button>
      </div>
    </div>

    <!-- 快捷键提示 -->
    <div class="mm-hint">
      Tab 添加子节点 | Enter 添加同级 | Delete 删除 | 双击编辑 | 滚轮缩放 | 拖拽画布平移 | 拖拽节点移动
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, ZoomIn, ZoomOut, Download, Select, DocumentAdd, Close, Picture, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'

// ==================== 主题 ====================
const themes = {
  default: {
    label: '默认蓝',
    bg: '#f0f2f5',
    rootFill: '#409eff',
    rootText: '#ffffff',
    lineColor: '#b3c6e0',
    nodeFill: '#ffffff',
    nodeText: '#303133',
    nodeBorder: '#dcdfe6',
  },
  dark: {
    label: '暗夜黑',
    bg: '#1e1e2e',
    rootFill: '#7c3aed',
    rootText: '#ffffff',
    lineColor: '#4a4a6a',
    nodeFill: '#2d2d3f',
    nodeText: '#e0e0e0',
    nodeBorder: '#4a4a6a',
  },
  forest: {
    label: '森林绿',
    bg: '#f0f5f0',
    rootFill: '#2e8b57',
    rootText: '#ffffff',
    lineColor: '#b3d0c0',
    nodeFill: '#ffffff',
    nodeText: '#2c3e50',
    nodeBorder: '#c0d8c8',
  },
  sunset: {
    label: '日落橙',
    bg: '#fef9f0',
    rootFill: '#e67e22',
    rootText: '#ffffff',
    lineColor: '#e8c9a0',
    nodeFill: '#ffffff',
    nodeText: '#4a3728',
    nodeBorder: '#e0d0c0',
  },
  minimal: {
    label: '极简灰',
    bg: '#fafafa',
    rootFill: '#333333',
    rootText: '#ffffff',
    lineColor: '#d0d0d0',
    nodeFill: '#ffffff',
    nodeText: '#333333',
    nodeBorder: '#e0e0e0',
  },
}
const themeNames = Object.keys(themes).map(k => ({ label: themes[k].label, value: k }))
const currentThemeName = ref('default')
const currentTheme = computed(() => themes[currentThemeName.value])

// ==================== 数据模型 ====================
let idCounter = 0
const genId = () => `node_${Date.now()}_${idCounter++}`

function createNode(title, level = 0, children = []) {
  return {
    id: genId(),
    title,
    children,
    collapsed: false,
    style: null,
    _level: level,
    _x: 0,
    _y: 0,
    _width: 120,
    _height: 38,
    _totalHeight: 38,
  }
}

function cloneNode(node) {
  return {
    ...node,
    id: genId(),
    children: node.children.map(cloneNode),
    style: node.style ? { ...node.style } : null,
  }
}

// 初始示例数据
function createSampleData() {
  const root = createNode('思维导图', 0, [
    createNode('功能介绍', 1, [
      createNode('节点新增与编辑', 2),
      createNode('拖拽移动节点', 2),
      createNode('折叠/展开分支', 2),
      createNode('多主题切换', 2),
    ]),
    createNode('视觉样式', 1, [
      createNode('5 种内置主题', 2),
      createNode('节点颜色自定义', 2),
      createNode('字体与边框设置', 2),
      createNode('美观贝塞尔连线', 2),
    ]),
    createNode('数据管理', 1, [
      createNode('本地自动保存', 2),
      createNode('导出 JSON 格式', 2),
      createNode('导出 PNG 图片', 2),
    ]),
    createNode('交互操作', 1, [
      createNode('画布拖拽平移', 2),
      createNode('滚轮缩放', 2),
      createNode('快捷键支持', 2),
    ]),
  ])
  return root
}

const rootData = ref(createSampleData())

// ==================== 布局算法 ====================
const GAP_X = 170
const GAP_Y = 10
const NODE_PADDING_X = 20
const NODE_PADDING_Y = 8
const NODE_MIN_WIDTH = 90
const NODE_HEIGHT = 38

// Canvas-based text measurement
let measureCtx = null
function getTextWidth(text, fontSize) {
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')
  }
  measureCtx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  return measureCtx.measureText(text).width
}

function computeNodeWidth(node, fontSize) {
  const w = getTextWidth(node.title, fontSize || 13) + NODE_PADDING_X * 2
  return Math.max(NODE_MIN_WIDTH, Math.ceil(w))
}

function computeLayout(node, level = 0) {
  node._level = level
  const fs = level === 0 ? 16 : (node.style?.fontSize || 13)
  node._width = computeNodeWidth(node, fs)
  node._height = level === 0 ? 48 : NODE_HEIGHT

  const children = node.children
  if (!children || children.length === 0 || node.collapsed) {
    node._totalHeight = node._height
    return
  }

  let total = 0
  for (const child of children) {
    computeLayout(child, level + 1)
    total += child._totalHeight
  }
  total += (children.length - 1) * GAP_Y
  node._totalHeight = Math.max(node._height, total)
}

function assignPositions(node, x, topY) {
  const centerY = topY + node._totalHeight / 2
  node._x = x
  node._y = centerY - node._height / 2

  const children = node.children
  if (!children || children.length === 0 || node.collapsed) return

  const childrenTotalH = children.reduce((s, c) => s + c._totalHeight, 0) + (children.length - 1) * GAP_Y
  let childY = topY + (node._totalHeight - childrenTotalH) / 2

  for (const child of children) {
    assignPositions(child, x + node._width + GAP_X, childY)
    childY += child._totalHeight + GAP_Y
  }
}

function runLayout() {
  computeLayout(rootData.value, 0)
  // Root positioned at left-center of a reasonable canvas
  assignPositions(rootData.value, 80, 60)
}

// ==================== 视图状态 ====================
const canvasContainer = ref(null)
const svgRef = ref(null)
const editInputRef = ref(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const selectedNodeId = ref(null)
const editingNode = ref(null)
const editText = ref('')
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const dragNodeId = ref(null)
const dragStart = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const dragTargetParent = ref(null)

// ==================== 计算属性 ====================
const flatNodes = ref([])
const connections = ref([])

function collectNodesAndConnections() {
  const nodes = []
  const conns = []
  const lineColor = currentTheme.value.lineColor

  function walk(node) {
    nodes.push(node)
    if (node.children && !node.collapsed) {
      for (const child of node.children) {
        const parentRight = node._x + node._width
        const parentCY = node._y + node._height / 2
        const childLeft = child._x
        const childCY = child._y + child._height / 2
        const midX = (parentRight + childLeft) / 2

        conns.push({
          id: `${node.id}-${child.id}`,
          path: `M ${parentRight} ${parentCY} C ${midX} ${parentCY}, ${midX} ${childCY}, ${childLeft} ${childCY}`,
          color: lineColor,
        })
        walk(child)
      }
    }
  }
  walk(rootData.value)
  flatNodes.value = nodes
  connections.value = conns
}

function recalc() {
  runLayout()
  collectNodesAndConnections()
}

// ==================== 节点查找 ====================
function findNode(id, root = rootData.value) {
  if (root.id === id) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNode(id, child)
    if (found) return found
  }
  return null
}

function findParent(id, root = rootData.value) {
  if (!root.children) return null
  for (const child of root.children) {
    if (child.id === id) return root
    const found = findParent(id, child)
    if (found) return found
  }
  return null
}

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return findNode(selectedNodeId.value)
})

// ==================== 样式面板 ====================
const nodeStyle = reactive({
  fillColor: '#ffffff',
  fontColor: '#303133',
  borderColor: '#dcdfe6',
  borderWidth: 1,
  fontSize: 13,
})

watch(selectedNode, (node) => {
  if (node && node._level > 0) {
    nodeStyle.fillColor = node.style?.fillColor || currentTheme.value.nodeFill
    nodeStyle.fontColor = node.style?.fontColor || currentTheme.value.nodeText
    nodeStyle.borderColor = node.style?.borderColor || currentTheme.value.nodeBorder
    nodeStyle.borderWidth = node.style?.borderWidth ?? 1
    nodeStyle.fontSize = node.style?.fontSize ?? 13
  }
})

function applyStyle() {
  const node = selectedNode.value
  if (!node || node._level === 0) return
  pushUndo()
  node.style = {
    fillColor: nodeStyle.fillColor,
    fontColor: nodeStyle.fontColor,
    borderColor: nodeStyle.borderColor,
    borderWidth: nodeStyle.borderWidth,
    fontSize: nodeStyle.fontSize,
  }
  recalc()
}

function resetNodeStyle(node) {
  if (!node) return
  pushUndo()
  node.style = null
  recalc()
}

// ==================== 撤销/重做 ====================
const undoStack = ref([])
const redoStack = ref([])

function pushUndo() {
  undoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
  redoStack.value = []
  if (undoStack.value.length > 50) undoStack.value.shift()
}

function undo() {
  if (undoStack.value.length === 0) return
  redoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
  rootData.value = undoStack.value.pop()
  selectedNodeId.value = null
  recalc()
}

function redo() {
  if (redoStack.value.length === 0) return
  undoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
  rootData.value = redoStack.value.pop()
  selectedNodeId.value = null
  recalc()
}

// ==================== 节点操作 ====================
function addChildNode(parent) {
  pushUndo()
  const child = createNode('新节点', parent._level + 1)
  if (!parent.children) parent.children = []
  parent.children.push(child)
  recalc()
  selectedNodeId.value = child.id
  nextTick(() => startEdit(child))
}

function addSiblingNode(node) {
  if (node === rootData.value) return
  const parent = findParent(node.id)
  if (!parent) return
  pushUndo()
  const idx = parent.children.findIndex(c => c.id === node.id)
  const sibling = createNode('新节点', node._level)
  parent.children.splice(idx + 1, 0, sibling)
  recalc()
  selectedNodeId.value = sibling.id
  nextTick(() => startEdit(sibling))
}

function deleteNode(node) {
  if (node === rootData.value) {
    ElMessage.warning('不能删除根节点')
    return
  }
  pushUndo()
  const parent = findParent(node.id)
  if (parent) {
    const idx = parent.children.findIndex(c => c.id === node.id)
    if (idx > -1) parent.children.splice(idx, 1)
  }
  selectedNodeId.value = null
  recalc()
}

function toggleCollapse(node) {
  pushUndo()
  node.collapsed = !node.collapsed
  recalc()
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
  if (!editingNode.value) return
  const text = editText.value.trim()
  if (text && text !== editingNode.value.title) {
    pushUndo()
    editingNode.value.title = text
  }
  editingNode.value = null
  recalc()
}

function cancelEdit() {
  editingNode.value = null
}

// ==================== 画布交互 ====================
function onCanvasMouseDown(e) {
  if (e.target === svgRef.value || e.target.classList.contains('mm-svg')) {
    isPanning.value = true
    panStart.value = { x: e.clientX - panX.value, y: e.clientY - panY.value }
  }
  selectedNodeId.value = null
  if (editingNode.value && e.target !== editInputRef.value) {
    finishEdit()
  }
}

function onCanvasMouseMove(e) {
  if (isPanning.value) {
    panX.value = e.clientX - panStart.value.x
    panY.value = e.clientY - panStart.value.y
  }
  if (dragNodeId.value) {
    const dx = e.clientX - dragStart.value.x
    const dy = e.clientY - dragStart.value.y
    dragOffset.value = { x: dx, y: dy }

    // Find potential drop target under cursor
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

function onCanvasMouseUp() {
  isPanning.value = false
  if (dragNodeId.value) {
    handleDrop()
    dragNodeId.value = null
    dragOffset.value = { x: 0, y: 0 }
    dragTargetParent.value = null
    recalc()
  }
}

function onNodeMouseDown(e, node) {
  selectedNodeId.value = node.id
  if (node !== rootData.value && e.button === 0) {
    dragNodeId.value = node.id
    dragStart.value = { x: e.clientX, y: e.clientY }
    dragOffset.value = { x: 0, y: 0 }
  }
}

function onNodeMouseUp(e, node) {
  // handled by onCanvasMouseUp
}

function handleDrop() {
  const node = findNode(dragNodeId.value)
  if (!node || !dragTargetParent.value) return

  const target = dragTargetParent.value
  // Don't drop on self or descendant
  function isDescendant(ancestor, child) {
    if (!child.children) return false
    for (const c of child.children) {
      if (c.id === ancestor.id) return true
      if (isDescendant(ancestor, c)) return true
    }
    return false
  }
  if (node === target || isDescendant(target, node)) return

  pushUndo()
  // Remove from old parent
  const oldParent = findParent(node.id)
  if (oldParent) {
    oldParent.children = oldParent.children.filter(c => c.id !== node.id)
  }
  // Add to new parent
  if (!target.children) target.children = []
  target.children.push(node)
  node._level = target._level + 1
  selectedNodeId.value = node.id
}

function onWheel(e) {
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(3, Math.max(0.2, zoom.value * delta))

  // Zoom toward cursor position
  const rect = canvasContainer.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top

  const scale = newZoom / zoom.value
  panX.value = cx - scale * (cx - panX.value)
  panY.value = cy - scale * (cy - panY.value)
  zoom.value = newZoom
}

// ==================== 工具栏操作 ====================
function zoomIn() {
  zoom.value = Math.min(3, zoom.value * 1.2)
}

function zoomOut() {
  zoom.value = Math.max(0.2, zoom.value / 1.2)
}

function fitToCenter() {
  zoom.value = 1
  panX.value = 40
  panY.value = 40
}

function newMindMap() {
  pushUndo()
  rootData.value = createSampleData()
  selectedNodeId.value = null
  fitToCenter()
  recalc()
}

function switchTheme() {
  recalc()
}

function saveMindMap() {
  try {
    const data = JSON.stringify(rootData.value)
    localStorage.setItem('mindmap-data', data)
    ElMessage.success('已保存到本地存储')
  } catch {
    ElMessage.error('保存失败')
  }
}

function exportAsJSON() {
  const cleanNode = (node) => {
    const { _level, _x, _y, _width, _height, _totalHeight, ...rest } = node
    if (rest.children) rest.children = rest.children.map(cleanNode)
    return rest
  }
  const json = JSON.stringify(cleanNode(rootData.value), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `思维导图_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

function exportAsPNG() {
  const serializer = new XMLSerializer()
  const svgClone = svgRef.value.cloneNode(true)
  // Set explicit size
  const bbox = getSVGBBox()
  svgClone.setAttribute('width', bbox.width + 200)
  svgClone.setAttribute('height', bbox.height + 100)
  svgClone.setAttribute('viewBox', `${bbox.x - 80} ${bbox.y - 60} ${bbox.width + 200} ${bbox.height + 100}`)
  svgClone.querySelector('g').removeAttribute('transform')

  // Apply background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', bbox.x - 80)
  bg.setAttribute('y', bbox.y - 60)
  bg.setAttribute('width', bbox.width + 200)
  bg.setAttribute('height', bbox.height + 100)
  bg.setAttribute('fill', currentTheme.value.bg)
  svgClone.insertBefore(bg, svgClone.firstChild)

  const svgStr = serializer.serializeToString(svgClone)
  const img = new Image()
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width * 2
    canvas.height = img.height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.fillStyle = currentTheme.value.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    canvas.toBlob((pngBlob) => {
      const pngUrl = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `思维导图_${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(pngUrl)
      ElMessage.success('导出成功')
    }, 'image/png')
  }
  img.src = url
}

function getSVGBBox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of flatNodes.value) {
    minX = Math.min(minX, node._x)
    minY = Math.min(minY, node._y)
    maxX = Math.max(maxX, node._x + node._width)
    maxY = Math.max(maxY, node._y + node._height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ==================== 键盘快捷键 ====================
function onKeydown(e) {
  if (editingNode.value) return
  if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target !== editInputRef.value) return

  const node = selectedNode.value
  if (!node) return

  if (e.key === 'Tab') {
    e.preventDefault()
    addChildNode(node)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    addSiblingNode(node)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteNode(node)
  } else if (e.key === 'F2') {
    e.preventDefault()
    startEdit(node)
  } else if (e.ctrlKey && e.key === 'z') {
    e.preventDefault()
    undo()
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault()
    redo()
  } else if (e.key === ' ' && node.children && node.children.length > 0) {
    e.preventDefault()
    toggleCollapse(node)
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  // 尝试从 localStorage 加载
  try {
    const saved = localStorage.getItem('mindmap-data')
    if (saved) {
      const data = JSON.parse(saved)
      rootData.value = data
    }
  } catch { /* ignore */ }

  recalc()
  fitToCenter()

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', onCanvasMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseup', onCanvasMouseUp)
})
</script>

<style scoped>
.mindmap-app {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* 工具栏 */
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

.toolbar-left,
.toolbar-right {
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

/* 画布 */
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

/* 节点 */
.mm-node-group {
  cursor: pointer;
}

.mm-node-group:hover .add-child-btn {
  opacity: 1 !important;
}

.mm-node-group.selected rect:first-child {
  filter: drop-shadow(0 0 0 2px var(--el-color-primary)) !important;
}

/* 内联编辑 */
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

/* 样式面板 */
.mm-style-panel {
  position: absolute;
  top: 56px;
  right: 12px;
  width: 260px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
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
  background: var(--el-color-primary-light-9);
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

/* 提示 */
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

/* 主题适配 */
.mindmap-app :deep(.el-divider--vertical) {
  height: 20px;
  margin: 0 4px;
}
</style>
