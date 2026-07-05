import { WebDAVClient } from '@/utils/webdav'

const BACKUP_FILE_NAME = 'all_docs_backup.json'

function toWebDavConfig(settings) {
  return {
    url: settings.webdavUrl,
    username: settings.webdavUsername,
    password: settings.webdavPassword,
    path: settings.webdavPath || '/zhishiku',
  }
}

function assertWebDavConfig(config) {
  if (!config.url || !config.username || !config.password) {
    throw new Error('WebDAV 配置不完整')
  }
}

function normalizeRemotePath(path) {
  return String(path || '/zhishiku').replace(/^\/+/, '').replace(/\/+$/, '')
}

export const syncService = {
  createClient(settings) {
    const config = toWebDavConfig(settings)
    assertWebDavConfig(config)
    return new WebDAVClient(config)
  },

  isWebDavConfigured(settings) {
    const config = toWebDavConfig(settings)
    return Boolean(config.url && config.username && config.password)
  },

  async syncDocuments(settings, documents) {
    const config = toWebDavConfig(settings)
    assertWebDavConfig(config)

    const client = new WebDAVClient(config)
    const remotePath = normalizeRemotePath(config.path)
    const fullPath = `${remotePath}/${BACKUP_FILE_NAME}`

    await client.mkdir(remotePath)
    await client.put(fullPath, JSON.stringify({
      documents,
      lastSync: new Date().toISOString(),
    }))

    return { ok: true, path: fullPath }
  },

  async runAutoSync({ settings, documents, reason = 'manual', logger = console }) {
    if (!this.isWebDavConfigured(settings)) return { skipped: true, reason: 'missing-config' }

    try {
      const result = await this.syncDocuments(settings, documents)
      logger.info?.(`WebDAV ${reason} 同步完成`, result.path)
      return result
    } catch (error) {
      logger.warn?.(`WebDAV ${reason} 同步失败:`, error.message)
      throw error
    }
  },

  startAutoBackup({ settings, getDocuments, intervalMs = 10 * 60 * 1000, logger = console }) {
    return setInterval(() => {
      if (!settings.autoBackup) return
      this.runAutoSync({
        settings,
        documents: getDocuments(),
        reason: 'auto-backup',
        logger,
      }).catch(() => {})
    }, intervalMs)
  },
}
