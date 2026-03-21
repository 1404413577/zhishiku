import Fuse from 'fuse.js'

// --- Shared Logic (Main Thread) ---
function extractText(content) {
  if (!content) return ''
  return String(content)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function generateSummary(content, maxLength = 200) {
  const text = extractText(content)
  return text.length > maxLength 
    ? text.substring(0, maxLength) + '...'
    : text
}

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'searchText', weight: 0.3 },
    { name: 'tags', weight: 0.2 },
    { name: 'summary', weight: 0.1 }
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
}

/**
 * SearchEngine (Synchronous Main Thread)
 * Note: Keeps Promise-based API for compatibility with the store, but executes locally.
 */
export class SearchEngine {
  constructor() {
    this.fuse = null
    this.documents = []
  }

  _initializeLocalFuse(documents) {
    if (!Array.isArray(documents)) return
    
    console.log('🔍 Search Engine: Initializing Fuse instance (Main Thread)')
    // 过滤掉文件夹，只索引真实文档
    const docsToIndex = documents.filter(doc => !doc.isFolder)
    const indexedDocs = docsToIndex.map(doc => ({
      ...doc,
      searchText: extractText(doc.content),
      summary: generateSummary(doc.content)
    }))
    
    this.fuse = new Fuse(indexedDocs, fuseOptions)
    this.documents = docsToIndex
    console.log('✅ Search Engine: Initialization complete (Main Thread)')
  }

  // 初始化搜索引擎
  async initialize(documents) {
    this._initializeLocalFuse(documents)
    return { count: documents.length }
  }

  // 搜索文档
  async search(query) {
    if (!this.fuse) {
      if (this.documents.length > 0) {
        this._initializeLocalFuse(this.documents)
      } else {
        return []
      }
    }

    const currentQuery = (query || '').trim()
    if (!currentQuery) {
      return this.documents.map(doc => ({ item: doc, score: 0 }))
    }

    try {
      const results = this.fuse.search(currentQuery)
      return results
    } catch (error) {
      console.error('❌ Search Engine: Search failed:', error)
      return []
    }
  }

  // 获取所有标签
  getAllTags() {
    const tags = new Set()
    this.documents.forEach(doc => {
      if (doc.tags) {
        doc.tags.forEach(tag => tags.add(tag))
      }
    })
    return Array.from(tags).sort()
  }

  // 高级搜索
  async advancedSearch(options = {}) {
    const { query, tags, dateRange, sortBy } = options
    let results = []

    if (query && query.trim()) {
      const searchResults = await this.search(query)
      results = searchResults.map(result => result.item)
    } else {
      results = [...this.documents]
    }

    if (tags && tags.length > 0) {
      results = results.filter(doc => 
        doc.tags && tags.some(tag => doc.tags.includes(tag))
      )
    }

    if (dateRange && dateRange.start && dateRange.end) {
      results = results.filter(doc => {
        const docDate = new Date(doc.updatedAt)
        return docDate >= new Date(dateRange.start) && 
               docDate <= new Date(dateRange.end)
      })
    }

    if (sortBy) {
      results.sort((a, b) => {
        switch (sortBy) {
          case 'title':
            return a.title.localeCompare(b.title)
          case 'created':
            return new Date(b.createdAt) - new Date(a.createdAt)
          case 'updated':
            return new Date(b.updatedAt) - new Date(a.updatedAt)
          default:
            return 0
        }
      })
    }

    return results
  }
}

export const searchEngine = new SearchEngine()
