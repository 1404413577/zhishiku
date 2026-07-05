
/**
 * 预设文档加载器
 */
export class PresetDocsLoader {
  constructor() {
    this.loaded = false
  }

  /**
   * 加载预设文档
   */
  async loadPresetDocs(forceReload = false) {
    try {
      let docs = []

      // 生产环境：从构建时生成的 JSON 文件加载
      if (import.meta.env.PROD) {
        console.log('🏭 生产环境：从 preset-docs.json 加载文档')
        const response = await fetch(`${import.meta.env.BASE_URL}preset-docs.json`)
        if (response.ok) {
          docs = await response.json()
          console.log(`📚 从 JSON 文件加载了 ${docs.length} 个文档`)
        } else {
          console.warn('❌ 无法加载 preset-docs.json')
        }
      } else {
        // 开发环境：直接从文件系统加载
        console.log('🔧 开发环境：跳过旧的预设加载机制，返回空列表，由新 .md 组件方案接管')
        docs = []
      }

      // 清理数据确保可序列化
      const cleanedDocs = docs.map(doc => this.cleanDocumentData(doc))
      console.log(`✅ 预设文档加载完成，共 ${cleanedDocs.length} 个文档`)
      return cleanedDocs
    } catch (error) {
      console.error('❌ 加载预设文档失败:', error)
    }

    return []
  }

  /**
   * 清理文档数据，确保可序列化
   */
  cleanDocumentData(doc) {
    return {
      id: String(doc.id || ''),
      title: String(doc.title || ''),
      content: String(doc.content || ''),
      tags: Array.isArray(doc.tags) ? doc.tags.filter(tag => typeof tag === 'string') : [],
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString(),
      isPreset: Boolean(doc.isPreset),
      originalPath: String(doc.originalPath || '')
    }
  }

  /**
   * 开发环境下的预设文档
   */
  getDevPresetDocs() {
    // 简化的测试文档
    const now = new Date().toISOString()

    return [
      {
        id: 'preset-test-doc',
        title: '测试文档',
        content: '# 测试文档\n\n这是一个简单的测试文档。',
        tags: ['预设文档', '测试'],
        createdAt: now,
        updatedAt: now,
        isPreset: true,
        originalPath: '测试文档'
      }
    ]
  }

  /**
   * 示例文档内容
   */
  getExampleDocContent() {
    return `# 知识库使用示例

这是一个示例文档，展示了知识库应用的各种功能。

## Markdown 语法示例

### 文本格式

这是普通文本。

**这是粗体文本**

*这是斜体文本*

~~这是删除线文本~~

### 列表

#### 无序列表
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2
- 项目 3

#### 有序列表
1. 第一步
2. 第二步
3. 第三步

### 代码示例

#### 行内代码
使用 \`console.log()\` 输出信息。

#### 代码块

\`\`\`javascript
// JavaScript 示例
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

\`\`\`python
# Python 示例
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

### 表格

| 功能 | 描述 | 状态 |
|------|------|------|
| Markdown 编辑 | 支持实时预览 | ✅ |
| 搜索功能 | 全文搜索 | ✅ |
| 标签管理 | 分类组织 | ✅ |
| 导入导出 | 数据备份 | ✅ |

### 引用

> 知识就是力量。
> 
> —— 弗朗西斯·培根

### 链接

- [Vue.js 官网](https://vuejs.org/)
- [Markdown 语法指南](https://markdown.com.cn/)

---

## 应用功能介绍

### 1. 文档管理
- 创建、编辑、删除文档
- 自动保存功能
- 文档版本管理

### 2. 搜索功能
- 全文搜索
- 标签过滤
- 智能匹配

### 3. 数据存储
- 本地 IndexedDB 存储
- 数据导入导出
- 浏览器本地保存

### 4. 用户界面
- 响应式设计
- 移动端适配

## 使用技巧

### 快捷键
- \`Ctrl + S\`: 保存文档
- \`Ctrl + N\`: 新建文档
- \`Ctrl + F\`: 搜索

### 标签使用
建议使用有意义的标签来组织文档：
- \`技术\` - 技术相关文档
- \`笔记\` - 学习笔记
- \`项目\` - 项目文档
- \`想法\` - 灵感记录

---

*这个示例文档展示了知识库应用的主要功能。您可以编辑、删除或创建新的文档来体验完整功能。*`
  }

  /**
   * 部署指南内容
   */
  getDeployGuideContent() {
    return `# 知识库应用部署指南

本指南将帮助您将知识库应用部署到各种平台。

## 🏗️ 构建应用

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 构建生产版本

\`\`\`bash
npm run build
\`\`\`

构建完成后，会在项目根目录生成 \`dist\` 文件夹，包含所有静态文件。

### 3. 本地预览

\`\`\`bash
npm run preview
\`\`\`

## 🌐 部署选项

### GitHub Pages

1. **创建 GitHub 仓库**
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/zhishiku.git
   git push -u origin main
   \`\`\`

2. **配置 Vite 基础路径**
   
   在 \`vite.config.js\` 中添加：
   \`\`\`javascript
   export default defineConfig({
     base: '/zhishiku/', // 替换为您的仓库名
     // ... 其他配置
   })
   \`\`\`

### Netlify

1. **通过 Git 部署**
   - 登录 [Netlify](https://netlify.com)
   - 点击 "New site from Git"
   - 选择您的 GitHub 仓库
   - 构建命令: \`npm run build\`
   - 发布目录: \`dist\`

2. **手动部署**
   \`\`\`bash
   npm run build
   # 将 dist 文件夹拖拽到 Netlify 部署页面
   \`\`\`

### Vercel

1. **通过 Git 部署**
   - 登录 [Vercel](https://vercel.com)
   - 导入 GitHub 仓库
   - 框架预设选择 "Vite"
   - 自动部署

2. **命令行部署**
   \`\`\`bash
   npm install -g vercel
   vercel
   \`\`\`

## 🔧 环境配置

### 环境变量

创建 \`.env.production\`:
\`\`\`env
VITE_APP_TITLE=知识库
VITE_APP_VERSION=1.0.0
\`\`\`

## 缓存说明

当前版本不启用 PWA 离线缓存，也不会注册 Service Worker。生产环境启动时会尝试清理旧版本遗留的浏览器缓存。

---

选择适合您需求的部署方案，按照相应的步骤进行部署即可。`
  }

  /**
   * 检查是否需要加载预设文档
   */
  async shouldLoadPresetDocs(existingDocs) {
    // 如果没有任何文档，或者没有预设文档，则加载
    const hasPresetDocs = existingDocs.some(doc => doc.isPreset)
    return existingDocs.length === 0 || !hasPresetDocs
  }

  /**
   * 标记为已加载
   */
  markAsLoaded() {
    this.loaded = true
    localStorage.setItem('preset-docs-loaded', 'true')
  }

  /**
   * 检查是否已加载过
   */
  isAlreadyLoaded() {
    return localStorage.getItem('preset-docs-loaded') === 'true'
  }

  /**
   * 强制重新加载预设文档
   */
  async forceReload() {
    console.log('🔄 强制重新加载预设文档...')
    this.loaded = false
    localStorage.removeItem('preset-docs-loaded')
    return await this.loadPresetDocs(true)
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.loaded = false
    localStorage.removeItem('preset-docs-loaded')
    console.log('🗑️ 已清除预设文档缓存')
  }
}

export const presetDocsLoader = new PresetDocsLoader()
