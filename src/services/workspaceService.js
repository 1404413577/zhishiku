import localforage from 'localforage'
import { FileSystem } from './fs.js'

const WORKSPACE_HANDLE_KEY = 'zhishiku_workspace_handle'

export const workspaceService = {
  async hasStoredWorkspace() {
    return Boolean(await localforage.getItem(WORKSPACE_HANDLE_KEY))
  },

  async checkMounted() {
    return FileSystem.verifyPermission()
  },

  async requestWorkspaceAccess() {
    return FileSystem.requestWorkspaceAccess()
  },

  async loadStoredHandle() {
    return FileSystem.loadStoredHandle()
  },

  async mountAndReadMarkdownFiles() {
    const handle = await FileSystem.mountWorkspace()
    if (!handle) return { mounted: false, files: [] }

    const files = await FileSystem.readAllFiles()
    return { mounted: true, files }
  },

  async unmount() {
    FileSystem.handle = null
    await localforage.removeItem(WORKSPACE_HANDLE_KEY)
  },
}
