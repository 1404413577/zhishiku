import { shallowRef, onMounted, onBeforeUnmount } from 'vue'
import MindMap from 'simple-mind-map'
// 引入官方核心插件
import Drag from 'simple-mind-map/src/plugins/Drag.js'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js'
import Export from 'simple-mind-map/src/plugins/Export.js'

// 注册插件 (赋予引擎拖拽、快捷键、导出能力)
MindMap.usePlugin(Drag)
MindMap.usePlugin(KeyboardNavigation)
MindMap.usePlugin(Export)

export function useMindMapEngine(containerRef, docId, rootTitle) {
  const mindMap = shallowRef(null)
  const storageKey = `zhishiku-mindmap-${docId}`

  const initEngine = () => {
    // 1. 读取本地数据或初始化默认节点
    const saved = localStorage.getItem(storageKey)
    const initialData = saved ? JSON.parse(saved) : {
      data: { text: rootTitle },
      children: []
    }

    // 2. 实例化引擎
    mindMap.value = new MindMap({
      el: containerRef.value,
      data: initialData,
      theme: 'classic', // 内置经典主题
      layout: 'mindMap', // 默认中心分布
      fit: true, // 自动缩放适应屏幕
      enableFreeDrag: true, // 允许节点跨分支自由拖拽
    })

    // 3. 监听画布数据变化，自动实时保存
    mindMap.value.on('data_change', (data) => {
      localStorage.setItem(storageKey, JSON.stringify(data))
    })
  }

  // 对外暴露的 API
  const undo = () => mindMap.value?.execCommand('BACK')
  const redo = () => mindMap.value?.execCommand('FORWARD')
  const exportToImage = () => mindMap.value?.export('png', true, `${rootTitle}-思维导图`)
  
  // 切换布局算法
  const toggleLayoutMode = (mode) => {
    if (mindMap.value) {
      mindMap.value.setLayout(mode)
    }
  }
  
  // 重置导图
  const resetMap = () => {
    const newData = { data: { text: rootTitle }, children: [] }
    mindMap.value?.setData(newData)
    localStorage.setItem(storageKey, JSON.stringify(newData))
  }

  onMounted(() => {
    if (containerRef.value) initEngine()
  })

  onBeforeUnmount(() => {
    if (mindMap.value) mindMap.value.destroy()
  })

  return {
    mindMap,
    undo,
    redo,
    exportToImage,
    toggleLayoutMode,
    resetMap
  }
}