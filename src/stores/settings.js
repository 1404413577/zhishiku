import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { settingsRepository } from '@/repositories/settingsRepository'

export const useSettingsStore = defineStore('settings', () => {
  const initialSettings = settingsRepository.loadAll()

  // 主题配置
  const primaryColor = ref(initialSettings.primaryColor)
  const fontSize = ref(initialSettings.fontSize)
  const lineWeight = ref(initialSettings.lineWeight)
  const codeTheme = ref(initialSettings.codeTheme)
  
  // WebDAV 配置
  const webdavUrl = ref(initialSettings.webdavUrl)
  const webdavUsername = ref(initialSettings.webdavUsername)
  const webdavPassword = ref(initialSettings.webdavPassword)
  const webdavPath = ref(initialSettings.webdavPath)
  const syncOnOpen = ref(initialSettings.syncOnOpen)
  const autoBackup = ref(initialSettings.autoBackup)

  // AI 配置
  const aiApiKey = ref(initialSettings.aiApiKey)
  const aiBaseUrl = ref(initialSettings.aiBaseUrl)
  const aiModel = ref(initialSettings.aiModel)
  const aiEngine = ref(initialSettings.aiEngine) // online | local | ollama
  const localAiType = ref(initialSettings.localAiType) // gpu | cpu
  const localModelId = ref(initialSettings.localModelId)
  const localCpuModelId = ref(initialSettings.localCpuModelId)
  const ollamaBaseUrl = ref(initialSettings.ollamaBaseUrl)
  const ollamaModel = ref(initialSettings.ollamaModel)

  // 监听并持久化
  const persistedRefs = {
    primaryColor,
    fontSize,
    lineWeight,
    codeTheme,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavPath,
    syncOnOpen,
    autoBackup,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiEngine,
    localAiType,
    localModelId,
    localCpuModelId,
    ollamaBaseUrl,
    ollamaModel,
  }

  Object.entries(persistedRefs).forEach(([key, settingRef]) => {
    watch(settingRef, (val) => settingsRepository.set(key, val))
  })

  return {
    primaryColor,
    fontSize,
    lineWeight,
    codeTheme,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavPath,
    syncOnOpen,
    autoBackup,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    aiEngine,
    localAiType,
    localModelId,
    localCpuModelId,
    ollamaBaseUrl,
    ollamaModel
  }
})
