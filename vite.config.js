import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { seoPlugin } from './vite-plugins/seo-plugin.js'
import { changelogPlugin } from './vite-plugins/changelog-plugin.js'
import { VitePWA } from 'vite-plugin-pwa'
import hljs from 'highlight.js'
import mathjax3 from 'markdown-it-mathjax3'
import taskLists from 'markdown-it-task-lists'
import { visualizer } from 'rollup-plugin-visualizer'

// === 引入 Gzip 压缩插件 ===
import viteCompression from 'vite-plugin-compression'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/shizhiku/',
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  plugins: [
    vue({ include: [/\.vue$/, /\.md$/] }),
    visualizer({ open: true }), // 加上这行
    
    // === Gzip 压缩配置 ===
    viteCompression({
      verbose: true,     // 在控制台输出压缩结果
      disable: false,    // 开启压缩
      threshold: 10240,  // 对体积大于 10KB 的资源进行压缩
      algorithm: 'gzip', // 使用 gzip 压缩算法
      ext: '.gz',        // 压缩包扩展名
    }),

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

        md.use(mathjax3)
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
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core']
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    // SEO 优化插件
    seoPlugin({
      baseUrl: 'https://1404413577.github.io/shizhiku/',
      generateSitemap: true,
      generateRobots: true,
      minifyHtml: true
    }),
    changelogPlugin(),
    // 按需启用 docsLoader（如果模块可用）
    ...(docsLoader ? [docsLoader()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: '知时库 - 极简个人知识库',
        short_name: '知时库',
        description: '一个极简、私密、现代的个人知识库管理系统',
        theme_color: '#409eff',
        background_color: '#ffffff',
        start_url: '/shizhiku/',
        display: 'standalone',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,md,woff2}'],
        globIgnores: ['**/tex-svg-full-*.js'],

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /tex-svg-full-.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'math-renderer-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
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
  publicDir: 'public',
  build: {
    rollupOptions: {
      output: {
        // === 函数式拆包策略 (极其重要：防止首页加载过慢) ===
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. 拆分 Excalidraw (白板)
            if (id.includes('@excalidraw')) return 'vendor-excalidraw'
            // 2. 拆分 Tiptap & ProseMirror
            if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('tiptap-markdown')) return 'vendor-tiptap'
            // 3. 拆分 Element Plus
            if (id.includes('element-plus')) return 'vendor-element'
            
            // 🚨 新增：精准剥离 16MB 的 MathJax 巨兽！
            if (id.includes('mathjax-full') || id.includes('markdown-it-mathjax3')) {
              return 'vendor-mathjax' 
            }

            // 4. 拆分 Markdown 解析器与高亮
            if (id.includes('markdown-it') || id.includes('highlight.js')) return 'vendor-markdown'
            // 5. 拆分 Vue 全家桶
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vendor-vue'
            // 6. 其他常用工具
            if (id.includes('localforage') || id.includes('file-saver') || id.includes('fuse.js') || id.includes('flexsearch')) return 'vendor-utils'
            
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
    // 放宽警告体积界限 (因为我们将包拆分了，这个基本不会报警了)
    chunkSizeWarningLimit: 1500,
    assetsInclude: ['**/*.md'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    assetsInlineLimit: 4096
  },
  preview: {
    port: 4173,
    host: true
  }
})