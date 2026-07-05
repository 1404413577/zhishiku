<template>
  <div class="mindmap-app" :style="{ background: currentTheme.bg }">
    <MindMapSidebar
      :sessions="sessions"
      :activeSessionId="activeSessionId"
      :isSidebarOpen="isSidebarOpen"
      :rootData="rootData"
      @update:isSidebarOpen="isSidebarOpen = $event"
      @create="createNewSession"
      @select="switchSession"
      @delete="handleDeleteSession"
      @push-undo="pushUndo"
      @recalc="recalc"
      @focus-node="focusNode"
    />

    <div
      v-if="isSidebarOpen"
      class="sidebar-overlay"
      @click="isSidebarOpen = false"
    ></div>

    <div class="mm-main-content">
      <MindMapToolbar
        @ai-generate="aiDialogVisible = true"
        :zoom="zoom"
        :canUndo="canUndo"
        :canRedo="canRedo"
        :themeNames="themeNames"
        v-model:currentThemeName="currentThemeName"
        v-model:currentLineStyle="lineStyle"
        v-model:currentLayoutMode="layoutMode"
        @toggle-menu="isSidebarOpen = true"
        @import-md="mdDialogVisible = true"
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
        <svg
          ref="svgRef"
          class="mm-svg"
          :style="{ cursor: isPanning ? 'grabbing' : 'grab' }"
        >
          <defs>
            <pattern
              id="grid-pattern"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(0,0,0,0.06)"
                stroke-width="1"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#grid-pattern)"
            style="pointer-events: none"
          />

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
              :class="{
                selected: selectedNodeId === node.id,
                dragging: dragNodeId === node.id,
              }"
              @mousedown.stop="onNodeMouseDown($event, node)"
              @dblclick.stop="startEdit(node)"
            >
              <rect
                :width="node._width"
                :height="node._height"
                :rx="node._level === 0 ? 30 : 8"
                :ry="node._level === 0 ? 30 : 8"
                :fill="
                  node.style?.fillColor ||
                  (node._level === 0
                    ? currentTheme.rootFill
                    : currentTheme.nodeFill)
                "
                :stroke="
                  selectedNodeId === node.id
                    ? currentTheme.rootFill
                    : node.style?.borderColor || currentTheme.nodeBorder
                "
                :stroke-width="
                  selectedNodeId === node.id ? 2 : node.style?.borderWidth || 1
                "
                :style="{
                  filter:
                    node._level === 0
                      ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
                      : 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))',
                }"
              />
              <text
                :x="node._width / 2"
                :y="node._height / 2 + 1"
                text-anchor="middle"
                dominant-baseline="central"
                :fill="
                  node.style?.fontColor ||
                  (node._level === 0
                    ? currentTheme.rootText
                    : currentTheme.nodeText)
                "
                :font-size="
                  node.style?.fontSize || (node._level === 0 ? 16 : 13)
                "
                :font-weight="node._level === 0 ? 600 : 400"
                style="pointer-events: none; user-select: none"
              >
                {{
                  node.title.length > 18
                    ? node.title.slice(0, 17) + "…"
                    : node.title
                }}
              </text>
              <g
                v-if="node.note"
                :transform="`translate(${node._width - 24}, 8)`"
                style="cursor: help"
              >
                <title>{{ node.note }}</title>
                <rect width="16" height="16" rx="4" fill="rgba(0,0,0,0.05)" />
                <text
                  x="8"
                  y="8"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="10"
                >
                  📝
                </text>
              </g>
              <g
                v-if="node.children && node.children.length > 0"
                class="collapse-toggle"
                @mousedown.stop
                @click.stop="toggleCollapse(node)"
                :transform="`translate(${node._direction === -1 ? -4 : node._width + 4}, ${node._height / 2})`"
                style="cursor: pointer"
              >
                <circle
                  r="8"
                  :fill="node.collapsed ? currentTheme.rootFill : '#fff'"
                  :stroke="currentTheme.rootFill"
                  stroke-width="1.5"
                />
                <text
                  text-anchor="middle"
                  dominant-baseline="central"
                  :fill="node.collapsed ? '#fff' : currentTheme.rootFill"
                  font-size="12"
                  font-weight="bold"
                >
                  {{ node.collapsed ? "+" : "−" }}
                </text>
              </g>
              <g
                class="add-child-btn"
                @mousedown.stop
                @click.stop="addChildNode(node)"
                :transform="`translate(${node._direction === -1 ? -4 : node._width + 4}, ${node._height / 2 + 22})`"
                style="cursor: pointer; opacity: 0; transition: opacity 0.15s"
              >
                <circle r="7" fill="#67c23a" stroke="#fff" stroke-width="1" />
                <text
                  text-anchor="middle"
                  dominant-baseline="central"
                  fill="#fff"
                  font-size="12"
                  font-weight="bold"
                >
                  +
                </text>
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

    <el-dialog
      v-model="mdDialogVisible"
      title="导入 Markdown 生成导图"
      width="500px"
    >
      <el-input
        v-model="mdInputText"
        type="textarea"
        :rows="10"
        placeholder="支持使用 # 或 - 缩进表示层级...\n例如：\n# 核心主题\n## 分支1\n### 子分支"
      />
      <template #footer>
        <el-button @click="mdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleImportMarkdown"
          >生成导图</el-button
        >
      </template>
    </el-dialog>
    <el-dialog
      v-model="aiDialogVisible"
      title="✨ AI 一键生成思维导图"
      width="500px"
    >
      <div
        v-loading="isAiGenerating"
        element-loading-text="AI 正在疯狂思考并构建导图，请稍候..."
      >
        <p
          style="
            margin-bottom: 12px;
            font-size: 13px;
            color: var(--el-text-color-secondary);
          "
        >
          输入一个主题或一句话，AI 将自动为你发散思维并生成完整的导图大纲。
        </p>
        <el-input
          v-model="aiPrompt"
          type="textarea"
          :rows="4"
          placeholder="例如：帮我梳理一份 Vue3 的核心概念学习路径\n或者：双十一大促营销活动策划方案"
          @keydown.enter.prevent="handleAiGenerate"
        />
      </div>
      <template #footer>
        <el-button @click="aiDialogVisible = false" :disabled="isAiGenerating"
          >取消</el-button
        >
        <el-button
          type="primary"
          @click="handleAiGenerate"
          :disabled="!aiPrompt.trim() || isAiGenerating"
        >
          开始生成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { mindMapService } from "@/services/mindMapService";
