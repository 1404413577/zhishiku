import { markdownService } from './markdownService'
import type { LegacyDocumentNode } from '@/domain/document/types'

type GraphNode = {
  id: string
  name: string
  value?: number
  category: number
  symbolSize: number
  label?: { show: boolean }
  itemStyle?: Record<string, unknown>
  docData?: LegacyDocumentNode
}

type GraphLink = {
  source: string
  target: string
  value?: number
  lineStyle?: Record<string, unknown>
}

type GraphData = {
  nodes: GraphNode[]
  links: GraphLink[]
}

const toId = (value: unknown) => String(value || '')

const knowledgeGraphTypes = [
  { type: 'note', name: '普通记录', color: '#409eff' },
  { type: 'concept', name: '概念', color: '#0f9f6e' },
  { type: 'guide', name: '指南', color: '#8b5cf6' },
  { type: 'decision', name: '决策', color: '#f59e0b' },
  { type: 'faq', name: '问答', color: '#06b6d4' },
  { type: 'source', name: '资料', color: '#64748b' },
  { type: 'case', name: '案例', color: '#ef4444' }
]

const categoryOffset = 2

const resolveKnowledgeTypeStyle = (type: unknown) => {
  const index = knowledgeGraphTypes.findIndex((item) => item.type === type)
  const safeIndex = index === -1 ? 0 : index
  return {
    category: safeIndex + categoryOffset,
    color: knowledgeGraphTypes[safeIndex].color
  }
}

export const documentGraphCategories = [
  { name: '文件夹' },
  { name: '预设/动态生成' },
  ...knowledgeGraphTypes.map((item) => ({ name: item.name }))
]

export const relationService = {
  buildDocumentGraph(documents: LegacyDocumentNode[], options: { isDark?: boolean } = {}): GraphData {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const idToNode = new Map<string, GraphNode>()
    const titleToId = new Map<string, string>()

    documents.forEach((doc) => {
      let category = 0
      let symbolSize = 25
      const itemStyle: Record<string, unknown> = {}

      if (doc.isFolder) {
        category = 0
        symbolSize = 35
        itemStyle.color = '#e6a23c'
      } else if (doc.isPreset || doc.isDynamic) {
        category = 1
        symbolSize = 20
        itemStyle.color = '#909399'
      } else {
        const typeStyle = resolveKnowledgeTypeStyle(doc.knowledgeType)
        category = typeStyle.category
        symbolSize = 25
        itemStyle.color = typeStyle.color
      }

      if (doc.isPinned || doc.isFavorited) {
        symbolSize += 5
        itemStyle.borderColor = '#f56c6c'
        itemStyle.borderWidth = 2
      }

      const node = {
        id: toId(doc.id),
        name: doc.title,
        category,
        symbolSize,
        itemStyle,
        docData: doc
      }
      nodes.push(node)
      idToNode.set(node.id, node)
      titleToId.set(doc.title, node.id)
    })

    documents.forEach((doc) => {
      const docId = toId(doc.id)
      const parentId = doc.parentId ? toId(doc.parentId) : ''

      if (parentId && idToNode.has(parentId)) {
        links.push({
          source: parentId,
          target: docId,
          lineStyle: { type: 'solid', color: options.isDark ? '#555' : '#ccc', width: 2 }
        })
      }

      if (!doc.isFolder && doc.content) {
        markdownService.extractWikiLinks(doc.content).forEach((targetTitle) => {
          const targetId = titleToId.get(targetTitle)
          if (!targetId) return
          links.push({
            source: docId,
            target: targetId,
            lineStyle: { type: 'dashed', curveness: 0.2, color: '#409eff', width: 1.5 }
          })
        })
      }
    })

    return { nodes, links }
  },

  buildTagGraph(documents: LegacyDocumentNode[]): GraphData {
    const tagCounts: Record<string, number> = {}
    const cooccurrence: Record<string, number> = {}
    const tagsSet = new Set<string>()

    documents.forEach((doc) => {
      const tags = Array.isArray(doc.tags) ? doc.tags : []
      const docTags = [...new Set(tags.filter((tag) => typeof tag === 'string' && tag.trim()))]
      if (docTags.length === 0) return

      docTags.forEach((tag) => {
        tagsSet.add(tag)
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })

      for (let i = 0; i < docTags.length; i++) {
        for (let j = i + 1; j < docTags.length; j++) {
          const pair = [docTags[i], docTags[j]].sort().join('|')
          cooccurrence[pair] = (cooccurrence[pair] || 0) + 1
        }
      }
    })

    const nodes = Array.from(tagsSet).map((tag) => ({
      id: tag,
      name: tag,
      value: tagCounts[tag],
      symbolSize: Math.min(Math.max(tagCounts[tag] * 8, 20), 80),
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
  },

  buildWikiLinkTagGraph(documents: LegacyDocumentNode[]): GraphData {
    const linkCounts: Record<string, number> = {}
    const cooccurrence: Record<string, number> = {}
    const linkSet = new Set<string>()

    documents.forEach((doc) => {
      if (!doc.content) return
      const links = markdownService.extractWikiLinks(doc.content)
      if (links.length === 0) return

      links.forEach((link) => {
        linkSet.add(link)
        linkCounts[link] = (linkCounts[link] || 0) + 1
      })

      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          const pair = [links[i], links[j]].sort().join('|')
          cooccurrence[pair] = (cooccurrence[pair] || 0) + 1
        }
      }
    })

    const nodes = Array.from(linkSet).map((link) => ({
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
}
