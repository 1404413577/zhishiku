import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import mermaid from 'mermaid'
import mathjax3 from 'markdown-it-mathjax3'
import taskLists from 'markdown-it-task-lists'

import { ImageService } from '@/services/image.js'

// 初始化 Mermaid，配置为稍后手动触发，支持随黑白主题自动变化
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
})

// 配置 markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    const normalizedLang = (lang || '').trim().toLowerCase()
    
    if (normalizedLang === 'mermaid') {
      return `<div class="mermaid-wrapper"><div class="mermaid">${md.utils.escapeHtml(str)}</div></div>`
    }

    if (normalizedLang === 'excalidraw') {
      return `<div class="excalidraw-render-container" data-excalidraw-data="${md.utils.escapeHtml(str)}">
        <div class="excalidraw-loading-placeholder">
          <i class="el-icon-loading"></i>
          <span>正在渲染绘图...</span>
        </div>
      </div>`
    }

    const rawCode = md.utils.escapeHtml(str)
    let highlightedCode = rawCode

    if (lang && hljs.getLanguage(lang)) {
      try {
        highlightedCode = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch (__) {}
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
})

// 自定义 Obsidian 双链插件 [[WikiLink]]
const obsidianLinkPlugin = (md) => {
  md.inline.ruler.before('link', 'obsidian_link', (state, silent) => {
    const max = state.posMax
    const start = state.pos

    if (state.src.charCodeAt(start) !== 0x5b /* [ */) return false
    if (start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x5b /* [ */) return false

    // 寻找 ]]
    const matchStart = start + 2
    const matchEnd = state.src.indexOf(']]', matchStart)

    if (matchEnd === -1) return false

    if (!silent) {
      const linkText = state.src.slice(matchStart, matchEnd).trim()
      
      const token = state.push('html_inline', '', 0)
      // 使用 data-doc-title 作为后续 Vue 事件代理查询文档的依据
      token.content = `<a href="javascript:void(0)" class="obsidian-link" data-doc-title="${md.utils.escapeHtml(linkText)}">${md.utils.escapeHtml(linkText)}</a>`
    }

    state.pos = matchEnd + 2
    return true
  })
}

// 注册插件
md.use(mathjax3)
md.use(taskLists, { enabled: true, label: true })
md.use(obsidianLinkPlugin)

// 劫持图片渲染，实现异步加载本地和IndexedDB图片
const defaultImageRenderer = md.renderer.rules.image || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')
  
  if (srcIndex >= 0) {
    const src = token.attrs[srcIndex][1]
    // 拦截非绝对外链的图片（包括相对路径和内部协议 zhishiku://）
    if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      // 存储原始路径并清除 src 防止直接加载报错
      token.attrPush(['data-src', src])
      token.attrs[srcIndex][1] = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // 透明占位图
      
      // 添加特殊 class
      const classIndex = token.attrIndex('class')
      if (classIndex < 0) {
        token.attrPush(['class', 'zhishiku-lazy-image'])
      } else {
        token.attrs[classIndex][1] += ' zhishiku-lazy-image'
      }
    }
  }
  return defaultImageRenderer(tokens, idx, options, env, self)
}

// 可以在这里添加更多插件
// md.use(markdownItAnchor, {
//   permalink: true,
//   permalinkBefore: true,
//   permalinkSymbol: '#'
// })

export class MarkdownProcessor {
  constructor() {
    this.md = md
  }

  // 渲染 Markdown 为 HTML
  render(content) {
    return this.md.render(content)
  }

  // 提取标题用于目录（生成唯一锚点）
  extractHeadings(content) {
    const tokens = this.md.parse(content, {})
    const headings = []
    const slugCountMap = Object.create(null)

    const getUniqueSlug = (base) => {
      const slugBase = base || 'heading'
      const count = slugCountMap[slugBase] || 0
      slugCountMap[slugBase] = count + 1
      return count === 0 ? slugBase : `${slugBase}-${count}`
    }

    tokens.forEach((token, index) => {
      if (token.type === 'heading_open') {
        const level = parseInt(token.tag.substring(1))
        const nextToken = tokens[index + 1]
        if (nextToken && nextToken.type === 'inline') {
          const text = nextToken.content || ''
          const baseSlug = this.generateAnchor(text)
          const uniqueSlug = getUniqueSlug(baseSlug)
          headings.push({
            level,
            text,
            anchor: uniqueSlug
          })
        }
      }
    })

    return headings
  }

  // 生成锚点
  generateAnchor(text) {
    if (!text || typeof text !== 'string') {
      return 'heading-' + Date.now()
    }

    const anchor = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '') // 保留中文、英文、数字、空格和连字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .replace(/^-|-$/g, '') // 移除开头和结尾的连字符
      .trim()

