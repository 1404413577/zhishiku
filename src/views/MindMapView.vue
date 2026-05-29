<template>
  <div class="mindmap-layout">
    <MindMapToolbar />
    <div ref="containerRef" class="mindmap-engine-container"></div>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useRoute } from 'vue-router'
import MindMapToolbar from '@/components/MindMap/MindMapToolbar.vue'
import { useMindMapEngine } from '@/composables/mindmap/useMindMapEngine'
import { useDocumentsStore } from '@/stores/documents'

const route = useRoute()
const docsStore = useDocumentsStore()

// 路由与知识库联动
const docId = route.params.id || route.query.id || 'default_mindmap'
const targetDoc = docsStore.documents.find(d => d.id === docId)
const rootTitle = targetDoc ? targetDoc.title : '中心主题'

const containerRef = ref(null)

// 启动引擎！
const { 
  undo, redo, exportToImage, toggleLayoutMode, resetMap 
} = useMindMapEngine(containerRef, docId, rootTitle)

// 将大权（方法）下放给工具栏
provide('mindmap-context', {
  undo, redo, exportToImage, toggleLayoutMode, resetMap
})
</script>

<style scoped>
.mindmap-layout {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f6f8fa; /* 护眼背景 */
}
.mindmap-engine-container {
  width: 100%;
  height: 100%;
}
</style>