const aiDialogVisible = ref(false);
const aiPrompt = ref("");
const isAiGenerating = ref(false);
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

import MindMapSidebar from "@/components/MindMap/MindMapSidebar.vue";
import MindMapToolbar from "@/components/MindMap/MindMapToolbar.vue";
import MindMapStylePanel from "@/components/MindMap/MindMapStylePanel.vue";

import { createNode } from "@/composables/mindmap/useNodeModel";
import {
  exportAsJSON,
  exportAsPNG,
} from "@/composables/mindmap/useExport";
import { useLayout } from "@/composables/mindmap/useLayout";
import { useViewport } from "@/composables/mindmap/useViewport";
import { useInlineEdit } from "@/composables/mindmap/useInlineEdit";
import { useCanvasInteractions } from "@/composables/mindmap/useCanvasInteractions";
import { useKeyboardShortcuts } from "@/composables/mindmap/useKeyboardShortcuts";
import { useUndoRedo } from "@/composables/mindmap/useUndoRedo";
import { useNodeOperations } from "@/composables/mindmap/useNodeOperations";
import { usePersist } from "@/composables/mindmap/usePersist";
// 导入 Markdown 转换器
import { useMarkdown } from "@/composables/mindmap/useMarkdown";

const rootData = ref(createNode("中心主题", 0));
const selectedNodeId = ref(null);
const isSidebarOpen = ref(false);

const lineStyle = ref("curve");
const layoutMode = ref("right"); // 新增：'right' 或 'centered'

const canvasContainer = ref(null);
const svgRef = ref(null);

/**
 * AI 一键生成思维导图核心算法 (流式实时渲染版)
 */
async function handleAiGenerate() {
  const text = aiPrompt.value.trim();
  if (!text || isAiGenerating.value) return;

  isAiGenerating.value = true;

  // 1. 立刻关闭弹窗，让用户能直观看到背后的画布
  aiDialogVisible.value = false;

  // 2. 提前记录一次历史，防止撤销栈被中间生成状态塞满
  pushUndo();

  // 3. 在画布上立刻生成一个带有用户问题的“根节点”作为起点
  const rootTitle = mindMapService.getRootTitle(text);
  rootData.value = createNode(rootTitle, 0);
  recalc();
  fitToCenter();

  try {
    await mindMapService.generateMarkdownOutline(text, (markdown) => {
      const parsedData = parseMarkdownToData(markdown);
      parsedData.title = rootTitle;
      rootData.value = parsedData;
      recalc();
    });

    // 生成完全结束后，清空输入框提示成功，并让整个导图居中自适应
    aiPrompt.value = "";
    ElMessage.success("✨ 导图生成完毕！");
    fitToCenter();
  } catch (error) {
    ElMessage.error("AI 生成失败：" + error.message);
  } finally {
    isAiGenerating.value = false;
  }
}

// MD 弹窗
const mdDialogVisible = ref(false);
const mdInputText = ref("");
const { parseMarkdownToData } = useMarkdown();

