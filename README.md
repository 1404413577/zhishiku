# 知时库 (Knowledge Base)

一个集成了 **本地 AI 对话 (Ollama)**、**Markdown 全能编辑** 与 **离线 PWA** 的现代化个人知识管理系统。纯前端构建，确保数据完全私密。

> 最后更新：2026-03-21

## ✨ 核心特性

- 🤖 **AI 深度集成**:
  - **Ollama 本地大模型**: 完美接入本地部署的 Ollama，支持多模型秒级切换。
  - **流式对话**: 逐字实时渲染 AI 响应，极致的视觉打字机体验。
  - **多会话侧边栏**: 自动根据问题提取标题，支持多条对话线并行管理。
  - **一键归档**: 像聊天一样记录灵感，一键整理成优美的 Markdown 文档永久保存。
- 📝 **全能 Markdown 渲染**:
  - **公式与图表**: 内嵌 MathJax3 数学公式支持与 Mermaid 流程图渲染。
  - **语法高亮**: 代码块支持 100+ 种语言自动着色，并内置一键复制代码功能。
  - **实时预览**: 编辑器支持所见即所得的 MD 预览模式。
- 🔍 **智能搜索与组织**:
  - **模糊搜索**: 基于 Fuse.js 实现极速全文检索，瞬间定位历史文档。
  - **知识图谱**: 可视化展现文档间的引用与关联（双链预览）。
  - **标签系统**: 灵活的多维度标签过滤，让知识井然有序。
- 📱 **极致离线体验 (PWA)**:
  - **断网可用**: 支持 Service Worker 预缓存，离线状态也能正常阅读与编辑。
  - **原生安装**: 支持安装到 Windows/macOS 桌面或 iOS/Android 屏幕。
- 🛠️ **自动化运维**:
  - **构建期日志**: 页面“更新日志”自动读取构建时的 Git Commit 记录，全自动同步。
  - **SEO 优化**: 自动生成 Sitemap 与 Robots.txt，提升搜索引擎友好度。

## 🛠️ 技术栈

- **核心架构**: Vue 3 (Composition API) + Vite 7
- **UI 组件**: Element Plus (现代化交互)
- **状态管理**: Pinia (持久化存储同步)
- **AI 对话**: Ollama API + NDJSON 流处理
- **本地数据库**: localforage (IndexedDB)
- **离线增强**: Vite PWA Plugin
- **Markdown 工具链**: markdown-it, highlight.js, mermaid.js, mathjax3

## 🚀 快速开始

### 运行环境要求
- **Node.js**: 18.x 或更高版本
- **(可选) Ollama**: 若需 AI 对话功能，请先安装并在本地启动 [Ollama](https://ollama.com/)

### 1. 安装与开发
```bash
# 克隆项目并安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 2. 生产环境构建
```bash
# 构建生产包 (dist 目录)
npm run build

# 预览 PWA 环境
npm run preview
```

## 📖 使用指南

### 配置 AI 助手 (Ollama)
1. 确保本地 Ollama 服务已启动。
2. 在系统“设置” -> “AI 配置”中，填写服务地址（默认 `http://localhost:11434`）。
3. **特别注意**：为允许浏览器访问，请在启动 Ollama 前设置环境变量：`OLLAMA_ORIGINS="*"`。

### 历史记录自动归档
- 进入 “AI 对话” 页面即可开始聊天。
- 点击右上角“归档”按钮，当前的对话将自动生成一篇 Markdown 文档并存入你的“我的文档”库中。

## 📁 目录结构

```
src/
├── components/          # 核心 UI 与 布局组件
├── stores/             # 文档管理、设置、搜索状态 (Pinia)
├── utils/              # 包含 markdownProcessor 与 搜索引擎
├── views/              # 页面视图 (Home, Chat, Editor, About等)
├── vite-plugins/       # 自定义构建插件 (Git日志提取、SEO、Docs加载)
└── assets/             # 静态资源与样式
```

## 📄 许可证

本项目基于 MIT 协议开源。

## 🔗 相关链接

- [GitHub 仓库](https://github.com/1404413577/shizhiku)
- [Gitee 仓库](https://gitee.com/hailang123/zhishiku)
