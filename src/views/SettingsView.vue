<template>
  <div class="settings-page">
    <div class="settings-header">
      <h2>个性化与同步设置</h2>
    </div>

    <el-scrollbar>
      <div class="settings-container">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Brush /></el-icon>
              <span>个性化配置</span>
            </div>
          </template>
          
          <el-form label-width="120px">
            <el-form-item label="主题强调色">
              <div class="color-picker-container">
                <el-color-picker v-model="settings.primaryColor" />
                <span class="color-value">{{ settings.primaryColor }}</span>
                <el-button link @click="resetColor">恢复默认</el-button>
              </div>
            </el-form-item>

            <el-form-item label="正文字体大小">
              <el-slider v-model="settings.fontSize" :min="12" :max="24" :step="1" show-input />
            </el-form-item>

            <el-form-item label="正文行高">
              <el-slider v-model="settings.lineWeight" :min="1.2" :max="2.5" :step="0.1" show-input />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Refresh /></el-icon>
              <span>数据同步 (WebDAV)</span>
            </div>
          </template>
          
          <el-alert
            title="数据安全说明"
            type="info"
            description="您的所有数据默认存储在浏览器本地 IndexedDB 中。开启 WebDAV 同步可将数据同步至您的私有云盘（如坚果云、Nextcloud）。"
            show-icon
            :closable="false"
            style="margin-bottom: 20px"
          />

          <el-form label-width="120px">
            <el-form-item label="服务器地址">
              <el-input v-model="settings.webdavUrl" placeholder="https://dav.jianguoyun.com/dav/" />
            </el-form-item>
            <el-form-item label="用户名">
              <el-input v-model="settings.webdavUsername" placeholder="您的账号" />
            </el-form-item>
            <el-form-item label="应用密码/授权码">
              <el-input v-model="settings.webdavPassword" type="password" show-password placeholder="请使用应用专用密码" />
            </el-form-item>
            <el-form-item label="同步路径">
              <el-input v-model="settings.webdavPath" placeholder="/zhishiku" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" :icon="Connection" @click="testWebDAVConnection" :loading="testing">立即同步 & 测试</el-button>
              <el-checkbox v-model="settings.syncOnOpen" class="ml-4">打开时自动同步</el-checkbox>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><FolderOpened /></el-icon>
              <span>原生本地工作区 (Local Workspace)</span>
              <el-tag :type="isWorkspaceMounted ? 'success' : 'info'" style="margin-left: auto">
                {{ isWorkspaceMounted ? '已连接' : '未连接' }}
              </el-tag>
            </div>
          </template>
          
          <el-alert
            title="纯本地 Markdown 模式"
            type="success"
            description="将网页连接到您电脑上的真实文件夹。所有文档将以 .md 格式直接保存在硬盘中，数据 100% 掌握在自己手中，可与 Obsidian、Typora 等软件无缝配合使用！"
            show-icon
            :closable="false"
            style="margin-bottom: 20px"
          />

          <div class="workspace-actions" style="margin-left: 120px;">
            <el-button type="primary" :icon="FolderChecked" @click="handleMountWorkspace" v-if="!isWorkspaceMounted">
              选择本地文件夹
            </el-button>
            <el-button type="warning" :icon="Close" @click="handleUnmountWorkspace" v-else>
              断开工作区连接
            </el-button>
          </div>
        </el-card>

        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI 辅助功能配置</span>
            </div>
          </template>
          
          <el-tabs v-model="settings.aiEngine" class="ai-tabs">
            <el-tab-pane label="在线 API 模式" name="online">
              <el-alert
                title="API 连接说明"
                type="info"
                description="调用兼容 OpenAI 的 API。所有的 AI 功能都是直接从您的浏览器跨域请求您配置的 AI 网关。请确保您填写的 Base URL 能够处理跨域 (CORS) 请求。"
                show-icon
                :closable="false"
                style="margin-bottom: 20px"
              />

              <el-form label-width="120px">
                <el-form-item label="API Base URL">
                  <el-input v-model="settings.aiBaseUrl" placeholder="https://api.openai.com/v1" />
                </el-form-item>
                <el-form-item label="API Key">
                  <el-input v-model="settings.aiApiKey" type="password" show-password placeholder="sk-..." />
                </el-form-item>
                <el-form-item label="默认模型">
                  <el-input v-model="settings.aiModel" placeholder="gpt-3.5-turbo (或 deepseek-chat 等)" />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="testingOnline"
                    :disabled="!settings.aiBaseUrl || !settings.aiApiKey"
                    @click="confirmAndTestApi"
                  >
                    确定并测试
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="纯本地模式" name="local">
              <div v-if="!webgpuSupport.supported" class="webgpu-warning">
                <el-alert
                  :title="webgpuSupport.message"
                  type="warning"
                  show-icon
                  :closable="false"
                />
                <div class="fallback-hint">
                  建议切换到 <b>CPU 模式</b> 运行，虽然速度较慢，但对硬件无特殊要求。
                </div>
              </div>
              <el-alert
                v-else
                title="本地运行说明"
                type="success"
                description="利用 WebLLM 或 Transformers.js 技术在浏览器中直接运行大模型，数据不出本地。"
                show-icon
                :closable="false"
                style="margin-bottom: 20px"
              />

              <el-form label-width="120px">
                <el-form-item label="运行模式">
                  <el-radio-group v-model="settings.localAiType">
                    <el-radio-button label="gpu">GPU (WebGPU)</el-radio-button>
                    <el-radio-button label="cpu">CPU (WASM)</el-radio-button>
                  </el-radio-group>
                </el-form-item>

                <el-form-item v-if="settings.localAiType === 'gpu'" label="GPU 模型选择">
                  <el-select v-model="settings.localModelId" placeholder="选择本地模型" style="width: 100%">
                    <el-option label="SmolLM2-135M (轻量 / 运行快 / 推荐测试)" value="SmolLM2-135M-Instruct-q0f32-MLC" />
                    <el-option label="Llama-3.2-1B (中量 / 效果均衡)" value="Llama-3.2-1B-Instruct-q4f16_1-MLC" />
                  </el-select>
                </el-form-item>

                <el-form-item v-else label="CPU 模型选择">
                  <el-select v-model="settings.localCpuModelId" placeholder="选择本地模型" style="width: 100%">
                    <el-option label="Qwen1.5-0.5B-Chat (0.5B / 中文支持好)" value="Xenova/Qwen1.5-0.5B-Chat" />
                    <el-option label="TinyLlama-1.1B-Chat (1.1B / 通用对话)" value="Xenova/TinyLlama-1.1B-Chat-v1.0" />
                  </el-select>
                  <div class="item-tip">CPU 模型首次运行会下载几百MB权重文件到浏览器缓存中。</div>
                </el-form-item>
                
                <el-form-item v-if="localAiProgress > 0 || localAiStatus">
                  <div style="width: 100%">
                    <div class="progress-info">
                      <span>{{ localAiStatus }}</span>
                      <span v-if="localAiProgress > 0">{{ localAiProgress }}%</span>
                    </div>
                    <el-progress :percentage="localAiProgress" :stroke-width="10" striped striped-flow />
                  </div>
                </el-form-item>

                <el-form-item>
                  <el-button 
                    type="primary" 
                    :disabled="settings.localAiType === 'gpu' && !webgpuSupport.supported" 
                    :loading="loadingLocal"
                    @click="initLocalModel"
                  >
                    {{ loadingLocal ? '正在加载/下载模型...' : '预热/初始化本地模型' }}
                  </el-button>
                  <el-button
                    type="primary"
                    :loading="testingLocal"
                    :disabled="(settings.localAiType === 'gpu' && !webgpuSupport.supported) || !(settings.localAiType === 'gpu' ? settings.localModelId : settings.localCpuModelId)"
                    style="margin-left: 12px"
                    @click="confirmAndTestLocal"
                  >
                    确定并测试
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="Ollama (本地部署)" name="ollama">
              <el-alert
                title="Ollama 连接说明"
                type="success"
                description="连接您位于本地或其他服务器的 Ollama 服务。注意：Ollama 默认不允许浏览器跨域访问，请在系统的环境变量中设置 OLLAMA_ORIGINS='*' 并重启 Ollama。"
                show-icon
                :closable="false"
                style="margin-bottom: 20px"
              />

              <el-form label-width="140px">
                <el-form-item label="Ollama 服务地址">
                  <el-input v-model="settings.ollamaBaseUrl" placeholder="http://localhost:11434" />
                </el-form-item>
                <el-form-item label="默认选用模型">
                  <el-input v-model="settings.ollamaModel" placeholder="例如：deepseek-r1:1.5b (留空将在对话页选择)" />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="testingOllama"
                    :disabled="!settings.ollamaBaseUrl"
                    @click="confirmAndTestOllama"
                  >
                    确定并测试
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>

        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Box /></el-icon>
              <span>备份与恢复</span>
            </div>
          </template>
          
          <div class="backup-actions">
            <el-button type="success" :icon="Download" @click="exportAllData">导出全部数据 (JSON)</el-button>
            <el-upload
              action="#"
              :auto-upload="false"
              :on-change="importData"
              :show-file-list="false"
              style="display: inline-block; margin-left: 12px;"
            >
              <el-button type="warning" :icon="Upload">导入数据备份</el-button>
            </el-upload>
            <el-checkbox v-model="settings.autoBackup" class="ml-4">自动定期备份</el-checkbox>
          </div>
        </el-card>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useDocumentsStore } from '@/stores/documents'
