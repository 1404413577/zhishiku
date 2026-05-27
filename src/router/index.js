import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '知识库首页' }
  },
  {
    path: '/editor/:id(.*)?',
    name: 'Editor',
    component: () => import('@/views/Editor.vue'),
    meta: { title: '编辑器' }
  },
  {
    path: '/view/:id(.*)',
    name: 'Viewer',
    component: () => import('@/views/Viewer.vue'),
    meta: { title: '文档查看' }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/views/Search.vue'),
    meta: { title: '搜索' }
  },
  {
    path: '/md-docs',
    name: 'MdDocs',
    component: () => import('@/views/MdDocs.vue'),
    meta: { title: 'Markdown 文档' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于我' }
  },
  {
    path: '/chat',
    name: 'ChatView',
    component: () => import('@/views/ChatView.vue'),
    meta: { title: 'AI 对话' }
  },
  {
    path: '/graph',
    name: 'GraphView',
    component: () => import('@/views/GraphView.vue'),
    meta: { title: '关系图谱' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/mindmap',
    name: 'MindMap',
    component: () => import('@/views/MindMapView.vue'),
    meta: { title: '思维导图' }
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - 知识库`
  }
  next()
})

export default router
