# 知识库（Zhishiku）

一个基于 Vue 3 + Vite 的纯前端个人知识库系统。项目侧重 Markdown 文档管理、富文本编辑、全文搜索、AI 辅助写作、思维导图、关系图谱和本地优先的数据存储，适合用来搭建个人笔记、学习资料库或轻量文档中心。

## 项目文档

- [功能盘点](./功能盘点.md)：现有功能、优先级和 V2 处理策略。
- [重构方案](./重构方案.md)：总体架构、分层职责、迁移策略和风险处理。
- [重构计划表](./重构计划表.md)：阶段计划、当前进度和下一步安排。
- [页面功能需求](./页面功能需求.md)：各页面功能、交互状态、数据依赖和验收标准。
- [数据模型设计](./数据模型设计.md)：文档、工作区、AI、思维导图、关系和搜索模型。
- [服务接口设计](./服务接口设计.md)：核心 Service 目标接口与当前落地状态。
- [模块边界](./模块边界.md)：依赖方向、模块职责和禁止事项。
- [测试验收清单](./测试验收清单.md)：构建、数据、页面和模块回归项。

## 主要功能

### 文档管理

- 支持新建、编辑、查看、删除文档。
- 支持文件夹树形目录、拖拽移动、置顶、收藏和批量删除。
- 支持标签管理、标签过滤、最近文档和文档统计。
- 支持预设文档加载，可直接浏览 `docs/` 目录中的 Markdown 文档。
- 支持快捷记录、模板创建、随机打开文档。

### Markdown 编辑与阅读

- 使用 Tiptap 构建编辑器，支持 Markdown 保存和渲染。
- 支持编辑、分屏预览、纯预览和专注模式。
- 支持标题、列表、任务清单、表格、代码块、图片粘贴上传等常见编辑能力。
- 支持目录导航、阅读进度条、预计阅读时间、字符数和行数统计。
- 支持 Mermaid 图表、轻量公式展示、代码高亮和代码复制。
- 支持 `[[双向链接]]`，可在阅读时跳转或创建目标文档。
- 集成 Excalidraw 绘图块，用于在文档中保存和渲染手绘图。

### 搜索与知识发现

- 使用 FlexSearch 构建全文搜索索引。
- 支持关键词搜索、标签过滤和按标题/创建时间/更新时间排序。
- 支持全局搜索组件和侧边栏即时搜索。
- 首页提供文档数量、标签数量、最近文档、活跃热力图、词云、标签分布、文档类型、月度趋势和内容长度分布。
- 关系图谱支持文档关系、文件夹层级、双向链接和标签共现可视化。

### AI 辅助

- AI 对话页支持多会话管理、会话切换、删除消息、停止生成和对话归档为文档。
- 编辑器支持 AI 帮写、选中文本润色和文档总结。
- 思维导图支持根据主题通过 AI 生成导图大纲。
- 支持三类 AI 引擎：
  - 在线 OpenAI 兼容 API。
  - 浏览器本地模型：WebLLM/WebGPU 或 Transformers.js/WASM。
  - 本地/远程 Ollama 服务。

### 思维导图

- 使用 SVG 画布实现思维导图编辑。
- 支持新建多个导图会话、切换和删除会话。
- 支持节点新增、删除、编辑、拖拽换父级、折叠/展开。
- 支持撤销/重做、缩放、拖动画布、自动居中。
- 支持主题、连线样式、布局模式和节点样式调整。
- 支持 Markdown 导入生成导图，支持 JSON/PNG 导出。

### 数据存储与同步

- 默认使用 IndexedDB（localforage）保存在浏览器本地。
- 支持切换到本地文件夹工作区，将文档作为真实 Markdown 文件保存。
- 支持 WebDAV 同步，可对接坚果云、Nextcloud 等私有云盘。
- 支持 JSON 数据导入导出和定期自动备份开关。
- 不启用 PWA 离线缓存，生产环境会清理旧 Service Worker 和 Cache Storage。

### 个性化与部署

- 支持浅色/暗色主题切换。
- 支持主题强调色、正文字体大小、行高等个性化设置。
- 内置 SEO 插件、站点地图、robots 和图标生成脚本。
- 支持部署到 GitHub Pages、Vercel 等静态托管平台。

## 技术栈

### 前端框架

- Vue 3：应用主体与组合式 API。
- Vite 7：开发服务器、构建和插件系统。
- Vue Router 4：Hash 路由。
- Pinia：文档和设置状态管理。
- Element Plus：UI 组件库。
- VueUse：网络状态、暗色模式、窗口尺寸等组合式工具。

### 编辑器与 Markdown

- Tiptap / ProseMirror：富文本编辑器核心。
- tiptap-markdown：编辑内容与 Markdown 互转。
- markdown-it：Markdown 渲染。
- markdown-it-task-lists：任务清单。
- 内置轻量公式插件：保留 `$...$` 和 `$$...$$` 的基础展示，不引入重型公式渲染库。
- highlight.js：代码高亮。
- Mermaid：流程图、时序图等图表渲染。
- Excalidraw：文档内绘图能力。

### 搜索、图表与可视化

- FlexSearch：本地全文搜索。
- Web Worker：搜索后台线程。
- ECharts：统计图表和关系图谱。
- echarts-wordcloud：词云。
- SVG：思维导图画布。

### AI 能力

- OpenAI 兼容 Chat Completions API：在线 AI。
- @mlc-ai/web-llm：浏览器 WebGPU 本地模型。
- @xenova/transformers：浏览器 WASM/CPU 本地模型。
- Ollama API：连接本地或远程 Ollama 服务。

