import { defineStore } from 'pinia'
import { storage } from '@/utils/storage.js'
import { searchEngine } from '@/utils/search.js'
import { presetDocsLoader } from '@/utils/presetDocs.js'
import { markdownProcessor } from '@/utils/markdown.js'
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
      const items = state.documents.map(doc => ({ ...doc, children: [] }))
      const tree = []
      const lookup = {}
      items.forEach(item => { lookup[item.id] = item })
      items.forEach(item => {
        if (item.parentId && lookup[item.parentId]) {
          lookup[item.parentId].children.push(item)
        } else {
          tree.push(item)
        }
      })
      const sortTree = (nodes) => {
        nodes.sort((a, b) => {
          const aPinned = a.isPinned ? 1 : 0
          const bPinned = b.isPinned ? 1 : 0
          if (aPinned !== bPinned) return bPinned - aPinned
          if (a.isFolder && !b.isFolder) return -1
          if (!a.isFolder && b.isFolder) return 1
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
        nodes.forEach(node => sortTree(node.children))
      }
      sortTree(tree)
      return tree
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
    },

    getTagCooccurrenceData: (state) => {
      const tagCounts = {}
      const cooccurrence = {}
      const tagsSet = new Set()

      state.documents.forEach(doc => {
        const tags = Array.isArray(doc.tags) ? doc.tags : []
        if (tags.length > 0) {
          const docTags = [...new Set(tags.filter(tag => typeof tag === 'string' && tag.trim()))]
          docTags.forEach(tag => {
            tagsSet.add(tag)
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
          for (let i = 0; i < docTags.length; i++) {
            for (let j = i + 1; j < docTags.length; j++) {
              const pair = [docTags[i], docTags[j]].sort().join('|')
              cooccurrence[pair] = (cooccurrence[pair] || 0) + 1
            }
          }
        }
      })

      const nodes = Array.from(tagsSet).map(tag => ({
        id: tag, name: tag, value: tagCounts[tag],
        symbolSize: Math.min(Math.max(tagCounts[tag] * 8, 20), 80),
        category: 0, label: { show: true }
      }))

      const links = Object.entries(cooccurrence).map(([pair, count]) => {
        const [source, target] = pair.split('|')
        return {
          source, target, value: count,
          lineStyle: { width: Math.min(count * 2, 8), opacity: 0.4 }
        }
      })
      return { nodes, links }
    }
  },

  actions: {
    async connectLocalWorkspace() {
      try {
        const handle = await FSService.requestWorkspaceAccess()
        this.localDirHandle = handle
        this.workspaceMode = 'local'
        await this.loadDocuments()
        ElMessage.success('已成功连接到本地工作区')
      } catch (err) {
        ElMessage.error(err.message || '连接本地工作区失败')
      }
    },

    async switchToIndexedDB() {
      this.workspaceMode = 'indexeddb'
      this.localDirHandle = null
      await this.loadDocuments()
      ElMessage.success('已切换回浏览器内建存储')
    },

    async tryRestoreLocalWorkspace() {
      try {
        const handle = await FSService.loadStoredHandle()
        if (handle) {
          this.localDirHandle = handle
          this.workspaceMode = 'local'
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
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地文件夹')
          this.documents = await FSService.readAllFiles()
        } else {
          this.documents = await storage.getAllDocuments()
          await this.loadPresetDocsIfNeeded()
        }
        await searchEngine.initialize([...this.documents])
      } catch (error) {
        console.error('加载文档失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async loadPresetDocsIfNeeded(forceReload = false) {
      try {
        if (forceReload) presetDocsLoader.clearCache()
        if (!forceReload && presetDocsLoader.isAlreadyLoaded()) return

        const shouldLoad = forceReload || await presetDocsLoader.shouldLoadPresetDocs(this.documents)
        if (!shouldLoad) return

        const presetDocs = await presetDocsLoader.loadPresetDocs(forceReload)
        if (presetDocs && presetDocs.length > 0) {
          if (forceReload) {
            const existingPresetDocs = this.documents.filter(doc => doc.isPreset)
            for (const doc of existingPresetDocs) {
              await storage.deleteDocument(doc.id)
            }
          }
          for (const doc of presetDocs) {
            await storage.saveDocument(doc.id, doc)
          }
          this.documents = await storage.getAllDocuments()
          presetDocsLoader.markAsLoaded()
        }
      } catch (error) {
        console.warn('加载预设文档失败:', error)
      }
    },

    async getDocument(id) {
      if (!id) return null
      try {
        if (this.workspaceMode === 'local') {
          const doc = this.documents.find(d => d.id === id)
          if (!doc) throw new Error('Document not found in local workspace')
          
          if (doc.handle && doc.handle.kind === 'file') {
            const file = await doc.handle.getFile()
            doc.content = await file.text()
            doc.updatedAt = new Date(file.lastModified).toISOString()
          }
          this.currentDocument = doc
          return doc
        } else {
          const document = await storage.getDocument(id)
          this.currentDocument = document
          return document
        }
      } catch (error) {
        console.error('获取文档失败:', error)
        throw error
      }
    },

    async createDocument(title, content = '', parentId = null) {
      try {
        let document
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地工作区')
          const filename = title || '未命名'
          const fileHandle = await FSService.writeFile(filename, content)
          document = {
            id: filename, title: filename, content: content,
            updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
            isLocal: true, handle: fileHandle, parentId: parentId || null
          }
        } else {
          document = await storage.createDocument(title, content)
          if (parentId) document.parentId = String(parentId)
        }

        if (this.workspaceMode === 'indexeddb' && parentId) {
          await this.saveDocument(document.id, document)
        } else {
          this.documents = [document, ...this.documents]
          await searchEngine.initialize([...this.documents])
        }
        return document
      } catch (error) {
        console.error('创建文档失败:', error)
        throw error
      }
    },

    async createFolder(title, parentId = null) {
      try {
        const folder = await storage.createFolder(title, parentId)
        this.documents = [folder, ...this.documents]
        return folder
      } catch (error) {
        console.error('创建文件夹失败:', error)
        throw error
      }
    },

    async moveDocument(id, newParentId) {
      try {
        const doc = this.documents.find(d => d.id === id)
        if (!doc) throw new Error('Document not found')

        if (doc.isFolder && newParentId) {
          let currentParent = this.documents.find(d => d.id === newParentId)
          while (currentParent) {
            if (currentParent.id === id) throw new Error('Cannot move a folder into its own descendants')
            currentParent = this.documents.find(d => d.id === currentParent.parentId)
          }
        }
        doc.parentId = newParentId || null
        await this.saveDocument(id, { parentId: doc.parentId })
      } catch (error) {
        console.error('移动文档失败:', error)
        throw error
      }
    },

    async togglePin(id) {
      try {
        const doc = this.documents.find(d => d.id === id)
        if (!doc) throw new Error('Document not found')
        doc.isPinned = !doc.isPinned
        await this.saveDocument(id, { isPinned: doc.isPinned })
      } catch (error) {
        console.error('切换置顶状态失败:', error)
        throw error
      }
    },
    
    async toggleFavorite(id) {
      try {
        const doc = this.documents.find(d => d.id === id)
        if (!doc) throw new Error('Document not found')
        doc.isFavorited = !doc.isFavorited
        await this.saveDocument(id, { isFavorited: doc.isFavorited })
      } catch (error) {
        console.error('切换收藏状态失败:', error)
        throw error
      }
    },

    async saveDocument(id, updates) {
      if (!id) return null
      try {
        let document = null
        const docIndex = this.documents.findIndex(d => d.id === id)

        if (this.workspaceMode === 'local') {
          if (docIndex === -1) throw new Error('Local document not found in store')
          const oldDoc = this.documents[docIndex]
          document = { ...oldDoc, ...updates }
          
          if (updates.title && updates.title !== oldDoc.title) {
            await FSService.deleteFile(oldDoc.title)
            document.handle = await FSService.writeFile(updates.title, document.content || '')
            document.id = updates.title
          } else if (updates.content !== undefined) {
            document.handle = await FSService.writeFile(document.title, updates.content)
          }
          document.updatedAt = new Date().toISOString()
        } else {
          if (docIndex !== -1) {
            document = await storage.saveDocument(id, { ...this.documents[docIndex], ...updates })
          } else {
            document = await storage.saveDocument(id, updates)
          }
        }

        const index = this.documents.findIndex(doc => doc.id === id)
        if (index !== -1) {
          this.documents = [...this.documents.slice(0, index), document, ...this.documents.slice(index + 1)]
        } else {
          this.documents = [...this.documents, document]
        }

        await searchEngine.initialize([...this.documents])
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
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地工作区')
          for (const id of ids) {
            const doc = this.documents.find(d => d.id === id)
            if (doc) await FSService.deleteFile(doc.title || doc.id)
          }
        } else {
          for (const id of ids) {
            await storage.deleteDocument(id)
          }
        }

        this.documents = this.documents.filter(doc => !idSet.has(doc.id))
        await searchEngine.initialize([...this.documents])
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
        searchEngine.search(currentQuery).then(results => {
          if (this.searchQuery === query) {
            const byId = new Map(this.documents.map(d => [d.id, d]))
            this.searchResults = results.map(r => byId.get(r.item.id)).filter(Boolean)
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
      return await storage.exportDocuments()
    },

    async importData(jsonData) {
      await storage.importDocuments(jsonData)
      await this.loadDocuments()
    },

    setEditMode(editing) {
      this.isEditing = editing
    },

    // --- 恢复被遗漏的辅助函数 ---
    async reloadPresetDocs() {
      try {
        const presetDocs = this.documents.filter(doc => doc.isPreset)
        for (const doc of presetDocs) await storage.deleteDocument(doc.id)
        localStorage.removeItem('preset-docs-loaded')
        presetDocsLoader.loaded = false
        await this.loadDocuments()
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
      await searchEngine.initialize([...this.documents])
    },

    getDynamicDocuments() {
      return this.documents.filter(doc => doc.isDynamic)
    },

    async generateSummariesForExistingDocs() {
      let updatedCount = 0
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