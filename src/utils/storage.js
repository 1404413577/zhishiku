import localforage from 'localforage'
import { markdownProcessor } from './markdown.js'

// 配置 localforage
localforage.config({
  name: 'zhishiku',
  storeName: 'documents'
})

export class DocumentStorage {
  constructor() {
    this.store = localforage
  }

  // 获取所有文档
  async getAllDocuments() {
    const keys = await this.store.keys()
    const documents = []
    
    for (const key of keys) {
      const doc = await this.store.getItem(key)
      documents.push({
        id: key,
        ...doc
      })
    }
    
    return documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }

  // 获取单个文档
  async getDocument(id) {
    return await this.store.getItem(id)
  }

  // 保存文档
  async saveDocument(id, document) {
    try {
      console.log('开始保存文档:', id, document)

      // 清理和序列化数据，确保可以存储到 IndexedDB
      const cleanDoc = this.cleanDocumentForStorage(document)
      console.log('清理后的文档:', cleanDoc)

      // 自动生成摘要（如果有内容且没有摘要）
      let summary = cleanDoc.summary
      if (!summary && cleanDoc.content) {
        summary = markdownProcessor.generateSummary(cleanDoc.content, 150)
      }

      const doc = {
        ...cleanDoc,
        id,
        summary,
        updatedAt: new Date().toISOString()
      }

      console.log('最终文档数据:', doc)

      // 测试序列化
      const testSerialization = JSON.stringify(doc)
      console.log('序列化测试通过，长度:', testSerialization.length)

      await this.store.setItem(id, doc)
      console.log('文档保存成功:', id)

      return doc
    } catch (error) {
      console.error('保存文档失败:', error)
      console.error('文档ID:', id)
      console.error('原始文档:', document)
      throw error
    }
  }

  // 清理文档数据，确保可以序列化
  cleanDocumentForStorage(document) {
    // 使用 JSON 序列化/反序列化来确保数据完全可序列化
    try {
      // 先进行基本清理
      const basicCleaned = this.basicCleanDocument(document)

      // 然后通过 JSON 序列化测试
      const jsonString = JSON.stringify(basicCleaned)
      const parsed = JSON.parse(jsonString)

      return parsed
    } catch (error) {
      console.error('文档数据清理失败:', error)
      console.error('原始文档:', document)

      // 如果清理失败，返回最基本的文档结构
      return this.createMinimalDocument(document)
    }
  }

  // 基本文档清理
  basicCleanDocument(document) {
    const cleaned = {}

    // 定义允许的属性和类型
    const allowedProps = {
      id: 'string',
      title: 'string',
      content: 'string',
      tags: 'array',
      createdAt: 'string',
      updatedAt: 'string',
      isPreset: 'boolean',
      originalPath: 'string',
      parentId: 'string',
      isFolder: 'boolean',
      isPinned: 'boolean',
      isFavorited: 'boolean'
    }

    for (const [key, expectedType] of Object.entries(allowedProps)) {
      const value = document[key]

      if (value === null || value === undefined) {
        continue
      }

      switch (expectedType) {
        case 'string':
          cleaned[key] = String(value)
          break
        case 'boolean':
          cleaned[key] = Boolean(value)
          break
        case 'array':
          if (Array.isArray(value)) {
            cleaned[key] = value.filter(item =>
              typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
            ).map(item => String(item))
          } else {
            cleaned[key] = []
          }
          break
        default:
          // 跳过未知类型
          break
      }
    }

    return cleaned
  }

  // 创建最小文档结构
  createMinimalDocument(document) {
    return {
      id: String(document.id || Date.now()),
      title: String(document.title || '未命名文档'),
      content: String(document.content || ''),
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPreset: Boolean(document.isPreset),
      originalPath: String(document.originalPath || ''),
      parentId: document.parentId ? String(document.parentId) : null,
      isFolder: Boolean(document.isFolder),
      isPinned: Boolean(document.isPinned),
      isFavorited: Boolean(document.isFavorited)
    }
  }

  // 删除文档
  async deleteDocument(id) {
    try {
      await this.store.removeItem(id)
    } catch (error) {
      console.error('删除文档失败:', error)
      throw error
    }
  }

  // 创建新文档
  async createDocument(title, content = '') {
    const id = Date.now().toString()
    const document = {
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      parentId: null,
      isFolder: false,
      isPinned: false,
      isFavorited: false
    }
    
    return await this.saveDocument(id, document)
  }

  // 创建新文件夹
  async createFolder(title, parentId = null) {
    const id = 'folder_' + Date.now().toString()
    const folder = {
      title,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      parentId,
      isFolder: true,
      isPinned: false,
      isFavorited: false
    }
    
    return await this.saveDocument(id, folder)
  }

  // 导出所有文档
  async exportDocuments() {
    const documents = await this.getAllDocuments()
    return JSON.stringify(documents, null, 2)
  }

  // 导入文档
  async importDocuments(jsonData) {
    try {
      const documents = JSON.parse(jsonData)
      const results = []

      for (const doc of documents) {
        const id = String(doc.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
        delete doc.id
        const savedDoc = await this.saveDocument(id, doc)
        results.push(savedDoc)
      }
      
      return results
    } catch (error) {
      throw new Error('导入数据格式错误')
    }
  }

  // 清空所有数据
  async clearAll() {
    try {
      await this.store.clear()
    } catch (error) {
      console.error('清空数据失败:', error)
      throw error
    }
  }
}

export const storage = new DocumentStorage()
