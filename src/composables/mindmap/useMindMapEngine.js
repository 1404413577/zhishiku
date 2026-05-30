import { shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import MindMap from 'simple-mind-map'
// 引入官方核心插件
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import Export from 'simple-mind-map/src/plugins/Export.js'
// 🚨 新增：引入小地图插件
import MiniMap from 'simple-mind-map/src/plugins/MiniMap.js' 

// 注册插件
MindMap.usePlugin(Drag)
MindMap.usePlugin(KeyboardNavigation)
MindMap.usePlugin(Export)
MindMap.usePlugin(MiniMap) // 注册小地图

// 🚨 修改参数：接收 minimapRef
export function useMindMapEngine(containerRef, minimapRef, docId, rootTitle) {
  const mindMap = shallowRef(null)
  const storageKey = `zhishiku-mindmap-${docId}`

  const initEngine = () => {
    const saved = localStorage.getItem(storageKey)
    const initialData = saved ? JSON.parse(saved) : {
      data: { text: rootTitle },
      children: []
    }

    // 动态检测当前是否为暗黑模式
    const isDark = document.documentElement.classList.contains('dark')

    mindMap.value = new MindMap({
      el: containerRef.value,
      data: initialData,
      theme: isDark ? 'dark' : 'classic', // 适配暗黑模式
      layout: 'mindMap', 
      fit: true, 
      enableFreeDrag: true, 
    })

    // 🚨 挂载小地图
    if (minimapRef && minimapRef.value) {
      mindMap.value.miniMap.calculationMiniMap(minimapRef.value)
    }

    // 监听数据变化
    mindMap.value.on('data_change', (data) => {
      localStorage.setItem(storageKey, JSON.stringify(data))
    })
  }

  // 暴露 API
  const undo = () => mindMap.value?.execCommand('BACK')
  const redo = () => mindMap.value?.execCommand('FORWARD')
  const exportToImage = () => mindMap.value?.export('png', true, `${rootTitle}-思维导图`)
  
  const toggleLayoutMode = (mode) => {
    if (mindMap.value) mindMap.value.setLayout(mode)
  }
  
  // 一键居中适应屏幕
  const fitView = () => {
    if (mindMap.value) {
      mindMap.value.view.reset()
    }
  }

  const resetMap = () => {
    if (confirm('确定要清空并重置当前思维导图吗？')) {
      localStorage.removeItem(storageKey)
      mindMap.value.setData({ data: { text: rootTitle }, children: [] })
    }
  }

  onMounted(() => {
    initEngine()
  })

  onBeforeUnmount(() => {
    if (mindMap.value) {
      mindMap.value.destroy()
    }
  })

  return { mindMap, undo, redo, exportToImage, toggleLayoutMode, resetMap, fitView }
}