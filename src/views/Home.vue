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

    <!-- 数据分析图表 -->
    <div class="charts-section" v-if="stats.total > 0">
      <h2>数据分析</h2>
      <div class="charts-grid">
        <el-card class="chart-card chart-card-wide">
          <template #header><span>知识词云</span></template>
          <div class="chart-container" ref="wordCloudRef"></div>
          <div v-if="wordCloudData.length === 0" class="chart-empty">暂无内容数据</div>
        </el-card>
        <el-card class="chart-card">
          <template #header><span>标签分布</span></template>
          <div class="chart-container" ref="tagChartRef"></div>
          <div v-if="tagDistributionData.length === 0" class="chart-empty">暂无标签数据</div>
        </el-card>
        <el-card class="chart-card">
          <template #header><span>文档类型</span></template>
          <div class="chart-container" ref="typeChartRef"></div>
        </el-card>
        <el-card class="chart-card">
          <template #header><span>月度新增趋势</span></template>
          <div class="chart-container" ref="trendChartRef"></div>
          <div v-if="monthlyCreationData.xAxis.length === 0" class="chart-empty">暂无数据</div>
        </el-card>
        <el-card class="chart-card">
          <template #header><span>内容长度分布</span></template>
          <div class="chart-container" ref="lengthChartRef"></div>
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

        <el-button
          size="large"
          @click="randomDocument"
          :icon="Refresh"
          v-if="stats.total > 0"
        >
          随便看看
        </el-button>

            
        <el-button
          size="large"
          v-if="stats.total > 0"
          @click="toggleSelectMode"
          :type="selectMode ? 'warning' : 'default'"
          :icon="Select"
        >
          {{ selectMode ? '退出批量操作' : '批量操作' }}
        </el-button>

      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectMode && selectedDocIds.size > 0" class="batch-bar">
      <span class="batch-count">已选 {{ selectedDocIds.size }} 项</span>
      <el-button size="small" :icon="CollectionTag" @click="batchAddTag">批量标签</el-button>
      <el-button size="small" :icon="Download" @click="batchExport">批量导出</el-button>
      <el-button size="small" type="danger" :icon="Delete" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="selectedDocIds.clear()">取消选择</el-button>
    </div>

    <div class="recent-documents" v-if="recentDocs.length > 0">
      <h2>最近编辑</h2>
      <div class="recent-list">
        <el-card
          v-for="doc in recentDocs"
          :key="doc.id"
          :class="['recent-item', { selected: selectedDocIds.has(doc.id) }]"
          @click="selectMode ? toggleDocSelect(doc.id, $event) : viewDocument(doc)"
        >
          <el-checkbox
            v-if="selectMode"
            :model-value="selectedDocIds.has(doc.id)"
            class="select-checkbox"
            @click.stop
            @change="toggleDocSelect(doc.id)"
          />
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

    <!-- 新建文档对话框（含模板选择） -->
    <el-dialog v-model="showNewDocDialog" title="新建文档" width="600px" :close-on-click-modal="false">
      <el-input v-model="newDocTitle" placeholder="文档标题" size="large" style="margin-bottom: 20px" />
      <div class="template-label">选择模板（可选）</div>
      <div class="template-grid">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          :class="['template-card', { active: selectedTemplate === tpl.id }]"
          @click="selectedTemplate = tpl.id"
        >
          <span class="template-icon">{{ tpl.icon }}</span>
          <span class="template-name">{{ tpl.name }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showNewDocDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCreateDocument" :disabled="!newDocTitle.trim()">
          创建文档
        </el-button>
      </template>
    </el-dialog>

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
import { Plus, Search, Upload, Select, CollectionTag, Delete } from '@element-plus/icons-vue'
import { exportMultipleAsJSON } from '@/utils/export.js'
import { templates } from '@/utils/templates.js'
import * as echarts from 'echarts'
import 'echarts-wordcloud'
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
const tagChartRef = ref(null)
const typeChartRef = ref(null)
const trendChartRef = ref(null)
const lengthChartRef = ref(null)
const wordCloudRef = ref(null)
const isDark = useDark()
let heatmapInstance = null
let tagChartInstance = null
let typeChartInstance = null
let trendChartInstance = null
let lengthChartInstance = null
let wordCloudInstance = null
const allChartInstances = () => [heatmapInstance, tagChartInstance, typeChartInstance, trendChartInstance, lengthChartInstance, wordCloudInstance].filter(Boolean)

const handleResize = () => allChartInstances().forEach(i => i.resize())

// 计算属性
const stats = computed(() => documentsStore.stats)
const recentDocs = computed(() =>
  documentsStore.documents
    .filter(doc => doc.content && doc.content.trim()) // 过滤掉空文档
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) // 按更新时间排序
    .slice(0, 6)
)