const themes = {
  default: {
    label: "默认蓝",
    bg: "#f0f2f5",
    rootFill: "#409eff",
    rootText: "#ffffff",
    lineColor: "#b3c6e0",
    nodeFill: "#ffffff",
    nodeText: "#303133",
    nodeBorder: "#dcdfe6",
  },
  dark: {
    label: "暗夜黑",
    bg: "#1e1e2e",
    rootFill: "#7c3aed",
    rootText: "#ffffff",
    lineColor: "#4a4a6a",
    nodeFill: "#2d2d3f",
    nodeText: "#e0e0e0",
    nodeBorder: "#4a4a6a",
  },
  forest: {
    label: "森林绿",
    bg: "#f0f5f0",
    rootFill: "#2e8b57",
    rootText: "#ffffff",
    lineColor: "#b3d0c0",
    nodeFill: "#ffffff",
    nodeText: "#2c3e50",
    nodeBorder: "#c0d8c8",
  },
};
const themeNames = Object.keys(themes).map((k) => ({
  label: themes[k].label,
  value: k,
}));
const currentThemeName = ref("default");
const currentTheme = computed(() => themes[currentThemeName.value]);

// 传入 layoutMode 驱动左右分支布局
const { flatNodes, connections, recalc } = useLayout(
  rootData,
  currentTheme,
  lineStyle,
  layoutMode,
);

const { canUndo, canRedo, pushUndo, undo, redo, clearHistory } = useUndoRedo(
  rootData,
  () => {
    selectedNodeId.value = null;
    recalc();
  },
);

function resolveNode(id) {
  return findNode(id);
}

const {
  zoom,
  panX,
  panY,
  fitToCenter,
  zoomIn,
  zoomOut,
  focusNode,
  onWheel,
} = useViewport({
  canvasContainer,
  findNode: resolveNode,
});

const {
  editingNode,
  editText,
  editInputRef,
  editInputStyle,
  startEdit,
  finishEdit,
  cancelEdit,
} = useInlineEdit({
  panX,
  panY,
  zoom,
  pushUndo,
  recalc,
});

const {
  findNode,
  findParent,
  addChildNode,
  addSiblingNode,
  deleteNode,
  toggleCollapse,
} = useNodeOperations({
  rootData,
  selectedNodeId,
  pushUndo,
  recalc,
  startEdit: (node) => startEdit(node),
});

const selectedNode = computed(() =>
  selectedNodeId.value ? findNode(selectedNodeId.value) : null,
);

const {
  isPanning,
  dragNodeId,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onNodeMouseDown,
} = useCanvasInteractions({
  rootData,
  selectedNodeId,
  zoom,
  panX,
  panY,
  svgRef,
  editInputRef,
  editingNode,
  finishEdit,
  findNode,
  findParent,
  pushUndo,
  recalc,
});

const {
  sessions,
  activeSessionId,
  loadSessions,
  saveMindMap,
  createNewSession,
  switchSession,
  deleteSession,
} = usePersist(rootData, () => {
  selectedNodeId.value = null;
  if (clearHistory) clearHistory();
  recalc();
  fitToCenter();
});

watch(currentThemeName, () => recalc());
watch(lineStyle, () => recalc());
watch(layoutMode, () => recalc()); // 模式切换自动排版

useKeyboardShortcuts({
  editingNode,
  editInputRef,
  selectedNode,
  addChildNode,
  addSiblingNode,
  deleteNode,
  toggleCollapse,
  startEdit,
  undo,
  redo,
});

// 导入 Markdown 文本覆盖画布
function handleImportMarkdown() {
  if (!mdInputText.value.trim()) return;
  pushUndo();
  rootData.value = parseMarkdownToData(mdInputText.value);
  recalc();
  fitToCenter();
  mdDialogVisible.value = false;
  mdInputText.value = "";
  ElMessage.success("导入成功！");
}

// ... 此处保留原有的 handleDeleteSession, applyStyleFromPanel, SVG 画布拖拽事件 (onCanvasMouseDown 等) ...
function handleDeleteSession(id) {
  ElMessageBox.confirm("确定要删除吗？", "提示", { type: "warning" })
    .then(() => deleteSession(id))
    .catch(() => {});
}
function applyStyleFromPanel(newStyle) {
  if (!selectedNode.value) return;
  pushUndo();
  selectedNode.value.style = { ...newStyle };
  recalc();
}
function resetNodeStyle(node) {
  if (!node) return;
  pushUndo();
  node.style = null;
  recalc();
}
function exportAsJSONFn() {
  exportAsJSON(rootData.value);
}
function exportAsPNGFn() {
  exportAsPNG(svgRef.value, flatNodes.value, currentTheme.value);
}

onMounted(() => {
  loadSessions();
});
</script>

<style scoped>
/* 保持原有样式不变 */
.mindmap-app {
  display: flex;
  flex-direction: row;
  height: calc(100vh - 60px);
  position: relative;
  overflow: hidden;
  user-select: none;
}
.mm-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 14;
}
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
.mm-node-group {
  cursor: pointer;
}
.mm-node-group:hover .add-child-btn {
  opacity: 1 !important;
}
.mm-node-group.selected rect:first-child {
  filter: drop-shadow(0 0 0 2px var(--el-color-primary)) !important;
}
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
</style>
