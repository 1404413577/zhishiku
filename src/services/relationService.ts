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
        category = 1
        symbolSize = 35
        itemStyle.color = '#e6a23c'
      } else if (doc.isPreset || doc.isDynamic) {
        category = 2
        symbolSize = 20
        itemStyle.color = '#909399'
      } else {
        category = 0
        symbolSize = 25
        itemStyle.color = '#409eff'
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
