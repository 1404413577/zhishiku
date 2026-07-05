const SETTINGS_SCHEMA = {
  primaryColor: { key: 'setting-primary-color', defaultValue: '#409eff' },
  fontSize: { key: 'setting-font-size', defaultValue: 16, parse: Number, serialize: String },
  lineWeight: { key: 'setting-line-weight', defaultValue: 1.6, parse: Number, serialize: String },
  codeTheme: { key: 'setting-code-theme', defaultValue: 'github' },
  webdavUrl: { key: 'setting-webdav-url', defaultValue: '' },
  webdavUsername: { key: 'setting-webdav-user', defaultValue: '' },
  webdavPassword: { key: 'setting-webdav-password', defaultValue: '' },
  webdavPath: { key: 'setting-webdav-path', defaultValue: '/zhishiku' },
  syncOnOpen: { key: 'setting-sync-open', defaultValue: false, parse: (value) => value === 'true', serialize: String },
  autoBackup: { key: 'setting-auto-backup', defaultValue: true, parse: (value) => value !== 'false', serialize: String },
  aiApiKey: { key: 'setting-ai-api-key', defaultValue: '' },
  aiBaseUrl: { key: 'setting-ai-base-url', defaultValue: 'https://api.openai.com/v1' },
  aiModel: { key: 'setting-ai-model', defaultValue: 'gpt-3.5-turbo' },
  aiEngine: { key: 'setting-ai-engine', defaultValue: 'online' },
  localAiType: { key: 'setting-local-ai-type', defaultValue: 'gpu' },
  localModelId: { key: 'setting-local-model-id', defaultValue: 'SmolLM2-135M-Instruct-q0f32-MLC' },
  localCpuModelId: { key: 'setting-local-cpu-model-id', defaultValue: 'Xenova/Qwen1.5-0.5B-Chat' },
  ollamaBaseUrl: { key: 'setting-ollama-base-url', defaultValue: 'http://localhost:11434' },
  ollamaModel: { key: 'setting-ollama-model', defaultValue: '' },
}

function parseValue(definition, rawValue) {
  if (rawValue === null || rawValue === undefined) return definition.defaultValue
  if (definition.parse) return definition.parse(rawValue)
  return rawValue
}

function serializeValue(definition, value) {
  if (definition.serialize) return definition.serialize(value)
  return String(value ?? '')
}

export const settingsRepository = {
  schema: SETTINGS_SCHEMA,

  get(key) {
    const definition = SETTINGS_SCHEMA[key]
    if (!definition) throw new Error(`未知设置项: ${key}`)
    return parseValue(definition, localStorage.getItem(definition.key))
  },

  set(key, value) {
    const definition = SETTINGS_SCHEMA[key]
    if (!definition) throw new Error(`未知设置项: ${key}`)
    localStorage.setItem(definition.key, serializeValue(definition, value))
  },

  loadAll() {
    return Object.fromEntries(
      Object.keys(SETTINGS_SCHEMA).map((key) => [key, this.get(key)]),
    )
  },

  persistAll(settings) {
    Object.keys(SETTINGS_SCHEMA).forEach((key) => {
      this.set(key, settings[key])
    })
  },
}
