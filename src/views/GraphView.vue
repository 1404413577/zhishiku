<template>
  <div class="graph-view-container">
    <div class="graph-header">
      <h2>关系图谱</h2>
      <div class="header-actions">
        <el-radio-group v-model="graphMode" size="small" @change="refreshGraph">
          <el-radio-button value="document">文档模式</el-radio-button>
          <el-radio-button value="tag">标签模式</el-radio-button>
        </el-radio-group>
        <el-button @click="refreshGraph" :icon="Refresh" circle title="重新布局" style="margin-left: 12px;"></el-button>
      </div>
    </div>
    <div class="graph-content" ref="chartRef">
      <div v-if="graphMode === 'tag' && graphDataSource === 'empty'" class="graph-empty-state">
        <el-icon class="empty-icon"><Connection /></el-icon>
        <p>暂无标签数据</p>
        <p class="empty-hint">在文档编辑器中为文档添加标签，或在文档内容中使用 [[双向链接]]，即可在此看到标签关系图谱。</p>
      </div>
      <div v-else-if="graphMode === 'tag' && graphDataSource === 'wikilinks'" class="graph-source-hint">
        <el-icon><InfoFilled /></el-icon>
        <span>当前基于文档中的 [[双向链接]] 生成关系图（尚无手动标签）</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentsStore } from '@/stores/documents'
import { Refresh, Connection, InfoFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useDark } from '@vueuse/core'

const chartRef = ref(null)
const router = useRouter()
const documentsStore = useDocumentsStore()
const isDark = useDark()
const graphMode = ref('document')
const graphDataSource = ref('tag') // 'tag' | 'wikilinks' | 'empty'

let chartInstance = null
let resizeObserver = null

// 从 Markdown 中提取所有 [[WikiLink]] 目标名称
const extractWikiLinks = (content) => {
  if (!content) return []
  const links = []
  const regex = /\[\[(.*?)\]\]/g
  let match
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  return [...new Set(links)]
}

// 从文档 [[WikiLinks]] 构建标签模式数据 (当手动标签为空时的回退方案)
const buildWikiLinkTagData = () => {
  const documents = documentsStore.documents
  const linkCounts = {}
  const cooccurrence = {}
  const linkSet = new Set()

  documents.forEach(doc => {
    if (!doc.content) return
    const links = extractWikiLinks(doc.content)
    if (links.length > 0) {
      links.forEach(link => {
        linkSet.add(link)
        linkCounts[link] = (linkCounts[link] || 0) + 1
      })

      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          const pair = [links[i], links[j]].sort().join('|')
          cooccurrence[pair] = (cooccurrence[pair] || 0) + 1
        }
      }
    }
  })

  const nodes = Array.from(linkSet).map(link => ({
    id: link,
    name: link,
    value: linkCounts[link],
    symbolSize: Math.min(Math.max(linkCounts[link] * 8, 20), 80),
    category: 0,
    label: { show: true }
  }))

  const links = Object.entries(cooccurrence).map(([pair, count]) => {
    const [source, target] = pair.split('|')
    return {
      source,
      target,
      value: count,
      lineStyle: { width: Math.min(count * 2, 8), opacity: 0.4 }
    }
  })

  return { nodes, links }
}

// 构建节点和连线数据
const buildGraphData = () => {
  if (graphMode.value === 'tag') {
    let data = documentsStore.getTagCooccurrenceData
    graphDataSource.value = 'tag'

    // 标签为空时，回退到 [[WikiLinks]] 作为隐含标签
    if (!data.nodes || data.nodes.length === 0) {
      data = buildWikiLinkTagData()
      graphDataSource.value = data.nodes.length > 0 ? 'wikilinks' : 'empty'
    }

    // 给标签节点添加样式 (使用 hex 颜色以保证 ECharts 渲染稳定)
    const activeColor = graphDataSource.value === 'wikilinks' ? '#67c23a' : '#409eff'
    const activeColorLight = graphDataSource.value === 'wikilinks' ? '#95d475' : '#79bbff'

    data.nodes.forEach(node => {
      node.itemStyle = {
        color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
          { offset: 0, color: activeColorLight },
          { offset: 1, color: activeColor }
        ]),
        shadowBlur: 10,
        shadowColor: graphDataSource.value === 'wikilinks'
          ? 'rgba(103, 194, 58, 0.5)'
          : 'rgba(64, 158, 255, 0.5)'
      }
    })
    return data
  }

  const documents = documentsStore.documents
  const nodes = []
  const links = []

  // 用于快速查改
  const idToNode = new Map()
  const titleToId = new Map()

  // 1. 构建所有节点
  documents.forEach(doc => {
    let category = 0
    let symbolSize = 25
    let itemStyle = {}

    if (doc.isFolder) {
      category = 1
      symbolSize = 35
      itemStyle = { color: '#e6a23c' } // 文件夹橙色
    } else if (doc.isPreset || doc.isDynamic) {
      category = 2
      symbolSize = 20
      itemStyle = { color: '#909399' } // 静态/动态生成文档灰色
    } else {
      category = 0
      symbolSize = 25
      itemStyle = { color: '#409eff' } // 普通文档蓝色
    }

    // 强调置顶或收藏
    if (doc.isPinned || doc.isFavorited) {
      symbolSize += 5
      itemStyle.borderColor = '#f56c6c'
      itemStyle.borderWidth = 2
    }

    const node = {
      id: doc.id,
      name: doc.title,
      category,
      symbolSize,
      itemStyle,
      docData: doc
    }
    nodes.push(node)
    idToNode.set(doc.id, node)
    titleToId.set(doc.title, doc.id)
  })

  // 2. 构建关系连线
  documents.forEach(doc => {
    // 2.1 提取层级关联逻辑 (父子关系)
    if (doc.parentId && idToNode.has(doc.parentId)) {
      links.push({
        source: doc.parentId,
        target: doc.id,
        lineStyle: { type: 'solid', color: isDark.value ? '#555' : '#ccc', width: 2 }
      })
    }

    // 2.2 提取双链关系逻辑 (普通文档双击)
    if (!doc.isFolder && doc.content) {
      const wikiLinks = extractWikiLinks(doc.content)
      wikiLinks.forEach(targetTitle => {
        if (titleToId.has(targetTitle)) {
          const targetId = titleToId.get(targetTitle)
          links.push({
            source: doc.id,
            target: targetId,
            lineStyle: { type: 'dashed', curveness: 0.2, color: '#409eff', width: 1.5 }
          })
        }
      })
    }
  })

  return { nodes, links }
}

