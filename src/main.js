import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'highlight.js/styles/github.css'
import App from './App.vue'
import router from './router'
import { initPerformanceMonitoring } from './utils/performance.js'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch((error) => console.warn('清理旧 Service Worker 失败:', error))
}

if (import.meta.env.PROD && 'caches' in window) {
  caches.keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch((error) => console.warn('清理旧离线缓存失败:', error))
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

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
