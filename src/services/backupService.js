function buildBackupData(documents, settings) {
  return {
    documents,
    settings: {
      primaryColor: settings.primaryColor,
      fontSize: settings.fontSize,
      lineWeight: settings.lineWeight,
      codeTheme: settings.codeTheme,
    },
    exportTime: new Date().toISOString(),
    version: '1.0.0',
  }
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const backupService = {
  exportAllData(documents, settings) {
    const data = buildBackupData(documents, settings)
    const date = new Date().toLocaleDateString()
    downloadJson(data, `zhishiku_backup_${date}.json`)
    return data
  },

  async readBackupFile(rawFile) {
    if (!rawFile) throw new Error('未选择备份文件')
    const text = await rawFile.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data.documents)) throw new Error('无效的备份文件')
    return data
  },
}
