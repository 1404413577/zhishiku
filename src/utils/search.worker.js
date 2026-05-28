import FlexSearch from 'flexsearch'

console.log('👷 Search Worker: Booting up in background thread...')

// --- 纯文本提取逻辑 (移入后台，不抢占 UI 算力) ---
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

// --- 动态高亮摘要提取 ---
function generateHighlightedSummary(content, query = '', maxLength = 120) {
  const text = extractText(content)
  if (!query) return text.length > maxLength ? text.substring(0, maxLength) + '...' : text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerQuery)

  if (matchIndex === -1) return text.length > maxLength ? text.substring(0, maxLength) + '...' : text

  const start = Math.max(0, matchIndex - 30)
  const end = Math.min(text.length, matchIndex + query.length + 60)
  let snippet = text.substring(start, end)
  
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlightRegex = new RegExp(`(${safeQuery})`, 'gi')
  snippet = snippet.replace(highlightRegex, '<mark class="search-highlight">$1</mark>')

  return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '')
}

// 全局实例
let index = null
let documents = []

// 监听主线程发来的消息
self.onmessage = function(e) {
  const { type, payload, requestId } = e.data

  try {
    switch (type) {
      case 'initialize':
        const rawDocs = payload || []
        const docsToIndex = rawDocs.filter(doc => !doc.isFolder)
        documents = docsToIndex

        index = new FlexSearch.Document({
          document: {
            id: "id",
            index: [
              { field: "title", tokenize: "full", resolution: 9 },
              { field: "searchText", tokenize: "full", resolution: 5 },
              { field: "tags", tokenize: "forward", resolution: 7 }
            ],
            store: true
          },
          encode: function(str) {
            const lower = str.toLowerCase()
            const words = lower.match(/[a-z0-9]+/g) || [] 
            const chars = lower.match(/[\u4e00-\u9fa5]/g) || [] 
            return words.concat(chars)
          }
        })

        docsToIndex.forEach(doc => {
          index.add({
            id: doc.id,
            title: doc.title,
            searchText: extractText(doc.content),
            tags: doc.tags ? doc.tags.join(' ') : '',
            rawDoc: doc 
          })
        })
        self.postMessage({ type: 'initialized', payload: { count: documents.length }, requestId })
        break

      case 'search':
        const query = (payload || '').trim()
        if (!index) {
          self.postMessage({ type: 'searchResult', payload: [], requestId })
          return
        }

        if (!query) {
          const defaultResults = documents.map(doc => ({ 
            item: { ...doc, highlightedSummary: generateHighlightedSummary(doc.content, '') }, 
            score: 0 
          }))
          self.postMessage({ type: 'searchResult', payload: defaultResults, requestId })
          return
        }

        const flexResults = index.search(query, { enrich: true })
        const uniqueResults = new Map()

        flexResults.forEach(fieldResult => {
          fieldResult.result.forEach(res => {
            if (!uniqueResults.has(res.id)) {
              const highlightedDoc = {
                ...res.doc.rawDoc,
                highlightedSummary: generateHighlightedSummary(res.doc.rawDoc.content, query)
              }
              uniqueResults.set(res.id, { item: highlightedDoc, score: 1 })
            }
          })
        })

        self.postMessage({ type: 'searchResult', payload: Array.from(uniqueResults.values()), requestId })
        break

      case 'getAllTags':
        const tags = new Set()
        documents.forEach(doc => {
          if (doc.tags) doc.tags.forEach(tag => tags.add(tag))
        })
        self.postMessage({ type: 'tags', payload: Array.from(tags).sort(), requestId })
        break

      // 高级搜索可在这里补充逻辑（类似主线程，不再赘述）
    }
  } catch (error) {
    self.postMessage({ type: 'error', payload: error.message, requestId })
  }
}