<template>
  <main class="about-page">
    <section class="about-hero">
      <div class="hero-grid" aria-labelledby="about-title">
        <div class="hero-copy">
          <div class="system-chip">
            <span class="chip-pulse"></span>
            KNOWLEDGE OS / v{{ appVersion }}
          </div>
          <h1 id="about-title">知识库管理系统</h1>
          <p class="hero-lead">
            一个运行在浏览器里的个人知识引擎，把 Markdown 写作、全文搜索、标签组织、AI 对话和本地数据管理收束到同一个工作台。
          </p>
          <div class="hero-actions">
            <el-button type="primary" size="large" @click="router.push('/')">
              进入工作台
            </el-button>
            <el-button size="large" plain @click="router.push('/md-docs')">
              查看文档
            </el-button>
          </div>
        </div>

        <aside class="system-console" aria-label="系统状态面板">
          <div class="console-bar">
            <span></span><span></span><span></span>
            <strong>zhishiku.core</strong>
          </div>
          <div class="console-body">
            <div class="console-line"><span>$</span> boot knowledge graph</div>
            <div class="console-line success"><span>OK</span> indexed documents: {{ stats.total }}</div>
            <div class="console-line"><span>AI</span> markdown / search / tags / chat</div>
            <div class="signal-map">
              <i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="metrics-strip" aria-label="系统统计">
      <div class="metric-card">
        <span>文档总数</span>
        <strong>{{ stats.total }}</strong>
      </div>
      <div class="metric-card">
        <span>标签数量</span>
        <strong>{{ stats.tags }}</strong>
      </div>
      <div class="metric-card">
        <span>存储使用</span>
        <strong>{{ formatFileSize(stats.storageUsed) }}</strong>
      </div>
      <div class="metric-card">
        <span>使用天数</span>
        <strong>{{ daysSinceFirstDoc }}</strong>
      </div>
    </section>

    <section class="content-sections">
      <section class="intro-panel panel-large">
        <div class="section-heading">
          <span>01 / SYSTEM</span>
          <h2>为个人知识流设计的前端系统</h2>
        </div>
        <p class="intro-text">
          知识库管理系统是一个基于现代 Web 技术栈构建的纯前端知识管理应用。它提供文档创建、编辑、组织和搜索能力，支持 Markdown 语法，让知识内容可以被持续沉淀、快速检索并重新组织。
        </p>
        <div class="features-grid">
          <div class="feature-item">
            <el-icon><Edit /></el-icon>
            <div class="feature-content">
              <h4>Markdown 编辑</h4>
              <p>结构化写作、实时预览和代码高亮。</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><Search /></el-icon>
            <div class="feature-content">
              <h4>智能搜索</h4>
              <p>全文检索，快速回到关键内容。</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><Collection /></el-icon>
            <div class="feature-content">
              <h4>标签管理</h4>
              <p>用轻量标签建立可演化的分类体系。</p>
            </div>
          </div>
          <div class="feature-item">
            <el-icon><Download /></el-icon>
            <div class="feature-content">
              <h4>数据导入导出</h4>
              <p>支持备份、迁移和长期保管。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="tech-panel">
        <div class="section-heading compact">
          <span>02 / STACK</span>
          <h2>技术栈</h2>
        </div>
        <div class="tech-stack">
          <div class="tech-category">
            <h4>前端框架</h4>
            <div class="tech-items">
              <el-tag v-for="tech in frontendTech" :key="tech.name" :type="tech.type" size="large">
                {{ tech.name }}
              </el-tag>
            </div>
          </div>
          <div class="tech-category">
            <h4>UI 组件库</h4>
            <div class="tech-items">
              <el-tag v-for="tech in uiTech" :key="tech.name" :type="tech.type" size="large">
                {{ tech.name }}
              </el-tag>
            </div>
          </div>
          <div class="tech-category">
            <h4>工具链</h4>
            <div class="tech-items">
              <el-tag v-for="tech in toolTech" :key="tech.name" :type="tech.type" size="large">
                {{ tech.name }}
              </el-tag>
            </div>
          </div>
        </div>
      </section>

      <section class="feature-panel panel-large">
        <div class="section-heading">
          <span>03 / CAPABILITY</span>
          <h2>核心特性矩阵</h2>
        </div>
        <div class="features-list">
          <div v-for="feature in coreFeatures" :key="feature.title" class="feature-row">
            <div class="feature-icon">
              <el-icon :color="feature.color">
                <component :is="feature.icon" />
              </el-icon>
            </div>
            <div class="feature-details">
              <h4>{{ feature.title }}</h4>
              <p>{{ feature.description }}</p>
            </div>
            <div class="feature-status">
              <el-tag :type="feature.status === 'completed' ? 'success' : 'info'" size="small">
                {{ feature.status === 'completed' ? '已完成' : '开发中' }}
              </el-tag>
            </div>
          </div>
        </div>
      </section>

      <section class="quick-panel">
        <div class="section-heading compact">
          <span>04 / START</span>
          <h2>快速入门</h2>
        </div>
        <div class="steps">
          <div v-for="(step, index) in quickStartSteps" :key="index" class="step-item">
            <div class="step-number">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="step-content">
              <h4>{{ step.title }}</h4>
              <p>{{ step.description }}</p>
              <el-button v-if="step.action" size="small" type="primary" @click="step.action">
                {{ step.buttonText }}
              </el-button>
            </div>
          </div>
        </div>
      </section>

      <section class="changelog-panel panel-large">
        <div class="section-heading">
          <span>05 / RELEASE</span>
          <h2>更新日志</h2>
        </div>
        <el-timeline class="changelog">
          <el-timeline-item
            v-for="log in changelog"
            :key="log.version"
            :timestamp="log.date"
            :type="log.type"
          >
            <div class="changelog-item">
              <h4>{{ log.version }}</h4>
              <ul>
                <li v-for="change in log.changes" :key="change">{{ change }}</li>
              </ul>
            </div>
          </el-timeline-item>
        </el-timeline>
      </section>

      <section class="contact-panel">
        <div class="section-heading compact">
          <span>06 / LINK</span>
          <h2>联系我们</h2>
        </div>
        <div class="contact-info">
          <div class="contact-item">
            <el-icon><Link /></el-icon>
            <span>项目地址</span>
            <el-link href="git@github.com:1404413577/shizhiku.git" target="_blank" type="primary">
              GitHub Repository
            </el-link>
          </div>
          <div class="contact-item">
            <el-icon><ChatDotRound /></el-icon>
            <span>问题反馈</span>
            <el-link href="https://github.com/your-repo/issues" target="_blank" type="primary">
              提交 Issue
            </el-link>
          </div>
          <div class="contact-item">
            <el-icon><Document /></el-icon>
            <span>使用文档</span>
            <el-link href="/md-docs" type="primary" @click="$router.push('/md-docs')">
              查看文档
            </el-link>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentsStore } from '@/stores/documents.js'