import { useWorkspaceStore } from '@/stores/workspace'
import { Brush, Refresh, Box, Download, Upload, Connection, ChatDotRound, FolderOpened, FolderChecked, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { settingsAiService } from '@/services/settingsAiService'
import { backupService } from '@/services/backupService'
import { syncService } from '@/services/syncService'

const settings = useSettingsStore()
const documentsStore = useDocumentsStore()
const workspaceStore = useWorkspaceStore()
const testing = ref(false)
const testingOnline = ref(false)
const testingLocal = ref(false)
const testingOllama = ref(false)

// 本地 AI 状态
const webgpuSupport = ref({ supported: true, message: '' })
const loadingLocal = ref(false)
const localAiProgress = ref(0)
const localAiStatus = ref('')

const isWorkspaceMounted = computed(() => workspaceStore.isMounted)

onMounted(async () => {
  // 检查 WebGPU
  webgpuSupport.value = await settingsAiService.checkWebGpuSupport()
  
  // 检查并恢复本地工作区权限
  await workspaceStore.checkMounted()
})

// --- 原生工作区相关方法 ---
const handleMountWorkspace = async () => {
  try {
    const connected = await documentsStore.connectLocalWorkspace()
    await workspaceStore.checkMounted()
    if (connected) {
      ElMessage.success(`读取完毕，共 ${documentsStore.documents.length} 个本地 Markdown 文件。`)
    }
  } catch (err) {
    ElMessage.error('读取文件夹失败: ' + err.message)
  }
}

const handleUnmountWorkspace = async () => {
  await documentsStore.switchToIndexedDB()
  await workspaceStore.checkMounted()
}
// -------------------------

const initLocalModel = async () => {
  loadingLocal.value = true
  try {
    await settingsAiService.preloadLocalModel(settings, updateLocalAiProgress)
    ElMessage.success('本地模型加载成功！')
  } catch (err) {
    ElMessage.error('模型加载失败: ' + err.message)
    console.error(err)
  } finally {
    loadingLocal.value = false
  }
}

const updateLocalAiProgress = (report) => {
  localAiProgress.value = report.progress
  localAiStatus.value = report.statusText
}

const confirmAndTestLocal = async () => {
  testingLocal.value = true
  try {
    const reply = await settingsAiService.testLocalModel(settings, updateLocalAiProgress)
    ElMessage.success('本地模型测试成功：' + (reply ? reply.slice(0, 120) : '已连接'))
  } catch (err) {
    ElMessage.error('本地模型测试失败: ' + (err.message || err))
    console.error(err)
  } finally {
    testingLocal.value = false
  }
}

const confirmAndTestOllama = async () => {
  testingOllama.value = true
  try {
    const result = await settingsAiService.testOllama(settings)
    if (result.type === 'chat') {
      ElMessage.success('Ollama 测试成功：' + result.message.slice(0, 120))
    } else {
      ElMessage.success('Ollama 可访问，发现模型数量：' + result.count)
    }
  } catch (err) {
    ElMessage.error('Ollama 测试失败: ' + (err.message || err))
    console.error(err)
  } finally {
    testingOllama.value = false
  }
}

const resetColor = () => {
  settings.primaryColor = '#409eff'
}

const testWebDAVConnection = async () => {
  if (!settings.webdavUrl) {
    ElMessage.warning('请输入服务器地址')
    return
  }
  testing.value = true
  try {
    await syncService.syncDocuments(settings, documentsStore.documents)
    ElMessage.success('WebDAV 连接并同步测试成功！')
  } catch (err) {
    ElMessage.error('连接失败: ' + err.message)
  } finally {
    testing.value = false
  }
}

const confirmAndTestApi = async () => {
  testingOnline.value = true
  try {
    const reply = await settingsAiService.testOnlineApi(settings)
    ElMessage.success('在线 API 测试成功：' + reply.slice(0, 120))
  } catch (err) {
    ElMessage.error('在线 API 测试失败: ' + (err.message || err))
    console.error(err)
  } finally {
    testingOnline.value = false
  }
}

const exportAllData = async () => {
  try {
    backupService.exportAllData(documentsStore.documents, settings)
    ElMessage.success('数据导出成功')
  } catch (err) {
    ElMessage.error('导出失败: ' + err.message)
  }
}

const importData = async (file) => {
  try {
    const data = await backupService.readBackupFile(file.raw)

    await ElMessageBox.confirm('导入备份将合并当前数据，同名文档可能会冲突，是否继续？', '警告', {
      type: 'warning'
    })

    await documentsStore.importData(JSON.stringify(data.documents))
    ElMessage.success('成功导入 ' + data.documents.length + ' 个文档')
  } catch (err) {
    ElMessage.error('导入失败: ' + err.message)
  }
}
</script>

<style scoped>
.settings-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color-page);
}

.settings-header {
  padding: 20px 40px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.settings-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.settings-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.color-picker-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-value {
  font-family: monospace;
  color: var(--el-text-color-secondary);
}

.ml-4 {
  margin-left: 16px;
}

.backup-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.ai-tabs {
  margin-top: -10px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.webgpu-warning {
  margin-bottom: 20px;
}

.fallback-hint {
  margin-top: 10px;
  padding: 12px;
  background-color: var(--el-color-warning-light-9);
  border-left: 4px solid var(--el-color-warning);
  border-radius: 4px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.item-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.workspace-actions {
  display: flex;
  gap: 12px;
}
</style>