// 图表数据 — 标签分布
const tagDistributionData = computed(() => {
  const counts = {}
  documentsStore.documents.forEach(doc => {
    if (doc.tags) {
      doc.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1 })
    }
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
})

// 图表数据 — 文档类型
const docTypeData = computed(() => {
  let folders = 0, normal = 0, preset = 0, dynamic = 0
  documentsStore.documents.forEach(doc => {
    if (doc.isFolder) folders++
    else if (doc.isPreset) preset++
    else if (doc.isDynamic) dynamic++
    else normal++
  })
  return [
    { name: '普通文档', value: normal },
    { name: '文件夹', value: folders },
    { name: '预设文档', value: preset },
    { name: '动态文档', value: dynamic }
  ].filter(d => d.value > 0)
})

// 图表数据 — 月度新增趋势
const monthlyCreationData = computed(() => {
  const months = {}
  documentsStore.documents.forEach(doc => {
    const date = doc.createdAt || doc.updatedAt
    if (date) {
      const month = date.substring(0, 7)
      months[month] = (months[month] || 0) + 1
    }
  })
  const sorted = Object.entries(months).sort()
  return {
    xAxis: sorted.map(([m]) => m),
    data: sorted.map(([, c]) => c)
  }
})

// 图表数据 — 内容长度分布
const contentLengthData = computed(() => {
  const buckets = { '0-500字': 0, '500-2000字': 0, '2000-5000字': 0, '5000-10000字': 0, '10000+字': 0 }
  documentsStore.documents.forEach(doc => {
    const len = (doc.content || '').length
    if (len === 0) return
    if (len < 500) buckets['0-500字']++
    else if (len < 2000) buckets['500-2000字']++
    else if (len < 5000) buckets['2000-5000字']++
    else if (len < 10000) buckets['5000-10000字']++
    else buckets['10000+字']++
  })
  return {
    xAxis: Object.keys(buckets),
    data: Object.values(buckets)
  }
})

// 图表数据 — 词云
const stopWords = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
  '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些', '什么', '怎么',
  '如何', '为什么', '可以', '这个', '那个', '还是', '但是', '因为', '所以',
  '如果', '虽然', '而且', '然后', '之后', '已经', '比较', '非常', '真的', '觉得',
  '知道', '可能', '应该', '需要', '能够', '进行', '使用', '通过', '对于', '关于',
  '为了', '以及', '或者', '不过', '只是', '比如', '例如', '其中', '其他',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'just', 'don', 'now', 'one', 'also', 'up', 'out', 'about', 'over', 'its'
])

const wordCloudData = computed(() => {
  const wordFreq = {}
  documentsStore.documents.forEach(doc => {
    if (!doc.content) return
    // 提取中英文词
    const words = doc.content
      .replace(/[#*[\]()`~>|\\\-_=:+@!]/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(w => {
        if (w.length < 2) return false
        if (/^\d+$/.test(w)) return false
        if (stopWords.has(w.toLowerCase())) return false
        return true
      })
    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([name, value]) => ({ name, value }))
})

// 批量操作
const selectMode = ref(false)
const selectedDocIds = ref(new Set())

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  selectedDocIds.value = new Set()
}

