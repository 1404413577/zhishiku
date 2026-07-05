import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { seoPlugin } from './vite-plugins/seo-plugin.js'
import { changelogPlugin } from './vite-plugins/changelog-plugin.js'
import hljs from 'highlight.js'
import taskLists from 'markdown-it-task-lists'
import { basicMathPlugin } from './src/utils/basicMathPlugin.js'

// docs-loader 在运行时可能依赖文件系统，使用按需导入以避免在 Vite 配置打包时出错
let docsLoader
let createDevDocsLoader
try {
  const mod = await import('./vite-plugins/docs-loader.js')
  docsLoader = mod.docsLoader
  createDevDocsLoader = mod.createDevDocsLoader
} catch (e) {
  // 忽略导入错误，开发时会按需处理
  console.warn('无法按需导入 docs-loader:', e && e.message)
}

const normalizeBasePath = (value) => {
  if (!value) return '/'
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const basePath = normalizeBasePath(
  process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/shizhiku/' : '/')
)

const siteBaseUrl = (
  process.env.VITE_SITE_URL || `https://1404413577.github.io${basePath}`
).replace(/\/?$/, '/')

const normalizeWarningId = (id = '') => id.replace(/\\/g, '/')

const isIgnoredRollupWarning = (warning) => {
  const id = normalizeWarningId(warning.id || warning.loc?.file || '')

  if (warning.code === 'INVALID_ANNOTATION' && id.includes('/node_modules/element-plus/node_modules/@vueuse/core/')) {
    return true
  }

  if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && id.includes('/node_modules/@radix-ui/')) {
    return true
  }

  if (warning.code === 'EVAL' && id.includes('/node_modules/onnxruntime-web/')) {
    return true
  }

  return false
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath,

  plugins: [
    vue({ include: [/\.vue$/, /\.md$/] }),

    Markdown({
      markdownItOptions: {
        html: true,
        linkify: true,
        typographer: true,
      },
      markdownItSetup(md) {
        md.options.highlight = function (str, lang) {
          if (lang === 'mermaid') {
            return `<div class="mermaid-wrapper"><div class="mermaid">${md.utils.escapeHtml(str)}</div></div>`
          }

          const rawCode = md.utils.escapeHtml(str)
          let highlightedCode = rawCode

          if (lang && hljs.getLanguage(lang)) {
            try {
              highlightedCode = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
            } catch (__) { }
          }

          const langText = lang ? lang.toUpperCase() : 'TEXT'

          return `<div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-lang">${langText}</span>
              <button class="code-copy-btn" data-clipboard-text="${encodeURIComponent(str)}" title="复制代码">复制</button>
            </div>
            <pre class="hljs"><code>${highlightedCode}</code></pre>
          </div>`
        }

        md.use(basicMathPlugin)
        md.use(taskLists, { enabled: true, label: true })

        // 自定义 Obsidian 双链插件 [[WikiLink]] 用在静态编译期
        md.use((md) => {
          md.inline.ruler.before('link', 'obsidian_link', (state, silent) => {
            const max = state.posMax
            const start = state.pos
            if (state.src.charCodeAt(start) !== 0x5b) return false
            if (start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x5b) return false
            const matchStart = start + 2
            const matchEnd = state.src.indexOf(']]', matchStart)
            if (matchEnd === -1) return false
            if (!silent) {
              const linkText = state.src.slice(matchStart, matchEnd).trim()
              const token = state.push('html_inline', '', 0)
              token.content = `<a href="javascript:void(0)" class="obsidian-link" data-doc-title="${md.utils.escapeHtml(linkText)}">${md.utils.escapeHtml(linkText)}</a>`
            }
            state.pos = matchEnd + 2
            return true
          })
        })
      }
    }),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core']
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
    }),
    // SEO 优化插件
    seoPlugin({
      baseUrl: siteBaseUrl,
      generateSitemap: true,
      generateRobots: true,
      minifyHtml: true
    }),
    changelogPlugin(),
    // 按需启用 docsLoader（如果模块可用）
    ...(docsLoader ? [docsLoader()] : []),
  ],
  server: {
    watch: {
      usePolling: true,
      interval: 200,
    },
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // 确保 docs 文件夹在开发时可以被访问
  publicDir: 'public',
  // 生产环境优化
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (isIgnoredRollupWarning(warning)) return
        defaultHandler(warning)
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/node_modules/')) {
            if (normalizedId.includes('/node_modules/@mlc-ai/web-llm/')) return 'vendor-ai-webllm'
            if (normalizedId.includes('/node_modules/@xenova/transformers/')) return 'vendor-ai-transformers'
            if (
              normalizedId.includes('/node_modules/@excalidraw/') ||
              normalizedId.includes('/node_modules/@radix-ui/') ||
              normalizedId.includes('/node_modules/jotai/') ||
              normalizedId.includes('/node_modules/roughjs/') ||
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/')
            ) return 'vendor-excalidraw'
            if (normalizedId.includes('/node_modules/echarts/') || normalizedId.includes('/node_modules/zrender/')) return 'vendor-charts'
            if (normalizedId.includes('/node_modules/simple-mind-map/')) return 'vendor-mindmap'
            if (
              normalizedId.includes('/node_modules/@tiptap/') ||
              normalizedId.includes('/node_modules/prosemirror-') ||
              normalizedId.includes('/node_modules/tiptap-markdown/')
            ) return 'vendor-tiptap'
            if (
              normalizedId.includes('/node_modules/element-plus/') ||
              normalizedId.includes('/node_modules/@element-plus/icons-vue/')
            ) return 'vendor-element'
            if (
              normalizedId.includes('/node_modules/markdown-it/') ||
              normalizedId.includes('/node_modules/highlight.js/')
            ) return 'vendor-markdown'
            if (
              normalizedId.includes('/node_modules/vue/') ||
              normalizedId.includes('/node_modules/@vue/') ||
              normalizedId.includes('/node_modules/pinia/') ||
              normalizedId.includes('/node_modules/vue-router/')
            ) return 'vendor-vue'
            if (
              normalizedId.includes('/node_modules/@vueuse/') ||
              normalizedId.includes('/node_modules/localforage/') ||
              normalizedId.includes('/node_modules/file-saver/') ||
              normalizedId.includes('/node_modules/flexsearch/')
            ) return 'vendor-utils'
          }
        },
        // 文件命名优化
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(assetInfo.name)) {
            return `img/[name]-[hash].${ext}`
          }
          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
            return `fonts/[name]-[hash].${ext}`
          }
          return `assets/[name]-[hash].${ext}`
        }
      }
    },
    // WebLLM、Transformers、Excalidraw、图表和 Markdown 解析器都是按需加载的大型能力包。
    // 保留明确的 manualChunks，再把阈值设到当前最大懒加载 chunk 之上，避免生产构建被已知体积告警淹没。
    chunkSizeWarningLimit: 6500,
    // 确保构建时包含所有必要的文件
    assetsInclude: ['**/*.md'],
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true
      }
    },
    // 资源内联阈值
    assetsInlineLimit: 4096
  },
  // 预览服务器配置
  preview: {
    port: 4173,
    host: true
  }
})
