import { defineStore } from 'pinia'
import { workspaceService } from '@/services/workspaceService'

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    isMounted: false,
    loading: false,
    files: [],
    lastError: null,
  }),

  actions: {
    async checkMounted() {
      this.loading = true
      this.lastError = null
      try {
        this.isMounted = await workspaceService.checkMounted()
        return this.isMounted
      } catch (error) {
        this.lastError = error
        this.isMounted = false
        return false
      } finally {
        this.loading = false
      }
    },

    async mountAndReadMarkdownFiles() {
      this.loading = true
      this.lastError = null
      try {
        const result = await workspaceService.mountAndReadMarkdownFiles()
        this.isMounted = result.mounted
        this.files = result.files
        return result
      } catch (error) {
        this.lastError = error
        throw error
      } finally {
        this.loading = false
      }
    },

    async unmount() {
      this.loading = true
      this.lastError = null
      try {
        await workspaceService.unmount()
        this.isMounted = false
        this.files = []
      } catch (error) {
        this.lastError = error
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
