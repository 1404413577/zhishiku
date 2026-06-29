import { defineStore } from 'pinia'
import { buildDocumentTree } from '@/domain/document/documentRules'
import { documentService } from '@/services/documentService'
import { searchService } from '@/services/searchService'
import { FileSystem as FSService } from '@/services/fs.js'
import { ElMessage } from 'element-plus'

export const useDocumentsStore = defineStore('documents', {
  state: () => ({
    documents: [],
    currentDocument: null,
    loading: false,
    searchQuery: '',
    searchResults: [],
    selectedTags: [],
    isEditing: false,
    workspaceMode: 'indexeddb', // 'indexeddb' 或 'local'
    localDirHandle: null
  }),

  getters: {
    allTags: (state) => {
      const tags = new Set()
      state.documents.forEach(doc => {
        if (doc.tags) doc.tags.forEach(tag => tags.add(tag))
      })
      return Array.from(tags).sort()
    },

    filteredDocuments: (state) => {
      if (state.searchQuery.trim()) return state.searchResults.filter(doc => !doc.isFolder)
      if (state.selectedTags.length > 0) {
        return state.documents.filter(doc =>
          !doc.isFolder && doc.tags && state.selectedTags.some(tag => doc.tags.includes(tag))
        )
      }
      return state.documents.filter(doc => !doc.isFolder)
    },

    documentTree: (state) => {
      return buildDocumentTree(state.documents)
    },

    stats: (state) => ({
      total: state.documents.length,
      tags: state.allTags.length,
      lastUpdated: state.documents.length > 0 
        ? Math.max(...state.documents.map(doc => new Date(doc.updatedAt)))
        : null
    }),

    getDailyActivityData: (state) => {
      const counts = {}
      state.documents.forEach(doc => {
        if (doc.updatedAt) {
          const date = new Date(doc.updatedAt).toISOString().split('T')[0]
          counts[date] = (counts[date] || 0) + 1
        }
      })
      return Object.entries(counts).map(([date, count]) => [date, count])
    }
  },

  actions: {
    async connectLocalWorkspace() {
      try {
        const handle = await FSService.requestWorkspaceAccess()
        this.localDirHandle = handle
        this.workspaceMode = 'local'
        documentService.setWorkspaceMode('local')
        await this.loadDocuments()
        ElMessage.success('已成功连接到本地工作区')
      } catch (err) {
        ElMessage.error(err.message || '连接本地工作区失败')
      }
    },

    async switchToIndexedDB() {
      this.workspaceMode = 'indexeddb'
      this.localDirHandle = null
      documentService.setWorkspaceMode('indexeddb')
      await this.loadDocuments()
      ElMessage.success('已切换回浏览器内建存储')
    },

    async tryRestoreLocalWorkspace() {
      try {
        const handle = await FSService.loadStoredHandle()
        if (handle) {
          this.localDirHandle = handle
          this.workspaceMode = 'local'
          documentService.setWorkspaceMode('local')
          await this.loadDocuments()
          return true
        }
      } catch (err) {
        console.log('恢复本地工作区失败', err)
      }
      return false
    },

    async loadDocuments() {
      this.loading = true
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        if (this.workspaceMode === 'local' && !this.localDirHandle) throw new Error('未连接本地文件夹')
        this.documents = await documentService.list({ loadPresetDocs: this.workspaceMode !== 'local' })
      } catch (error) {
        console.error('加载文档失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async loadPresetDocsIfNeeded(forceReload = false) {
      try {
        if (this.workspaceMode === 'local') return
        documentService.setWorkspaceMode('indexeddb')
        this.documents = await documentService.loadPresetDocsIfNeeded(this.documents, forceReload)
        await documentService.refreshSearchIndex(this.documents)
      } catch (error) {
        console.warn('加载预设文档失败:', error)
      }
    },

    async getDocument(id) {
      if (!id) return null
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        const document = await documentService.get(id)
        this.currentDocument = document
        return document
      } catch (error) {
        console.error('获取文档失败:', error)
        throw error
      }
    },

    async createDocument(title, content = '', parentId = null) {
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        if (this.workspaceMode === 'local' && !this.localDirHandle) throw new Error('未连接本地工作区')
        const document = await documentService.create(title, content, parentId ? String(parentId) : null)
        this.documents = [document, ...this.documents]
        await documentService.upsertSearchIndex(document)
        return document
      } catch (error) {
        console.error('创建文档失败:', error)
        throw error
      }
    },

    async createFolder(title, parentId = null) {
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        const folder = await documentService.createFolder(title, parentId ? String(parentId) : null)
        this.documents = [folder, ...this.documents]
        return folder
      } catch (error) {
        console.error('创建文件夹失败:', error)
        throw error
      }
    },

    async moveDocument(id, newParentId) {
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        await documentService.move(id, newParentId || null, this.documents)
        const doc = this.documents.find(d => d.id === id)
        if (doc) doc.parentId = newParentId || null
        if (doc && !doc.isFolder) await documentService.upsertSearchIndex(doc)
      } catch (error) {
        console.error('移动文档失败:', error)
        throw error
      }
    },

    async togglePin(id) {
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        const document = await documentService.togglePin(id, this.documents)
        const index = this.documents.findIndex(doc => doc.id === id)
        if (index !== -1) this.documents = [...this.documents.slice(0, index), document, ...this.documents.slice(index + 1)]
        await documentService.upsertSearchIndex(document)
      } catch (error) {
        console.error('切换置顶状态失败:', error)
        throw error
      }
    },
    
    async toggleFavorite(id) {
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        const document = await documentService.toggleFavorite(id, this.documents)
        const index = this.documents.findIndex(doc => doc.id === id)
        if (index !== -1) this.documents = [...this.documents.slice(0, index), document, ...this.documents.slice(index + 1)]
        await documentService.upsertSearchIndex(document)
      } catch (error) {
        console.error('切换收藏状态失败:', error)
        throw error
      }
    },

    async saveDocument(id, updates) {
      if (!id) return null
      try {
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        const document = await documentService.update(id, updates, this.documents)

        const index = this.documents.findIndex(doc => doc.id === id)
        if (index !== -1) {
          this.documents = [...this.documents.slice(0, index), document, ...this.documents.slice(index + 1)]
        } else {
          this.documents = [...this.documents, document]
        }

        await documentService.upsertSearchIndex(document)
        this.currentDocument = { ...document }
        return document
      } catch (error) {
        console.error('保存文档失败:', error)
        throw error
      }
    },

    async deleteDocument(id) {
      await this.deleteDocuments([id])
    },

    async deleteDocuments(ids) {
      if (!ids || ids.length === 0) return
      try {
        const idSet = new Set(ids)
        documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
        if (this.workspaceMode === 'local' && !this.localDirHandle) throw new Error('未连接本地工作区')
        await documentService.remove(ids)

        this.documents = this.documents.filter(doc => !idSet.has(doc.id))
        await documentService.removeFromSearchIndex(ids)
        if (this.currentDocument && idSet.has(this.currentDocument.id)) {
          this.currentDocument = null
        }
      } catch (error) {
        console.error('批量删除失败:', error)
        throw error
      }
    },

    searchDocuments(query) {
      this.searchQuery = query
      if (!query || !query.trim()) {
        this.searchResults = []
        return
      }
      try {
        const currentQuery = query.trim()
        searchService.search(currentQuery).then(results => {
          if (this.searchQuery === query) {
            const byId = new Map(this.documents.map(d => [d.id, d]))
            this.searchResults = results
              .map(r => {
                const document = byId.get(r.item.id)
                return document ? { ...document, highlightedSummary: r.item.highlightedSummary } : null
              })
              .filter(Boolean)
          }
        }).catch(err => {
          if (this.searchQuery === query) this.searchResults = []
        })
      } catch (error) {
        this.searchResults = []
      }
    },

    clearSearch() {
      this.searchQuery = ''
      this.searchResults = []
    },

    setTagFilter(tags) {
      this.selectedTags = tags
    },

    async exportData() {
      documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
      return await documentService.export()
    },

    async importData(jsonData) {
      documentService.setWorkspaceMode(this.workspaceMode === 'local' ? 'local' : 'indexeddb')
      await documentService.import(jsonData)
      await this.loadDocuments()
    },

    setEditMode(editing) {
      this.isEditing = editing
    },

    // --- 恢复被遗漏的辅助函数 ---
    async reloadPresetDocs() {
      try {
        if (this.workspaceMode === 'local') return
        documentService.setWorkspaceMode('indexeddb')
        this.documents = await documentService.loadPresetDocsIfNeeded(this.documents, true)
        await documentService.refreshSearchIndex(this.documents)
      } catch (error) {
        console.error('重新加载预设文档失败:', error)
        throw error
      }
    },

    isPresetDocument(docId) {
      const doc = this.documents.find(d => d.id === docId)
      return doc && doc.isPreset
    },

    getPresetDocuments() {
      return this.documents.filter(doc => doc.isPreset)
    },

    getUserDocuments() {
      return this.documents.filter(doc => !doc.isPreset)
    },

    async refreshPresetDocs() {
      try {
        await this.loadPresetDocsIfNeeded(true)
      } catch (error) {
        console.error('刷新预设文档失败:', error)
        throw error
      }
    },

    async addDynamicDocuments(dynamicDocs) {
      this.documents = this.documents.filter(doc => !doc.isDynamic)
      this.documents.push(...dynamicDocs)
      await documentService.refreshSearchIndex(this.documents)
    },

    getDynamicDocuments() {
      return this.documents.filter(doc => doc.isDynamic)
    },

    async generateSummariesForExistingDocs() {
      let updatedCount = 0
      const { markdownService: markdownProcessor } = await import('@/services/markdownService')
      for (const doc of this.documents) {
        if (doc.summary && doc.summary.trim()) continue
        if (!doc.content || !doc.content.trim()) continue
        try {
          const summary = markdownProcessor.generateSummary(doc.content, 150)
          // 统一使用 saveDocument 以自动兼容本地/云端存储模式
          await this.saveDocument(doc.id, { summary })
          updatedCount++
        } catch (error) {
          console.error(`为文档 ${doc.title} 生成摘要失败:`, error)
        }
      }
      return updatedCount
    }
  }
})
