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
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // 新版本 SW 立即激活并接管所有页面，避免旧缓存导致 JS 404
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,md,woff2}'],
        globIgnores: ['**/tex-svg-full-*.js'],

        runtimeCaching: [
          // 导航请求走 NetworkFirst，确保始终获取最新 index.html
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 超大 mathjax 文件运行时按需缓存
          {
            urlPattern: /tex-svg-full-.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'math-renderer-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google 字体缓存
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
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
  // 确保 docs 文件夹在开发时可以被访问
  publicDir: 'public',
  // 生产环境优化
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          ui: ['element-plus'],
          markdown: ['markdown-it'],
          highlight: ['highlight.js'],
          search: ['fuse.js'],
          storage: ['localforage', 'file-saver']
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
    chunkSizeWarningLimit: 1000,
    // 确保构建时包含所有必要的文件
    assetsInclude: ['**/*.md'],
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
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
