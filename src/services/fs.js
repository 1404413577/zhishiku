import { ElMessage } from 'element-plus'
import localforage from 'localforage'

const WORKSPACE_HANDLE_KEY = 'zhishiku_workspace_handle'

export const FileSystem = {
  handle: null,

  async mountWorkspace() {
    try {
      const directoryHandle = await window.showDirectoryPicker({
        id: 'zhishiku_workspace',
        mode: 'readwrite',
        startIn: 'documents'
      })
      this.handle = directoryHandle
      await localforage.setItem(WORKSPACE_HANDLE_KEY, directoryHandle)
      return directoryHandle
    } catch (err) {
      if (err.name !== 'AbortError') {
        ElMessage.error('无法挂载本地文件夹: ' + err.message)
      }
      return null
    }
  },

  async verifyPermission() {
    this.handle = await localforage.getItem(WORKSPACE_HANDLE_KEY)
    if (!this.handle) return false

    const options = { mode: 'readwrite' }
    if ((await this.handle.queryPermission(options)) === 'granted') {
      return true
    }
    
    if ((await this.handle.requestPermission(options)) === 'granted') {
      return true
    }
    
    return false
  },

  async readAllFiles() {
    if (!this.handle) throw new Error('未挂载工作区')
    const files = []
    
    async function traverse(directoryHandle, path = '') {
      for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const file = await entry.getFile()
          const content = await file.text()
          files.push({
            id: entry.name.replace('.md', ''),
            title: entry.name.replace('.md', ''),
            content,
            updatedAt: file.lastModified,
            isLocal: true,
            path: path + entry.name,
            handle: entry
          })
        } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
          await traverse(entry, path + entry.name + '/')
        }
      }
    }
    await traverse(this.handle)
    return files
  },

  async writeFile(filename, content) {
    if (!this.handle) throw new Error('未挂载工作区')
    const safeName = filename.endsWith('.md') ? filename : `${filename}.md`
    try {
      const fileHandle = await this.handle.getFileHandle(safeName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
      return fileHandle
    } catch (err) {
      console.error('保存文件失败:', err)
      throw err
    }
  },

  async deleteFile(filename) {
    if (!this.handle) return
    const safeName = filename.endsWith('.md') ? filename : `${filename}.md`
    await this.handle.removeEntry(safeName)
  },

  async getFiles() {
    return await this.readAllFiles();
  },



  // 🚨 新增：向下兼容旧代码的别名方法
  async requestWorkspaceAccess() {
    return await this.mountWorkspace()
  },

  // 🚨 新增：向下兼容旧版 AppLayout.vue 的调用
  async loadStoredHandle() {
    // 复用最新的权限验证逻辑
    const hasPermission = await this.verifyPermission()
    return hasPermission ? this.handle : null
  }
}