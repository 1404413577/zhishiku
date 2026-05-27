import localforage from 'localforage'

const generateId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Dedicated IndexedDB store for images
const imagesStore = localforage.createInstance({
  name: 'zhishiku-images'
})

export class ImageService {
  /**
   * Save an image file/blob to the active workspace.
   * 
   * @param {File|Blob} blob - The image blob to save
   * @param {string} docId - The ID of the document (used to group/name images)
   * @param {string} workspaceMode - 'indexeddb' | 'local'
   * @param {FileSystemDirectoryHandle} dirHandle - Required if mode is 'local'
   * @returns {Promise<string>} - The relative markdown link path (e.g. images/...png or zhishiku://images/...png)
   */
  static async saveImage(blob, docId, workspaceMode, dirHandle) {
    const ext = blob.type ? (blob.type.split('/')[1] || 'png') : 'png'
    const timestamp = Date.now()
    
    if (workspaceMode === 'local') {
      if (!dirHandle) throw new Error('本地目录句柄丢失，无法保存图片')
      
      // Determine base directory of the document
      const parts = docId.split('/')
      parts.pop() // remove filename
      const docDir = parts.join('/')
      
      const docFolderHandle = await this._getDirHandle(dirHandle, docDir)
      
      // Ensure 'images' subfolder exists next to the active document
      const imagesDirHandle = await docFolderHandle.getDirectoryHandle('images', { create: true })
      
      const filename = `image-${timestamp}.${ext}`
      const fileHandle = await imagesDirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      
      // Return standard relative path for markdown link
      return `images/${filename}`
    } else {
      // IndexedDB mode
      // Store blob directly in localforage
      // We use a custom protocol prefix to identify internal images: zhishiku://
      const imageId = `zhishiku://images/${generateId()}-${timestamp}.${ext}`
      await imagesStore.setItem(imageId, blob)
      return imageId
    }
  }

  /**
   * Helper to traverse and get a deep directory handle
   */
  static async _getDirHandle(rootHandle, path) {
    let current = rootHandle
    if (!path) return current
    const parts = path.split('/').filter(Boolean)
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true })
    }
    return current
  }

  /**
   * Gets a local browser Blob URL for rendering an image path.
   * 
   * @param {string} path - URL from the markdown source
   * @param {string} docId - ID of the document, required to resolve relative paths in local mode
   * @param {string} workspaceMode - 'indexeddb' | 'local'
   * @param {FileSystemDirectoryHandle} dirHandle - Required if mode is 'local'
   * @returns {Promise<string>} - blob: URL or original path if external/resolution fails
   */
  static async getImageUrl(path, docId, workspaceMode, dirHandle) {
    // Ignore absolute URLs and data URIs
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path
    }

    if (workspaceMode === 'local') {
      if (!dirHandle) return path
      // In local mode, we expect relative paths like "images/xxx.png"
      // or absolute paths. Our save implementation returns "images/xxx"
      try {
        const docParts = docId.split('/')
        docParts.pop() // remove doc filename
        const baseDir = docParts.join('/')
        
        // combine baseDir and path (simplistic resolution)
        let fullPath = path
        if (baseDir) {
           fullPath = `${baseDir}/${path}`
        }
        
        const fileParts = fullPath.split('/').filter(Boolean)
        const filename = fileParts.pop()
        
        let current = dirHandle
        for (const part of fileParts) {
          current = await current.getDirectoryHandle(part, { create: false })
        }
        
        const fileHandle = await current.getFileHandle(filename, { create: false })
        const file = await fileHandle.getFile()
        return URL.createObjectURL(file)
      } catch (e) {
        console.warn('Failed to load local image:', path, e)
        return path
      }
    } else {
      // IndexedDB Mode
      if (path.startsWith('zhishiku://')) {
        try {
          const blob = await imagesStore.getItem(path)
          if (blob) {
            return URL.createObjectURL(blob)
          }
        } catch (e) {
          console.warn('Failed to load IDB image:', path, e)
        }
      }
      return path
    }
  }

  /**
   * Clean up a Blob URL to free memory when image is removed/unmounted
   */
  static revokeImageUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }
}