### 存储与导出

- localforage：IndexedDB 存储封装。
- File System Access API：本地文件夹工作区。
- WebDAV：私有云同步。
- file-saver / JSZip：文件导出与批量导出。

### 工程化与部署

- unplugin-auto-import：Vue、Router、Pinia、VueUse 等自动导入。
- unplugin-vue-components：Element Plus 组件自动导入。
- unplugin-vue-markdown：将 `docs/**/*.md` 编译为 Vue 组件。
- vite-plugin-compression：构建压缩。
- rollup-plugin-visualizer / vite-bundle-analyzer：包体分析。
- Playwright：端到端测试依赖。
- 自定义 Vite 插件：`docs-loader`、`seo-plugin`、`changelog-plugin`。
- 轻量 Node 单元测试：覆盖设置持久化、备份解析和 AI 错误归一化等核心纯逻辑。

## 目录结构

```text
.
├── docs/                     # 预设 Markdown 文档
├── public/                   # 图标、站点地图、robots 等静态资源
├── scripts/                  # sitemap、SEO 检查、图标生成脚本
├── src/
│   ├── components/           # 通用组件、编辑器组件、聊天组件、思维导图组件
│   ├── composables/          # SEO、思维导图操作等组合式逻辑
│   ├── router/               # Vue Router 路由配置
│   ├── repositories/         # 文档、设置等持久化适配层
│   ├── services/             # AI、同步、备份、本地工作区、图片等服务
│   ├── stores/               # Pinia 文档、设置和工作区 Store
│   ├── utils/                # Markdown、搜索、存储、导出等底层工具
│   └── views/                # 页面视图
├── tests/                    # 轻量单元测试脚本
├── vite-plugins/             # 项目自定义 Vite 插件
├── index.html
├── package.json
└── vite.config.js
```

## 页面路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | Home | 首页、统计图表、快速操作 |
| `/editor/:id?` | Editor | 文档编辑器 |
| `/view/:id` | Viewer | 文档阅读页 |
| `/search` | Search | 搜索与标签筛选 |
| `/md-docs` | MdDocs | 浏览 `docs/` 静态 Markdown |
| `/chat` | ChatView | AI 对话 |
| `/graph` | GraphView | 关系图谱 |
| `/mindmap` | MindMapView | 思维导图 |
| `/settings` | SettingsView | 设置、同步、AI 配置 |
| `/about` | About | 关于页面 |

## 快速开始

建议使用 Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

开发服务器启动后，按终端输出的地址访问应用。

## 常用命令

```bash
# 本地开发
npm run dev

# 生产构建
npm run build

# 单元测试
npm run test

# 预览生产构建
npm run preview

# 本地 Docker 部署
docker compose up -d --build

# 生成 sitemap 后构建
npm run seo:build

# SEO 检查
npm run seo:check

# 生成应用图标
npm run icons:generate

# 包体分析
npm run analyze
```

## 配置说明

### AI 配置

在设置页可以选择在线 API、本地模型或 Ollama：

- 在线 API 需要配置 `Base URL`、`API Key` 和模型名，接口需兼容 OpenAI Chat Completions。
- 本地 GPU 模式依赖浏览器 WebGPU 支持。
- 本地 CPU 模式会使用 Transformers.js 下载模型权重到浏览器缓存。
- Ollama 需要服务端允许浏览器跨域访问，通常需要配置 `OLLAMA_ORIGINS`。

### WebDAV 同步

在设置页填写 WebDAV 地址、用户名、应用密码和同步路径后，可以手动同步，也可以开启打开时自动同步和定期备份。

### 本地工作区

应用可以通过浏览器 File System Access API 挂载本地文件夹，将 Markdown 文件直接读写到硬盘。该能力依赖浏览器支持，常见于 Chromium 内核浏览器。

## 构建与部署

项目是纯前端应用，构建产物位于 `dist/`，可部署到任意静态站点服务。

本地 Docker 部署会使用多阶段构建：先在 Node 镜像中执行 `npm run test` 和 `npm run build`，再由 Nginx 提供静态文件服务。默认访问地址为 `http://localhost:8080/`。

`vite.config.js` 中会根据环境设置 `base`：

- 默认使用 `/`。
- GitHub Actions 环境默认使用 `/shizhiku/`。
- 可通过 `VITE_BASE_PATH` 覆盖。
- 可通过 `VITE_SITE_URL` 设置 SEO 插件使用的站点地址。

## 备注

- 数据默认保存在浏览器本地 IndexedDB 中，清理浏览器数据可能导致文档丢失，建议定期导出或配置 WebDAV。
- 在线 AI API Key 保存在浏览器本地设置中，请只在可信设备上使用。
- 本地 AI 模型首次运行需要下载模型文件，耗时和体积取决于所选模型。



  访问地址：http://localhost:8080/

  我做了两处本地部署调整：把 Dockerfile 改成直接把本机已构建的 dist 交给 Nginx 服务，并让 .dockerignore 不再排除 dist。原因是原来的容器内 npm ci 在安装 sharp 时需要从 GitHub 下载
  libvips，构建被中断；现在本地先 npm run build，Docker 只负责打包和运行静态站，更稳定。

  验证结果：

  - npm run build 成功
  - docker compose up -d --build 成功
  - 容器 zhishiku 状态为 Up
  - http://localhost:8080/ 返回 200 OK

  常用命令：

  docker compose ps
  docker compose logs -f zhishiku
  docker compose down

  后续如果改了前端代码，重新部署执行：

  npm run build
  docker compose up -d --build