const renderChart = () => {
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value, isDark.value ? 'dark' : 'light')
    
    // 监听点击事件
    chartInstance.on('click', (params) => {
      if (params.dataType === 'node') {
        if (graphMode.value === 'document') {
          const doc = params.data.docData
          if (doc && !doc.isFolder) {
            router.push(`/view/${doc.id}`)
          }
        } else {
          // 标签/链接模式点击
          if (graphDataSource.value === 'wikilinks') {
            router.push({ path: '/search', query: { q: params.data.name } })
          } else {
            router.push({ path: '/search', query: { tags: [params.data.name] } })
          }
        }
      }
    })
  }

  const { nodes, links } = buildGraphData()
  
  if (!nodes || nodes.length === 0) {
    console.warn('⚠️ GraphView: No nodes to render in mode:', graphMode.value)
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params) => {
        if (params.dataType === 'node') {
          if (graphMode.value === 'document') {
            const doc = params.data.docData
            return `${doc.isFolder ? '📁 ' : '📄 '} ${doc.title}`
          } else {
            const label = graphDataSource.value === 'wikilinks' ? '🔗 双向链接' : '🏷️ 标签'
            return `${label}: ${params.data.name}<br/>关联次数: ${params.data.value}`
          }
        }
        return null
      }
    },
    legend: [{
      data: graphMode.value === 'document'
        ? ['普通文档', '文件夹', '预设/动态生成']
        : [graphDataSource.value === 'wikilinks' ? '双向链接' : '标签'],
      textStyle: {
        color: isDark.value ? '#ccc' : '#333'
      }
    }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: graphMode.value === 'document'
          ? [ { name: '普通文档' }, { name: '文件夹' }, { name: '预设/动态生成' } ]
          : [ { name: graphDataSource.value === 'wikilinks' ? '双向链接' : '标签' } ],
        roam: true,
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          color: isDark.value ? '#eee' : '#333',
          fontSize: graphMode.value === 'tag' ? 14 : 12
        },
        force: {
          repulsion: graphMode.value === 'tag' ? 600 : 300,
          gravity: 0.05,
          edgeLength: graphMode.value === 'tag' ? [120, 250] : [50, 150]
        },
        lineStyle: {
          color: 'source',
          curveness: 0.1,
          opacity: 0.5
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 4
          }
        }
      }
    ]
  }

  chartInstance.setOption(option)
}

const refreshGraph = () => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  renderChart()
}

onMounted(() => {
  nextTick(() => {
    renderChart()
    
    resizeObserver = new ResizeObserver(() => {
      if (chartInstance) {
        chartInstance.resize()
      }
    })
    resizeObserver.observe(chartRef.value)
  })
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (chartInstance) {
    chartInstance.dispose()
  }
})

// 监听数据改变或主题改变，重新渲染
watch([() => documentsStore.documents, isDark], () => {
  if (chartInstance) {
    refreshGraph()
  }
}, { deep: true })
</script>

<style scoped>
.graph-view-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  overflow: hidden;
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.graph-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(120deg, var(--el-color-primary), var(--el-color-success));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.graph-content {
  flex: 1;
  width: 100%;
  position: relative;
}

.graph-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--el-text-color-secondary);
  z-index: 10;
  pointer-events: none;
}

.graph-empty-state .empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  color: var(--el-text-color-placeholder);
}

.graph-empty-state p {
  margin: 4px 0;
  font-size: 15px;
}

.graph-empty-state .empty-hint {
  font-size: 13px;
  max-width: 360px;
  line-height: 1.6;
  opacity: 0.7;
}

.graph-source-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-5);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-color-success-dark-2);
  z-index: 10;
  pointer-events: none;
  white-space: nowrap;
}
</style>
