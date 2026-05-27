<template>
  <div class="home-page">
    <div class="welcome-section">
      <h1>欢迎使用知识库</h1>
      <p>一个基于 Vue.js 的纯前端知识管理系统</p>
      
      <div class="stats-cards">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">文档总数</div>
          </div>
        </el-card>
        
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.tags }}</div>
            <div class="stat-label">标签数量</div>
          </div>
        </el-card>
        
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ recentDocs.length }}</div>
            <div class="stat-label">最近文档</div>
          </div>
        </el-card>
      </div>
    </div>

    <div class="stats-section">
      <h2>活跃统计</h2>
      <el-card class="heatmap-card shadow-sm">
        <div class="heatmap-container" ref="heatmapRef"></div>
      </el-card>
    </div>

    <div class="quick-actions">
      <h2>快速操作</h2>
      <div class="action-buttons">
        <el-button 
          type="primary" 
          size="large"
          @click="createNewDocument"
          :icon="Plus"
        >
          新建文档
        </el-button>
        
        <el-button 
          size="large"
          @click="$router.push('/search')"
          :icon="Search"
        >
          搜索文档
        </el-button>
        
        <el-button 
          size="large"
          @click="importData"
          :icon="Upload"
        >
          导入数据
        </el-button>
      </div>
    </div>

    <div class="recent-documents" v-if="recentDocs.length > 0">
      <h2>最近编辑</h2>
      <div class="recent-list">
        <el-card 
          v-for="doc in recentDocs" 
          :key="doc.id"
          class="recent-item"
          @click="viewDocument(doc)"
        >
          <div class="recent-title">{{ doc.title }}</div>
          <div class="recent-date">{{ formatDate(doc.updatedAt) }}</div>
          <div class="recent-summary">{{ getDocumentSummary(doc) }}</div>
          <div class="recent-tags" v-if="doc.tags && doc.tags.length > 0">
            <el-tag 
              v-for="tag in doc.tags.slice(0, 3)" 
              :key="tag"
              size="small"
              type="info"
            >
              {{ tag }}
            </el-tag>
          </div>
        </el-card>
      </div>
    </div>

    <div class="getting-started" v-if="stats.total === 0">
      <h2>开始使用</h2>
      <div class="guide-steps">
        <el-card class="guide-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>创建第一个文档</h3>
            <p>点击"新建文档"按钮，开始编写您的第一篇知识文档</p>
          </div>
        </el-card>
        
        <el-card class="guide-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>使用 Markdown 语法</h3>
            <p>支持完整的 Markdown 语法，包括代码高亮、表格、链接等</p>
          </div>
        </el-card>
        
        <el-card class="guide-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>组织和搜索</h3>
            <p>使用标签组织文档，通过搜索功能快速找到需要的内容</p>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 导入文件对话框 -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentsStore } from '@/stores/documents.js'
import { markdownProcessor } from '@/utils/markdown.js'
import { usePageSEO } from '@/composables/useSEO.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Upload } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useDark } from '@vueuse/core'

const router = useRouter()
const documentsStore = useDocumentsStore()

// SEO 配置
usePageSEO({
  title: '首页 - 知识库管理系统',
  description: '现代化的知识管理平台，轻松创建、编辑和管理您的文档。支持 Markdown 语法、智能搜索和标签分类。',
  keywords: '知识库首页,文档管理首页,Markdown编辑器,知识管理系统'
})

const fileInput = ref(null)
const heatmapRef = ref(null)
const isDark = useDark()
let heatmapInstance = null

const handleResize = () => heatmapInstance?.resize()

// 计算属性
const stats = computed(() => documentsStore.stats)
const recentDocs = computed(() =>
  documentsStore.documents
    .filter(doc => doc.content && doc.content.trim()) // 过滤掉空文档
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) // 按更新时间排序
    .slice(0, 6)
)

// 方法
const createNewDocument = async () => {
  try {
    const { value: title } = await ElMessageBox.prompt('请输入文档标题', '新建文档', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '标题不能为空'
    })
    
    const doc = await documentsStore.createDocument(title)
    router.push(`/editor/${encodeURIComponent(doc.id)}`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('创建文档失败')
    }
  }
}

const viewDocument = (doc) => {
  router.push(`/view/${encodeURIComponent(doc.id)}`)
}

const importData = () => {
  fileInput.value.click()
}

const handleFileImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const text = await file.text()
    await documentsStore.importData(text)
    ElMessage.success('数据导入成功')
  } catch (error) {
    ElMessage.error('导入失败：' + error.message)
  }
  
  event.target.value = ''
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getDocumentSummary = (doc) => {
  // 如果已有摘要，直接返回
  if (doc.summary && doc.summary.trim()) {
    return doc.summary
  }

  // 如果有内容，生成摘要
  if (doc.content && doc.content.trim()) {
    return markdownProcessor.generateSummary(doc.content, 120)
  }

  // 默认提示
  return '暂无内容'
}

const renderHeatmap = () => {
  if (!heatmapRef.value) return
  
  if (!heatmapInstance) {
    heatmapInstance = echarts.init(heatmapRef.value, isDark.value ? 'dark' : 'light')
  }

  const data = documentsStore.getDailyActivityData
  const year = new Date().getFullYear()

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (p) => {
        if (!p.data) return ''
        return `${p.data[0]}: ${p.data[1]} 次更新`
      }
    },
    visualMap: {
      min: 0,
      max: Math.max(...data.map(d => d[1] || 0), 5),
      type: 'piecewise',
      orient: 'horizontal',
      left: 'center',
      top: 0,
      show: false,
      inRange: {
        color: isDark.value 
          ? ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
          : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
      }
    },
    calendar: {
      top: 40,
      left: 30,
      right: 30,
      cellSize: ['auto', 13],
      range: year,
      itemStyle: {
        borderWidth: 0.5,
        borderColor: isDark.value ? '#30363d' : '#fff'
      },
      yearLabel: { show: false },
      dayLabel: {
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
        firstDay: 1,
        color: isDark.value ? '#8b949e' : '#666'
      },
      monthLabel: {
        nameMap: 'cn',
        color: isDark.value ? '#8b949e' : '#666'
      },
      splitLine: { show: false }
    },
    series: {
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: data
    }
  }

  heatmapInstance.setOption(option)
}

// 初始化
onMounted(async () => {
  if (documentsStore.documents.length === 0) {
    await documentsStore.loadDocuments()
  }

  // 为现有文档生成摘要（如果需要）
  try {
    await documentsStore.generateSummariesForExistingDocs()
  } catch (error) {
    console.error('生成摘要失败:', error)
  }

  nextTick(() => {
    renderHeatmap()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  heatmapInstance?.dispose()
})

watch([() => documentsStore.documents, isDark], () => {
  if (heatmapInstance) {
    heatmapInstance.dispose()
    heatmapInstance = null
    renderHeatmap()
  }
}, { deep: true })
</script>

<style scoped>
.home-page {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-section {
  text-align: center;
  margin-bottom: 40px;
}

.welcome-section h1 {
  font-size: 2.5em;
  color: #333;
  margin-bottom: 10px;
}

.welcome-section p {
  font-size: 1.2em;
  color: #666;
  margin-bottom: 30px;
}

.stats-cards {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 40px;
}

.stat-card {
  min-width: 150px;
  cursor: default;
}

.stat-content {
  text-align: center;
}

.stat-number {
  font-size: 2em;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 5px;
}

.stat-label {
  color: #666;
  font-size: 0.9em;
}

.stats-section {
  margin-bottom: 40px;
}

.stats-section h2 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5em;
}

.heatmap-card {
  border-radius: 8px;
}

.heatmap-container {
  height: 180px;
  width: 100%;
}

.quick-actions {
  margin-bottom: 40px;
}

.quick-actions h2 {
  margin-bottom: 20px;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.recent-documents {
  margin-bottom: 40px;
}

.recent-documents h2 {
  margin-bottom: 20px;
  color: #333;
}

.recent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.recent-item {
  cursor: pointer;
  transition: all 0.2s;
}

.recent-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.recent-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}

.recent-date {
  font-size: 0.9em;
  color: #999;
  margin-bottom: 8px;
}

.recent-summary {
  font-size: 0.9em;
  color: #666;
  line-height: 1.4;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.getting-started h2 {
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.guide-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 20px;
}

.step-number {
  width: 40px;
  height: 40px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.step-content h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.step-content p {
  margin: 0;
  color: #666;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .home-page {
    padding: 15px;
  }
  
  .welcome-section h1 {
    font-size: 1.8em;
  }
  
  .welcome-section p {
    font-size: 1em;
  }
  
  .stats-cards {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  
  .stat-card {
    width: 100%;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-buttons .el-button {
    width: 100%;
    margin-left: 0 !important;
    margin-bottom: 10px;
  }
  
  .recent-list {
    grid-template-columns: 1fr;
  }
}
</style>
