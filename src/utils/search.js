import FlexSearch from 'flexsearch'

// --- 纯文本提取逻辑 ---
function extractText(content) {
  if (!content) return ''
  return String(content)
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]*`/g, '')        // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '')// 移除图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 提取链接文本
    .replace(/[#*_~`]/g, '')        // 移除 Markdown 符号
    .replace(/\n+/g, ' ')           // 换行替换为空格
    .trim()
}

// --- 核心：动态生成高亮摘要 (Snippet) ---
function generateHighlightedSummary(content, query = '', maxLength = 120) {
  const text = extractText(content)
  if (!query) return text.length > maxLength ? text.substring(0, maxLength) + '...' : text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerQuery)

  // 如果内容中没直接匹配到连续字符串，返回普通摘要
  if (matchIndex === -1) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  // 截取匹配点前后的一段文字作为上下文
  const start = Math.max(0, matchIndex - 30)
  const end = Math.min(text.length, matchIndex + query.length + 60)
  
  let snippet = text.substring(start, end)
  
  // 使用正则为关键词加上高亮标签 (HTML)
  // 避免 XSS，我们这里只替换安全的纯文本
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlightRegex = new RegExp(`(${safeQuery})`, 'gi')
  snippet = snippet.replace(highlightRegex, '<mark class="search-highlight">$1</mark>')

  return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '')
}

/**
 * 全新 FlexSearch 搜索引擎
 */
export class SearchEngine {
  constructor() {
    this.index = null
    this.documents = []
  }

  _initializeLocalFlex(documents) {
    if (!Array.isArray(documents)) return
    
    console.log('⚡ Search Engine: Initializing FlexSearch (Explosive Performance)')
    const docsToIndex = documents.filter(doc => !doc.isFolder)
    this.documents = docsToIndex

    // 初始化 FlexSearch 的 Document 索引
    this.index = new FlexSearch.Document({
      document: {
        id: "id",
        index: [
          { field: "title", tokenize: "full", resolution: 9 },
          { field: "searchText", tokenize: "full", resolution: 5 },
          { field: "tags", tokenize: "forward", resolution: 7 }
        ],
        store: true // 必须开启 store 才能在结果中带出原始数据
      },
      // 核心：自定义中英文分词器
      encode: function(str) {
        const lower = str.toLowerCase()
        const words = lower.match(/[a-z0-9]+/g) || [] // 提取英文单词
        const chars = lower.match(/[\u4e00-\u9fa5]/g) || [] // 拆分独立中文字符
        return words.concat(chars)
      }
    })

    // 构建索引
    docsToIndex.forEach(doc => {
      this.index.add({
        id: doc.id,
        title: doc.title,
        searchText: extractText(doc.content),
        tags: doc.tags ? doc.tags.join(' ') : '',
        rawDoc: doc 
      })
    })
    console.log('✅ Search Engine: FlexSearch Ready!')
  }

  async initialize(documents) {
    this._initializeLocalFlex(documents)
    return { count: documents.length }
  }

  async search(query) {
    if (!this.index) {
      if (this.documents.length > 0) this._initializeLocalFlex(this.documents)
      else return []
    }

    const currentQuery = (query || '').trim()
    if (!currentQuery) {
      return this.documents.map(doc => ({ 
        item: { ...doc, highlightedSummary: generateHighlightedSummary(doc.content, '') }, 
        score: 0 
      }))
    }

    try {
      // enrich: true 让 FlexSearch 返回具体的 Document 内容
      const flexResults = this.index.search(currentQuery, { enrich: true })
      const uniqueResults = new Map()

      // FlexSearch 会按字段(title, searchText)分组返回，我们需要去重展平
      flexResults.forEach(fieldResult => {
        fieldResult.result.forEach(res => {
          if (!uniqueResults.has(res.id)) {
            // 在这一步，根据用户当前的搜索词，动态生成带有高亮 <mark> 的摘要！
            const highlightedDoc = {
              ...res.doc.rawDoc,
              highlightedSummary: generateHighlightedSummary(res.doc.rawDoc.content, currentQuery)
            }
            uniqueResults.set(res.id, { item: highlightedDoc, score: 1 })
          }
        })
      })

      return Array.from(uniqueResults.values())
    } catch (error) {
      console.error('❌ Search Engine: FlexSearch failed:', error)
      return []
    }
  }

  getAllTags() {
    const tags = new Set()
    this.documents.forEach(doc => {
      if (doc.tags) doc.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  async advancedSearch(options = {}) {
    const { query, tags, dateRange, sortBy } = options
    let results = []

    if (query && query.trim()) {
      const searchResults = await this.search(query)
      results = searchResults.map(result => result.item)
    } else {
      results = this.documents.map(doc => ({
        ...doc,
        highlightedSummary: generateHighlightedSummary(doc.content, '')
      }))
    }

    if (tags && tags.length > 0) {
      results = results.filter(doc => doc.tags && tags.some(tag => doc.tags.includes(tag)))
    }

    if (dateRange && dateRange.start && dateRange.end) {
      results = results.filter(doc => {
        const docDate = new Date(doc.updatedAt)
        return docDate >= new Date(dateRange.start) && docDate <= new Date(dateRange.end)
      })
    }

    if (sortBy) {
      results.sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title)
        if (sortBy === 'created') return new Date(b.createdAt) - new Date(a.createdAt)
        if (sortBy === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt)
        return 0
      })
    }
    return results
  }
}

export const searchEngine = new SearchEngine()