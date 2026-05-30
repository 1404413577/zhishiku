import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'highlight.js/styles/github.css'
import App from './App.vue'
import router from './router'
import { initPerformanceMonitoring } from './utils/performance.js'
import { registerSW } from 'virtual:pwa-register'



// 注册 PWA Service Worker
// if (import.meta.env.PROD) {
//   registerSW({ immediate: true })
// }

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

app.mount('#app')

// 🚨 新增：立即注册 Service Worker，接管离线缓存
// registerSW({
//   immediate: true,
//   onOfflineReady() {
//     console.log('✅ PWA: 应用已准备好离线运行')
//   },
//   onNeedRefresh() {
//     console.log('🔄 PWA: 有新内容可用，请刷新页面')
//   }
// })

// 在 Pinia 安装后再加载开发调试工具
if (import.meta.env.DEV) {
  import('./utils/debugStorage.js')
  import('./utils/searchDebug.js')
}

// 初始化性能监控
if (import.meta.env.PROD) {
  initPerformanceMonitoring()
}

// 在开发环境中监听文档变化
if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.on('docs-changed', async (data) => {
    console.log('📄 检测到文档变化，重新加载预设文档...', data)

    // 获取文档存储实例并强制刷新
    const { useDocumentsStore } = await import('./stores/documents.js')
    const documentsStore = useDocumentsStore()

    try {
      await documentsStore.refreshPresetDocs()
      console.log('✅ 预设文档已更新')
    } catch (error) {
      console.error('❌ 更新预设文档失败:', error)
    }
  })
}
