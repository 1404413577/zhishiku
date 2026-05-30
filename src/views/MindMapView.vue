<template>
  <div class="immersive-mindmap-layout">
    <div class="canvas-bg-dots"></div>

    <div class="floating-header">
      <el-button class="glass-btn" @click="router.back()" :icon="ArrowLeft" circle />
      <div class="doc-title-pill">
        <span class="title-text">{{ rootTitle }}</span>
        <div class="status-dot"></div>
      </div>
    </div>

    <div class="floating-toolbar-island">
      <MindMapToolbar />
    </div>

    <div ref="containerRef" class="mindmap-engine-container"></div>

    <div class="floating-view-controls">
      <div v-show="showMiniMap" ref="minimapRef" class="minimap-container"></div>
      <div class="control-actions glass-panel">
        <el-tooltip content="居中画布" placement="left">
          <el-button @click="fitView" :icon="Aim" circle />
        </el-tooltip>
        <el-tooltip content="切换小地图" placement="left">
          <el-button @click="showMiniMap = !showMiniMap" :icon="MapLocation" circle :type="showMiniMap ? 'primary' : 'default'" />
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MindMapToolbar from '@/components/MindMap/MindMapToolbar.vue'
import { useMindMapEngine } from '@/composables/mindmap/useMindMapEngine'
import { useDocumentsStore } from '@/stores/documents'
import { ArrowLeft, Aim, MapLocation } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const docsStore = useDocumentsStore()

const docId = route.params.id || route.query.id || 'default_mindmap'
const targetDoc = docsStore.documents.find(d => d.id === docId)
const rootTitle = targetDoc ? targetDoc.title : '中心主题'

const containerRef = ref(null)
const minimapRef = ref(null)
const showMiniMap = ref(false) // 默认隐藏小地图

// 启动引擎，传入小地图 ref
const { 
  undo, redo, exportToImage, toggleLayoutMode, resetMap, fitView
} = useMindMapEngine(containerRef, minimapRef, docId, rootTitle)

// 下放方法给工具栏
provide('mindmap-context', {
  undo, redo, exportToImage, toggleLayoutMode, resetMap
})
</script>

<style scoped>
.immersive-mindmap-layout {
  position: relative;
  width: 100%;
  height: 100vh; /* 撑满屏幕 */
  overflow: hidden;
  background-color: var(--el-bg-color);
}

/* 现代感点阵背景 */
.canvas-bg-dots {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(var(--el-border-color-lighter) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.6;
  z-index: 0;
}

.mindmap-engine-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1; /* 画布在底层 */
}

/* --- 悬浮组件通用样式 --- */
.glass-btn, .doc-title-pill, .glass-panel {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* 左上角标题区域 */
.floating-header {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  display: flex;
  gap: 12px;
  align-items: center;
}

.doc-title-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 999px;
}

.title-text {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--el-color-success);
  box-shadow: 0 0 8px var(--el-color-success);
}

/* 正上方工具栏 */
.floating-toolbar-island {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

/* 右下角视图控制 */
.floating-view-controls {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
}

.minimap-container {
  width: 240px;
  height: 160px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  overflow: hidden;
  transition: all 0.3s ease;
}

.control-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 999px;
}
</style>