    // 如果处理后为空，使用时间戳作为备用
    return anchor || 'heading-' + Date.now()
  }

  // 提取纯文本用于搜索
  extractText(content) {
    if (!content) return ''
    return String(content)
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .replace(/`[^`]*`/g, '') // 移除行内代码
      .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 保留链接文本
      .replace(/[#*_~`]/g, '') // 移除 Markdown 标记
      .replace(/\n+/g, ' ') // 替换换行为空格
      .trim()
  }

  // 生成文档摘要
  generateSummary(content, maxLength = 200) {
    const text = this.extractText(content)
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...'
      : text
  }
  // 获取复制事件处理方法
  handleCopyClick(event) {
    if (event.target && event.target.classList.contains('code-copy-btn')) {
      const btn = event.target
      let text = btn.getAttribute('data-clipboard-text')
      if (text) {
        text = decodeURIComponent(text)
        navigator.clipboard.writeText(text).then(() => {
          const originalText = btn.innerText
          btn.innerText = '已复制'
          btn.classList.add('copied')
          setTimeout(() => {
            btn.innerText = originalText
            btn.classList.remove('copied')
          }, 2000)
        }).catch(err => {
          console.error('复制失败:', err)
        })
      }
    }
  }

  // 渲染页面上所有的 mermaid 图表
  async renderMermaid() {
    try {
      // 动态获取当前主题
      const isDark = document.documentElement.classList.contains('dark')
      mermaid.initialize({
        theme: isDark ? 'dark' : 'default'
      })
      await mermaid.run({
        querySelector: '.mermaid'
      })
    } catch (err) {
      console.error('Mermaid 渲染失败:', err)
    }
  }

  // 处理复选框的点击以同步 markdown 原文
  syncCheckboxUpdate(originalMarkdown, checkboxElement) {
    if (!checkboxElement.classList.contains('task-list-item-checkbox')) return null

    // 寻找它是所有的 checkbox 中的第几个
    const allCheckboxes = document.querySelectorAll('.markdown-body .task-list-item-checkbox')
    let checkboxIndex = -1
    for (let i = 0; i < allCheckboxes.length; i++) {
      if (allCheckboxes[i] === checkboxElement) {
        checkboxIndex = i
        break
      }
    }

    if (checkboxIndex === -1) return null

    const isChecked = checkboxElement.checked
    const lines = originalMarkdown.split('\n')
    let currentCheckboxCount = 0

    // 匹配原始的 - [ ] (注意这里正则表达式考虑到多级缩进或者非横杠的列表标记比如 * 或 +)
    // 匹配如: - [ ], * [x],   + [ ]
    const checkboxRegex = /^(\s*[-*+]\s+\[)[ xX](\])/

    for (let i = 0; i < lines.length; i++) {
      if (checkboxRegex.test(lines[i])) {
        if (currentCheckboxCount === checkboxIndex) {
          // 修改当前行的 checkbox 状态
          lines[i] = lines[i].replace(checkboxRegex, `$1${isChecked ? 'x' : ' '}$2`)
          return lines.join('\n')
        }
        currentCheckboxCount++
      }
    }

    return null
  }

  // 解析并异步加载 DOM 中的 zhishiku-lazy-image
  async resolveLazyImages(containerElement, docId, workspaceMode, dirHandle) {
    if (!containerElement) return

    const lazyImages = containerElement.querySelectorAll('img.zhishiku-lazy-image')
    
    // 使用 Promise.all 并发处理
    await Promise.all(Array.from(lazyImages).map(async (img) => {
      const src = img.getAttribute('data-src')
      if (!src || img.getAttribute('data-resolved') === 'true') return

      try {
        const objectUrl = await ImageService.getImageUrl(src, docId, workspaceMode, dirHandle)
        // console.log(`[LazyImage] Resolved ${src} -> ${objectUrl}`)
        if (objectUrl) {
          img.src = objectUrl
          img.setAttribute('data-resolved', 'true')
        }
      } catch (err) {
        console.error('Failed to resolve lazy image:', src, err)
        // 渲染失败时也可以考虑给个错误占位图
      }
    }))
  }

  // 渲染 Excalidraw 为 SVG
  async renderExcalidraw() {
    // 兼容两种模式：1. markdown fence 生成的容器 2. Tiptap HTML 导出的 div
    const containers = document.querySelectorAll('.excalidraw-render-container, div[data-type="excalidraw"]')
    if (containers.length === 0) return

    const { getExcalidrawSvg } = await import('@/utils/excalidraw.js')

    for (const container of containers) {
      if (container.getAttribute('data-rendered') === 'true') continue

      // 提取数据：优先从 data-excalidraw-data (fence)，回退到 data-data (tiptap html) 或 data (legacy/fallback)
      const rawData = container.getAttribute('data-excalidraw-data') || 
                      container.getAttribute('data-data') || 
                      container.getAttribute('data')
      if (!rawData) continue

      try {
        const data = JSON.parse(rawData)
        const svg = await getExcalidrawSvg(data.elements || [], {
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        }, data.files || {})

        if (svg) {
          container.innerHTML = svg
          container.setAttribute('data-rendered', 'true')
          
          // 给生成的 SVG 添加一些样式
          const svgEl = container.querySelector('svg')
          if (svgEl) {
            svgEl.style.width = '100%'
            svgEl.style.height = 'auto'
            svgEl.style.maxHeight = '800px'
            svgEl.style.display = 'block'
            svgEl.style.margin = '0 auto'
          }
        } else {
          container.innerHTML = '<div class="render-info">无绘图内容</div>'
        }
      } catch (err) {
        console.error('Failed to render Excalidraw SVG:', err)
        container.innerHTML = '<div class="render-error">绘图渲染失败</div>'
      }
    }
  }
}

export const markdownProcessor = new MarkdownProcessor()