import { usePageSEO } from '@/composables/useSEO.js'
import {
  Document, Edit, Search, Collection, Download, Link, ChatDotRound
} from '@element-plus/icons-vue'

const router = useRouter()
const documentsStore = useDocumentsStore()

// SEO 配置
usePageSEO({
  title: '关于我们 - 知识库管理系统',
  description: '了解知识库管理系统的功能特性、技术栈和开发团队。基于 Vue 3、Element Plus 构建的现代化应用。',
  keywords: '关于我们,系统介绍,技术栈,Vue3,Element Plus'
})

// 应用版本
const appVersion = ref('1.0.0')

// 技术栈数据
const frontendTech = ref([
  { name: 'Vue 3', type: 'success' },
  { name: 'Vite', type: 'warning' },
  { name: 'Pinia', type: 'info' }
])

const uiTech = ref([
  { name: 'Element Plus', type: 'primary' },
  { name: 'CSS3', type: 'success' }
])

const toolTech = ref([
  { name: 'LocalForage', type: 'info' },
  { name: 'Markdown-it', type: 'warning' },
  { name: 'ESLint', type: 'danger' }
])

// 系统统计
const stats = computed(() => ({
  ...documentsStore.stats,
  storageUsed: calculateStorageUsage()
}))

// 计算存储使用量
const calculateStorageUsage = () => {
  const docs = documentsStore.documents
  let totalSize = 0
  docs.forEach(doc => {
    totalSize += (doc.content || '').length + (doc.title || '').length
  })
  return totalSize
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 计算使用天数
const daysSinceFirstDoc = computed(() => {
  const docs = documentsStore.documents
  if (docs.length === 0) return 0

  // 过滤掉没有有效 createdAt 的文档
  const validDocs = docs.filter(doc => {
    const d = new Date(doc.createdAt)
    return doc.createdAt && !isNaN(d.getTime())
  })
  if (validDocs.length === 0) return 1

  const firstDoc = validDocs.reduce((earliest, doc) => {
    return new Date(doc.createdAt) < new Date(earliest.createdAt) ? doc : earliest
  })
  const firstDate = new Date(firstDoc.createdAt)
  if (isNaN(firstDate.getTime())) return 1

  const daysDiff = Math.floor((new Date() - firstDate) / (1000 * 60 * 60 * 24))
  return Math.max(1, daysDiff)
})

// 核心特性
const coreFeatures = ref([
  {
    icon: 'Edit',
    title: 'Markdown 编辑器',
    description: '支持实时预览的 Markdown 编辑器，提供丰富的编辑功能',
    color: 'var(--el-color-primary)',
    status: 'completed'
  },
  {
    icon: 'Search',
    title: '全文搜索',
    description: '基于内容的智能搜索，快速定位所需文档',
    color: 'var(--el-color-success)',
    status: 'completed'
  },
  {
    icon: 'Collection',
    title: '标签系统',
    description: '灵活的标签管理，支持多标签分类和筛选',
    color: 'var(--el-color-warning)',
    status: 'completed'
  },
  {
    icon: 'Download',
    title: '数据管理',
    description: '支持文档导入导出，数据备份和迁移',
    color: 'var(--el-color-info)',
    status: 'completed'
  }
])

// 快速入门步骤
const quickStartSteps = ref([
  {
    title: '创建第一个文档',
    description: '点击"新建文档"按钮，开始编写您的第一篇知识文档',
    buttonText: '立即创建',
    action: () => router.push('/')
  },
  {
    title: '使用 Markdown 语法',
    description: '学习基本的 Markdown 语法，让您的文档更加美观',
    buttonText: '查看文档',
    action: () => router.push('/md-docs')
  },
  {
    title: '组织和搜索',
    description: '使用标签组织文档，通过搜索功能快速找到需要的内容',
    buttonText: '开始搜索',
    action: () => router.push('/search')
  }
])

import autoChangelog from 'virtual:changelog'

// 更新日志自动获取
const changelog = ref(autoChangelog)

// 初始化
onMounted(async () => {
  if (documentsStore.documents.length === 0) {
    await documentsStore.loadDocuments()
  }
})
</script>

<style scoped>
.about-page {
  min-height: calc(100dvh - 50px);
  background:
    radial-gradient(circle at 82% 6%, rgba(15, 159, 110, 0.12), transparent 28%),
    radial-gradient(circle at 6% 18%, rgba(37, 99, 235, 0.08), transparent 24%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 48%, #f8fafc 100%);
  color: #17202a;
  overflow: hidden;
}

.about-hero {
  position: relative;
  padding: 72px 32px 36px;
  isolation: isolate;
}

.about-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(rgba(23, 32, 42, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 32, 42, 0.045) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, black 0%, transparent 78%);
}

.about-hero::after {
  content: '';
  position: absolute;
  width: 44vw;
  height: 44vw;
  right: -16vw;
  top: -18vw;
  z-index: -1;
  background: radial-gradient(circle, rgba(15, 159, 110, 0.18), transparent 64%);
  filter: blur(12px);
}

.hero-grid,
.content-sections,
.metrics-strip {
  width: min(1280px, calc(100vw - 64px));
  margin: 0 auto;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
  gap: 36px;
  align-items: center;
}

.hero-copy {
  min-width: 0;
}

.system-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 6px 12px;
  color: #087752;
  background: rgba(15, 159, 110, 0.09);
  border: 1px solid rgba(15, 159, 110, 0.22);
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.chip-pulse {
  width: 8px;
  height: 8px;
  background: #0f9f6e;
  border-radius: 999px;
  box-shadow: 0 0 14px rgba(15, 159, 110, 0.48);
}

.hero-copy h1 {
  max-width: 780px;
  margin: 22px 0 18px;
  color: #111827;
  font-size: clamp(44px, 6vw, 84px);
  font-weight: 760;
  line-height: 0.98;
  letter-spacing: 0;
  text-wrap: balance;
}

.hero-lead {
  max-width: 62ch;
  margin: 0;
  color: #536173;
  font-size: 17px;
  line-height: 1.75;
  text-wrap: pretty;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.hero-actions :deep(.el-button) {
  min-height: 44px;
  border-radius: 6px;
  font-weight: 700;
}

.hero-actions :deep(.el-button--primary) {
  color: #ffffff;
  background: #0f9f6e;
  border-color: #0f9f6e;
  box-shadow: 0 12px 24px rgba(15, 159, 110, 0.2);
}

.hero-actions :deep(.el-button.is-plain) {
  color: #1f2937;
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(96, 112, 131, 0.28);
}

.hero-actions :deep(.el-button:hover) {
  transform: translateY(-1px);
}

.system-console {
  position: relative;
  min-height: 420px;
  border: 1px solid rgba(96, 112, 131, 0.2);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(15, 159, 110, 0.08), transparent 42%),
    rgba(255, 255, 255, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 32px 70px rgba(72, 91, 113, 0.16);
  overflow: hidden;
}

.console-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 16px;
  color: #607083;
  border-bottom: 1px solid rgba(96, 112, 131, 0.16);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.console-bar span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: rgba(96, 112, 131, 0.35);
}

.console-bar span:first-child { background: #ff5f56; }
.console-bar span:nth-child(2) { background: #ffbd2e; }
.console-bar span:nth-child(3) { background: #27c93f; }
.console-bar strong { margin-left: auto; font-weight: 500; }

.console-body {
  padding: 22px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.console-line {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 32px;
  color: #536173;
  font-size: 13px;
}

.console-line span {
  min-width: 28px;
  color: #0f9f6e;
  font-weight: 700;
}

.console-line.success {
  color: #17202a;
}

.signal-map {
  position: relative;
  height: 250px;
  margin-top: 18px;
  border: 1px solid rgba(96, 112, 131, 0.14);
  border-radius: 8px;
  background:
    radial-gradient(circle at 20% 28%, rgba(15, 159, 110, 0.92) 0 4px, transparent 5px),
    radial-gradient(circle at 70% 20%, rgba(37, 99, 235, 0.42) 0 3px, transparent 4px),
    radial-gradient(circle at 48% 62%, rgba(15, 159, 110, 0.95) 0 5px, transparent 6px),
    radial-gradient(circle at 84% 76%, rgba(37, 99, 235, 0.42) 0 3px, transparent 4px),
    linear-gradient(135deg, #f8fafc, rgba(15, 159, 110, 0.06));
  overflow: hidden;
}

.signal-map::before,
.signal-map::after {
  content: '';
  position: absolute;
  inset: 26px 40px;
  border: 1px dashed rgba(15, 159, 110, 0.34);
  transform: skewY(-9deg);
}

.signal-map::after {
  inset: 72px 72px 44px 54px;
  border-color: rgba(37, 99, 235, 0.18);
  transform: skewY(12deg);
}

.signal-map i {
  position: absolute;
  width: 46px;
  height: 2px;
  background: #0f9f6e;
  box-shadow: 0 0 16px rgba(15, 159, 110, 0.35);
}

.signal-map i:nth-child(1) { left: 18%; top: 38%; transform: rotate(24deg); }
.signal-map i:nth-child(2) { left: 38%; top: 52%; transform: rotate(-18deg); }
.signal-map i:nth-child(3) { left: 58%; top: 36%; transform: rotate(32deg); }
.signal-map i:nth-child(4) { left: 68%; top: 68%; transform: rotate(-28deg); }
.signal-map i:nth-child(5) { left: 26%; top: 74%; transform: rotate(8deg); }
.signal-map i:nth-child(6) { left: 76%; top: 24%; transform: rotate(-8deg); }

.metrics-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin-top: 20px;
  border: 1px solid rgba(96, 112, 131, 0.18);
  background: rgba(96, 112, 131, 0.16);
  box-shadow: 0 18px 42px rgba(72, 91, 113, 0.08);
}

.metric-card {
  min-height: 116px;
  padding: 22px;
  background: rgba(255, 255, 255, 0.82);
}

.metric-card span {
  display: block;
  color: #607083;
  font-size: 13px;
}

.metric-card strong {
  display: block;
  margin-top: 14px;
  color: #0f9f6e;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.content-sections {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 22px;
  padding: 54px 0 72px;
}

.content-sections > section {
  position: relative;
  min-width: 0;
  padding: 28px;
  border: 1px solid rgba(96, 112, 131, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 20px 50px rgba(72, 91, 113, 0.09);
  overflow: hidden;
}

.content-sections > section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 13px;
  height: 13px;
  background: #0f9f6e;
}

.panel-large {
  grid-column: span 1;
}

.section-heading {
  margin-bottom: 24px;
}

.section-heading span {
  display: block;
  margin-bottom: 10px;
  color: #087752;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.section-heading h2 {
  margin: 0;
  color: #17202a;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.15;
  text-wrap: balance;
}

.section-heading.compact h2 {
  font-size: 24px;
}

.intro-text {
  max-width: 78ch;
  margin: 0 0 28px;
  color: #536173;
  font-size: 16px;
  line-height: 1.8;
}

.features-grid,
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.feature-item,
.stat-item,
.feature-row,
.step-item,
.contact-item {
  border: 1px solid rgba(96, 112, 131, 0.14);
  background: rgba(248, 250, 252, 0.84);
  border-radius: 8px;
}

.feature-item {
  display: flex;
  gap: 14px;
  padding: 16px;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.feature-item:hover,
.feature-row:hover,
.step-item:hover {
  transform: translateY(-2px);
  border-color: rgba(15, 159, 110, 0.34);
  background: rgba(15, 159, 110, 0.055);
}

.feature-item .el-icon,
.feature-icon .el-icon,
.contact-item .el-icon {
  color: #0f9f6e;
}

.feature-content h4,
.feature-details h4,
.step-content h4,
.tech-category h4,
.changelog-item h4 {
  margin: 0 0 8px;
  color: #17202a;
  font-size: 15px;
  font-weight: 700;
}

.feature-content p,
.feature-details p,
.step-content p,
.changelog-item li,
.contact-item span {
  margin: 0;
  color: #607083;
  font-size: 13px;
  line-height: 1.6;
}

.tech-stack {
  display: grid;
  gap: 22px;
}

.tech-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-items :deep(.el-tag),
.feature-status :deep(.el-tag) {
  border-radius: 999px;
  border-color: rgba(15, 159, 110, 0.22);
  background: rgba(15, 159, 110, 0.08);
  color: #087752;
}

.features-list,
.steps,
.contact-info {
  display: grid;
  gap: 12px;
}

.feature-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.feature-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(15, 159, 110, 0.08);
}

.step-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.step-number {
  color: #0f9f6e;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 700;
}

.step-content :deep(.el-button) {
  margin-top: 12px;
  color: #ffffff;
  background: #0f9f6e;
  border-color: #0f9f6e;
  border-radius: 6px;
  font-weight: 700;
}

.changelog {
  padding: 4px 0 0;
}

.changelog :deep(.el-timeline-item__tail) {
  border-left-color: rgba(15, 159, 110, 0.24);
}

.changelog :deep(.el-timeline-item__timestamp) {
  color: #7a8797;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.changelog-item ul {
  margin: 0;
  padding-left: 18px;
}

.contact-item {
  display: grid;
  grid-template-columns: 24px auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 14px;
}

.contact-item :deep(.el-link) {
  justify-self: end;
  color: #087752;
}

@media (max-width: 1080px) {
  .hero-grid,
  .content-sections {
    grid-template-columns: 1fr;
  }

  .system-console {
    min-height: 360px;
  }
}

@media (max-width: 768px) {
  .about-hero {
    padding: 44px 16px 24px;
  }

  .hero-grid,
  .content-sections,
  .metrics-strip {
    width: calc(100vw - 32px);
  }

  .hero-copy h1 {
    font-size: 42px;
  }

  .metrics-strip,
  .features-grid {
    grid-template-columns: 1fr;
  }

  .content-sections {
    padding: 32px 0 48px;
  }

  .content-sections > section {
    padding: 22px;
  }

  .feature-row,
  .contact-item {
    grid-template-columns: 1fr;
  }

  .contact-item :deep(.el-link) {
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .feature-item,
  .feature-row,
  .step-item {
    animation: none;
    transition: none;
  }
}
</style>