const toggleDocSelect = (id) => {
  const next = new Set(selectedDocIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedDocIds.value = next
}

const batchAddTag = async () => {
  try {
    const { value: tag } = await ElMessageBox.prompt('请输入要添加的标签', '批量添加标签', {
      confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '标签名'
    })
    if (!tag || !tag.trim()) return
    for (const id of selectedDocIds.value) {
      const doc = documentsStore.documents.find(d => d.id === id)
      if (doc) {
        const tags = [...(doc.tags || []), tag.trim()]
        await documentsStore.saveDocument(id, { tags })
      }
    }
    ElMessage.success(`已为 ${selectedDocIds.value.size} 个文档添加标签 "${tag}"`)
    selectedDocIds.value = new Set()
  } catch { /* cancel */ }
}

const batchExport = () => {
  const docs = documentsStore.documents.filter(d => selectedDocIds.value.has(d.id))
  if (docs.length === 0) return
  exportMultipleAsJSON(docs)
  ElMessage.success(`已导出 ${docs.length} 个文档`)
}

const batchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedDocIds.value.size} 个文档吗？此操作不可恢复。`,
      '批量删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'error' }
    )
    for (const id of selectedDocIds.value) {
      await documentsStore.deleteDocument(id)
    }
    ElMessage.success(`已删除 ${selectedDocIds.value.size} 个文档`)
    selectedDocIds.value = new Set()
    selectMode.value = false
  } catch { /* cancel */ }
}

// 随机发现
const randomDocument = () => {
  const docs = documentsStore.documents.filter(d => !d.isFolder && d.content)
  if (docs.length === 0) return
  const doc = docs[Math.floor(Math.random() * docs.length)]
  router.push(`/view/${encodeURIComponent(doc.id)}`)
}

// 新建文档对话框
const showNewDocDialog = ref(false)
const newDocTitle = ref('')
const selectedTemplate = ref('blank')

const createNewDocument = () => {
  newDocTitle.value = ''
  selectedTemplate.value = 'blank'
  showNewDocDialog.value = true
}

const confirmCreateDocument = async () => {
  if (!newDocTitle.value.trim()) return
  try {
    const tpl = templates.find(t => t.id === selectedTemplate.value)
    const content = tpl ? tpl.content : ''
    const doc = await documentsStore.createDocument(newDocTitle.value.trim(), content)
    showNewDocDialog.value = false
    router.push(`/editor/${encodeURIComponent(doc.id)}`)
  } catch (error) {
    ElMessage.error('创建文档失败')
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

const makeChartOption = (baseOption) => ({
  backgroundColor: 'transparent',
  animationDuration: 800,
  animationEasing: 'cubicOut',
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { top: 10, right: 20, bottom: 30, left: 50 },
  ...baseOption
})

const renderTagChart = () => {
  if (!tagChartRef.value) return
  if (!tagChartInstance) tagChartInstance = echarts.init(tagChartRef.value, isDark.value ? 'dark' : 'light')

  const data = tagDistributionData.value
  if (data.length === 0) { tagChartInstance.clear(); return }

  const textColor = isDark.value ? '#c9d1d9' : '#333'
  tagChartInstance.setOption(makeChartOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 30, bottom: 20, left: 100 },
    xAxis: { type: 'value', axisLabel: { color: textColor } },
    yAxis: { type: 'category', data: data.map(d => d[0]).reverse(), axisLabel: { color: textColor }, inverse: true },
    series: [{
      type: 'bar',
      data: data.map(d => d[1]).reverse(),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#409eff' },
          { offset: 1, color: '#79bbff' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      barMaxWidth: 30,
      label: { show: true, position: 'right', color: textColor }
    }]
  }))
}

const renderTypeChart = () => {
  if (!typeChartRef.value) return
  if (!typeChartInstance) typeChartInstance = echarts.init(typeChartRef.value, isDark.value ? 'dark' : 'light')

  const data = docTypeData.value
  const colors = ['#409eff', '#e6a23c', '#909399', '#67c23a']
  typeChartInstance.setOption({
    backgroundColor: 'transparent',
    animationDuration: 800,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: isDark.value ? '#c9d1d9' : '#333' } },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['40%', '55%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data: data.map((d, i) => ({ ...d, itemStyle: { color: colors[i % colors.length] } }))
    }]
  })
}

const renderTrendChart = () => {
  if (!trendChartRef.value) return
  if (!trendChartInstance) trendChartInstance = echarts.init(trendChartRef.value, isDark.value ? 'dark' : 'light')

  const { xAxis, data } = monthlyCreationData.value
  if (xAxis.length === 0) { trendChartInstance.clear(); return }

  const textColor = isDark.value ? '#c9d1d9' : '#333'
  trendChartInstance.setOption(makeChartOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: xAxis, axisLabel: { color: textColor, rotate: 45 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: textColor } },
    series: [{
      type: 'line',
      data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 0.6, [
        { offset: 0, color: 'rgba(64,158,255,0.25)' },
        { offset: 1, color: 'rgba(64,158,255,0.02)' }
      ])}
    }]
  }))
}

const renderLengthChart = () => {
  if (!lengthChartRef.value) return
  if (!lengthChartInstance) lengthChartInstance = echarts.init(lengthChartRef.value, isDark.value ? 'dark' : 'light')

  const { xAxis, data } = contentLengthData.value
  const textColor = isDark.value ? '#c9d1d9' : '#333'
  lengthChartInstance.setOption(makeChartOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 20, bottom: 20, left: 40 },
    xAxis: { type: 'category', data: xAxis, axisLabel: { color: textColor } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: textColor } },
    series: [{
      type: 'bar',
      data,
      barMaxWidth: 40,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#67c23a' },
          { offset: 1, color: '#b3e19d' }
        ]),
        borderRadius: [4, 4, 0, 0]
      }
    }]
  }))
}

const renderWordCloud = () => {
  if (!wordCloudRef.value) return
  if (!wordCloudInstance) wordCloudInstance = echarts.init(wordCloudRef.value, isDark.value ? 'dark' : 'light')

  const data = wordCloudData.value
  if (data.length === 0) { wordCloudInstance.clear(); return }

  wordCloudInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { show: true, formatter: '{b}: {c} 次' },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [12, 40],
      rotationRange: [-30, 30],
      rotationStep: 15,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: 'normal',
        color: () => {
          const colors = isDark.value
            ? ['#79bbff', '#95d475', '#e6a23c', '#f56c6c', '#b37feb', '#5cdbd3', '#ff85c0', '#73d13d']
            : ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#8b5cf6', '#06b6d4', '#ec4899', '#22c55e']
          return colors[Math.floor(Math.random() * colors.length)]
        }
      },
      emphasis: {
        focus: 'self',
        textStyle: { textShadowBlur: 10, textShadowColor: '#333' }
      },
      data
    }]
  })
}

const renderAllCharts = () => {
  renderHeatmap()
  renderTagChart()
  renderTypeChart()
  renderTrendChart()
  renderLengthChart()
  renderWordCloud()
}

const disposeAllCharts = () => {
  allChartInstances().forEach(i => i.dispose())
  heatmapInstance = null
  tagChartInstance = null
  typeChartInstance = null
  trendChartInstance = null
  lengthChartInstance = null
  wordCloudInstance = null
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
    renderAllCharts()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  disposeAllCharts()
})

watch([() => documentsStore.documents, isDark], () => {
  disposeAllCharts()
  nextTick(() => renderAllCharts())
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

.charts-section {
  margin-bottom: 40px;
}

.charts-section h2 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5em;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  border-radius: 8px;
}

.chart-card :deep(.el-card__header) {
  padding: 14px 20px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.chart-card :deep(.el-card__body) {
  padding: 16px 12px 8px;
  position: relative;
}

.chart-container {
  height: 260px;
  width: 100%;
  position: relative;
}

.chart-card-wide {
  grid-column: 1 / -1;
}

.chart-card-wide .chart-container {
  height: 320px;
}

.chart-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  pointer-events: none;
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
  position: relative;
}

.recent-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.recent-item.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.select-checkbox {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-5);
}

.batch-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-right: 8px;
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

.template-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.template-card:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.template-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.template-icon {
  font-size: 24px;
}

.template-name {
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .home-page {
    padding: 15px;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 220px;
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
