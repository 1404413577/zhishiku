import { defineStore } from 'pinia'
import { storage } from '@/utils/storage.js'
import { searchEngine } from '@/utils/search.js'
import { presetDocsLoader } from '@/utils/presetDocs.js'
import { markdownProcessor } from '@/utils/markdown.js'
import { FSService } from '@/services/fs.js'
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
    // 获取所有标签
    allTags: (state) => {
      const tags = new Set()
      state.documents.forEach(doc => {
        if (doc.tags) {
          doc.tags.forEach(tag => tags.add(tag))
        }
      })
      return Array.from(tags).sort()
    },

    // 过滤后的文档 (扁平搜索结果)
    filteredDocuments: (state) => {
      if (state.searchQuery.trim()) {
        return state.searchResults.filter(doc => !doc.isFolder)
      }
      
      if (state.selectedTags.length > 0) {
        return state.documents.filter(doc =>
          !doc.isFolder && doc.tags && state.selectedTags.some(tag => doc.tags.includes(tag))
        )
      }
      
      return state.documents.filter(doc => !doc.isFolder)
    },

    // 基于 parentId 构建的文档树结构
    documentTree: (state) => {
      // 深度拷贝所有文档以避免修改 state 引用
      const items = state.documents.map(doc => ({ ...doc, children: [] }))
      const tree = []
      const lookup = {}

      items.forEach(item => {
        lookup[item.id] = item
      })

      items.forEach(item => {
        if (item.parentId && lookup[item.parentId]) {
          lookup[item.parentId].children.push(item)
        } else {
          // 根节点
          tree.push(item)
        }
      })

      // 对结果进行排序，置顶优先，然后文件夹优先，最后按时间倒序或按 title 排序
      const sortTree = (nodes) => {
        nodes.sort((a, b) => {
          // 1. 比较置顶状态
          const aPinned = a.isPinned ? 1 : 0
          const bPinned = b.isPinned ? 1 : 0
          if (aPinned !== bPinned) return bPinned - aPinned
          
          // 2. 比较文件夹状态
          if (a.isFolder && !b.isFolder) return -1
          if (!a.isFolder && b.isFolder) return 1
          
          // 3. 最后按更新时间倒序排序
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
        nodes.forEach(node => sortTree(node.children))
      }
      sortTree(tree)

      return tree
    },

    // 文档统计
    stats: (state) => ({
      total: state.documents.length,
      tags: state.allTags.length,
      lastUpdated: state.documents.length > 0 
        ? Math.max(...state.documents.map(doc => new Date(doc.updatedAt)))
        : null
    }),

    // 获取每日活跃数据 (用于热力图)
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

    // 获取标签共现数据 (用于星系图谱)
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

          // 计算共现
          for (let i = 0; i < docTags.length; i++) {
            for (let j = i + 1; j < docTags.length; j++) {
              const pair = [docTags[i], docTags[j]].sort().join('|')
              cooccurrence[pair] = (cooccurrence[pair] || 0) + 1
            }
          }
        }
      })

      const nodes = Array.from(tagsSet).map(tag => ({
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
          lineStyle: {
            width: Math.min(count * 2, 8),
            opacity: 0.4
          }
        }
      })

      return { nodes, links }
    }
  },

  actions: {
    // 切换并加载本地工作区
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

    // 切换回浏览器内建存储
    async switchToIndexedDB() {
      this.workspaceMode = 'indexeddb'
      this.localDirHandle = null
      await this.loadDocuments()
      ElMessage.success('已切换回浏览器内建存储')
    },

    // 尝试恢复上一次的本地工作区授权
    async tryRestoreLocalWorkspace() {
      try {
        const handle = await FSService.loadStoredHandle()
        if (handle && await FSService.verifyPermission(handle)) {
          this.localDirHandle = handle
          this.workspaceMode = 'local'
          await this.loadDocuments()
          return true
        }
      } catch (err) {
        console.log('恢复本地工作区失败，可能是用户拒绝或首次打开', err)
      }
      return false
    },

    // 加载所有文档
    async loadDocuments() {
      this.loading = true
      try {
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地文件夹')
          this.documents = await FSService.getFiles(this.localDirHandle)
        } else {
          this.documents = await storage.getAllDocuments()
          await this.loadPresetDocsIfNeeded()
        }

        // 初始化搜索引擎 (异步)
        await searchEngine.initialize([...this.documents])
      } catch (error) {
        console.error('加载文档失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 加载预设文档（如果需要）
    async loadPresetDocsIfNeeded(forceReload = false) {
      try {
        // 如果强制重新加载，清除缓存
        if (forceReload) {
          console.log('🔄 强制重新加载预设文档')
          presetDocsLoader.clearCache()
        }

        // 检查是否已经加载过预设文档
        if (!forceReload && presetDocsLoader.isAlreadyLoaded()) {
          console.log('📚 预设文档已加载，跳过')
          return
        }

        // 检查是否需要加载预设文档
        const shouldLoad = forceReload || await presetDocsLoader.shouldLoadPresetDocs(this.documents)
        if (!shouldLoad) {
          console.log('📚 不需要加载预设文档')
          return
        }

        // 加载预设文档
        console.log('📚 开始加载预设文档...')
        const presetDocs = await presetDocsLoader.loadPresetDocs(forceReload)

        if (presetDocs && presetDocs.length > 0) {
          // 如果是强制重新加载，先删除现有的预设文档
          if (forceReload) {
            console.log('🗑️ 删除现有预设文档...')
            const existingPresetDocs = this.documents.filter(doc => doc.isPreset)
            for (const doc of existingPresetDocs) {
              try {
                await storage.deleteDocument(doc.id)
              } catch (error) {
                console.error('删除预设文档失败:', doc.title, error)
              }
            }
          }

          // 保存预设文档到存储
          console.log(`💾 保存 ${presetDocs.length} 个预设文档到存储...`)
          for (const doc of presetDocs) {
            try {
              console.log(`  📄 保存: ${doc.title}`)
              await storage.saveDocument(doc.id, doc)
            } catch (error) {
              console.error('❌ 保存预设文档失败:', doc.title, error)
              console.error('文档数据:', doc)
              throw error
            }
          }

          // 重新加载文档列表
          this.documents = await storage.getAllDocuments()

          // 标记为已加载
          presetDocsLoader.markAsLoaded()

          console.log(`✅ 已成功加载 ${presetDocs.length} 个预设文档`)
        } else {
          console.log('⚠️ 没有找到预设文档')
        }
      } catch (error) {
        console.warn('加载预设文档失败:', error)
      }
    },

    // 获取文档
    async getDocument(id) {
      if (!id) return null
      
      try {
        if (this.workspaceMode === 'local') {
          const doc = this.documents.find(d => d.id === id)
          if (!doc) throw new Error('Document not found in local workspace')
          
          // 如果有句柄，尝试实时读取最新内容
          if (doc._handle && doc._handle.kind === 'file') {
            const file = await doc._handle.getFile()
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

    // 创建文档 (新增 parentId 参数)
    async createDocument(title, content = '', parentId = null) {
      try {
        let document
        
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地工作区')
          // 本地模式：直接创建 md 文件，暂不处理 parentId 复杂的目录层级，统一放根目录
          const filename = title || '未命名'
          document = await FSService.createFile(this.localDirHandle, filename, content)
        } else {
          document = await storage.createDocument(title, content)
          if (parentId) {
            document.parentId = String(parentId)
          }
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

    // 创建文件夹
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

    // 移动文档/文件夹
    async moveDocument(id, newParentId) {
      try {
        const doc = this.documents.find(d => d.id === id)
        if (!doc) throw new Error('Document not found')

        // 避免循环引用（把父文件夹放进它自己的子文件夹）
        if (doc.isFolder && newParentId) {
          let currentParent = this.documents.find(d => d.id === newParentId)
          while (currentParent) {
            if (currentParent.id === id) {
              throw new Error('Cannot move a folder into its own descendants')
            }
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

    // 另外写专门的切换置顶和收藏操作
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

    // 保存文档
    async saveDocument(id, updates) {
      if (!id) return null
      try {
        let document = null
        const docIndex = this.documents.findIndex(d => d.id === id)

        if (this.workspaceMode === 'local') {
          // 本地模式仅处理 content 修改
          if (docIndex === -1) throw new Error('Local document not found in store')
          
          document = { ...this.documents[docIndex], ...updates }
          
          if (updates.content !== undefined && document._handle) {
            await FSService.writeFile(document._handle, updates.content)
            document.updatedAt = new Date().toISOString()
          }
        } else {
          if (docIndex !== -1) {
            document = await storage.saveDocument(id, { ...this.documents[docIndex], ...updates })
          } else {
            document = await storage.saveDocument(id, updates)
          }
        }

        const index = this.documents.findIndex(doc => doc.id === id)
        if (index !== -1) {
          this.documents = [
            ...this.documents.slice(0, index),
            document,
            ...this.documents.slice(index + 1)
          ]
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

    // 删除文档
    async deleteDocument(id) {
      await this.deleteDocuments([id])
    },

    // 批量删除文档
    async deleteDocuments(ids) {
      if (!ids || ids.length === 0) return
      
      try {
        const idSet = new Set(ids)
        
        if (this.workspaceMode === 'local') {
          if (!this.localDirHandle) throw new Error('未连接本地工作区')
          for (const id of ids) {
            const doc = this.documents.find(d => d.id === id)
            if (doc) {
              await FSService.deleteFile(this.localDirHandle, doc.id)
            }
          }
        } else {
          // 对 IndexedDB 进行批量删除（虽然 storage.deleteDocument 目前是单条删除，我们在 store 循环调用）
          for (const id of ids) {
            await storage.deleteDocument(id)
          }
        }

        // 更新本地状态：过滤掉被删除的 ID
        this.documents = this.documents.filter(doc => !idSet.has(doc.id))
        
        // 重新初始化搜索引擎（只执行一次）
        await searchEngine.initialize([...this.documents])
        
        // 如果当前正在查看的文档被删除了，清空当前文档
        if (this.currentDocument && idSet.has(this.currentDocument.id)) {
          this.currentDocument = null
        }
      } catch (error) {
        console.error('批量删除失败:', error)
        throw error
      }
    },

    // 搜索文档
    searchDocuments(query) {
      console.log('📝 Store: 执行搜索，查询词:', query)

      this.searchQuery = query

      if (!query || !query.trim()) {
        console.log('📝 Store: 查询词为空，清空搜索结果')
        this.searchResults = []
        return
      }

      try {
        const currentQuery = query.trim()
        searchEngine.search(currentQuery).then(results => {
          // 确保搜索词没变（防止竞态）
          if (this.searchQuery === query) {
            const byId = new Map(this.documents.map(d => [d.id, d]))
            this.searchResults = results
              .map(r => byId.get(r.item.id))
              .filter(Boolean)
            console.log('📝 Store: 搜索(Worker)完成，结果数量:', this.searchResults.length)
          }
        }).catch(err => {
          console.error('📝 Store: 搜索异步执行失败:', err)
          // 仅在当前查询仍然匹配时重置结果
          if (this.searchQuery === query) {
            this.searchResults = []
          }
        })
      } catch (error) {
        console.error('📝 Store: 搜索(同步)启动失败:', error)
        this.searchResults = []
      }
    },

    // 清空搜索
    clearSearch() {
      this.searchQuery = ''
      this.searchResults = []
    },

    // 设置标签过滤
    setTagFilter(tags) {
      this.selectedTags = tags
    },

    // 导出数据
    async exportData() {
      try {
        return await storage.exportDocuments()
      } catch (error) {
        console.error('导出数据失败:', error)
        throw error
      }
    },

    // 导入数据
    async importData(jsonData) {
      try {
        await storage.importDocuments(jsonData)
        await this.loadDocuments()
      } catch (error) {
        console.error('导入数据失败:', error)
        throw error
      }
    },

    // 设置编辑模式
    setEditMode(editing) {
      this.isEditing = editing
    },

    // 重新加载预设文档
    async reloadPresetDocs() {
      try {
        // 删除现有的预设文档
        const presetDocs = this.documents.filter(doc => doc.isPreset)
        for (const doc of presetDocs) {
          await storage.deleteDocument(doc.id)
        }

        // 重置加载状态
        localStorage.removeItem('preset-docs-loaded')
        presetDocsLoader.loaded = false

        // 重新加载所有文档
        await this.loadDocuments()
      } catch (error) {
        console.error('重新加载预设文档失败:', error)
        throw error
      }
    },

    // 检查文档是否为预设文档
    isPresetDocument(docId) {
      const doc = this.documents.find(d => d.id === docId)
      return doc && doc.isPreset
    },

    // 获取预设文档列表
    getPresetDocuments() {
      return this.documents.filter(doc => doc.isPreset)
    },

    // 获取用户创建的文档列表
    getUserDocuments() {
      return this.documents.filter(doc => !doc.isPreset)
    },

    // 强制刷新预设文档
    async refreshPresetDocs() {
      console.log('🔄 手动刷新预设文档...')
      try {
        await this.loadPresetDocsIfNeeded(true)
        console.log('✅ 预设文档刷新完成')
      } catch (error) {
        console.error('❌ 刷新预设文档失败:', error)
        throw error
      }
    },

    // 添加动态文档
    async addDynamicDocuments(dynamicDocs) {
      console.log(`📚 添加 ${dynamicDocs.length} 个动态文档`)

      // 移除现有的动态文档
      this.documents = this.documents.filter(doc => !doc.isDynamic)

      // 添加新的动态文档
      this.documents.push(...dynamicDocs)

      // 重新初始化搜索引擎
      await searchEngine.initialize([...this.documents])

      console.log(`✅ 动态文档已更新，当前总文档数: ${this.documents.length}`)
    },

    // 获取动态文档
    getDynamicDocuments() {
      return this.documents.filter(doc => doc.isDynamic)
    },

    // 为现有文档生成摘要
    async generateSummariesForExistingDocs() {
      console.log('🔄 开始为现有文档生成摘要...')
      let updatedCount = 0

      for (const doc of this.documents) {
        // 跳过已有摘要的文档
        if (doc.summary && doc.summary.trim()) {
          continue
        }

        // 跳过没有内容的文档
        if (!doc.content || !doc.content.trim()) {
          continue
        }

        try {
          // 生成摘要并保存
          const summary = markdownProcessor.generateSummary(doc.content, 150)
          await storage.saveDocument(doc.id, { ...doc, summary })
          updatedCount++
        } catch (error) {
          console.error(`为文档 ${doc.title} 生成摘要失败:`, error)
        }
      }

      // 重新加载文档列表
      if (updatedCount > 0) {
        await this.loadDocuments()
        console.log(`✅ 已为 ${updatedCount} 个文档生成摘要`)
      } else {
        console.log('📝 所有文档都已有摘要或无内容')
      }

      return updatedCount
    }
  }
})
