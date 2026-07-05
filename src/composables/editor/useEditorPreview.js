import { computed, nextTick, ref } from 'vue'

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function useEditorPreview({
  documentContent,
  editorMode,
  editor,
  previewRef,
  markdownProcessor,
  resolvePreviewImages,
}) {
  const readingProgress = ref(0)
  const tocActiveIndex = ref(0)

  const tocHeadings = computed(() =>
    markdownProcessor
      .extractHeadings(documentContent.value || '')
      .filter((heading) => heading.level <= 3),
  )

  const renderedContent = computed(() =>
    markdownProcessor.render(documentContent.value || ''),
  )

  const lineCount = computed(
    () => documentContent.value?.split('\n').length || 0,
  )

  const estimatedReadTime = computed(() => {
    const len = documentContent.value?.length || 0
    if (len === 0) return 0
    const minutes = Math.ceil(len / 400)
    return minutes <= 1 ? '1 分钟' : `${minutes} 分钟`
  })

  function refreshPreviewAssets(delay = 0) {
    setTimeout(() => {
      markdownProcessor.renderMermaid()
      if (resolvePreviewImages) resolvePreviewImages()
    }, delay)
  }

  function cycleEditorMode() {
    const modes = ['edit', 'split', 'preview']
    const idx = modes.indexOf(editorMode.value)
    editorMode.value = modes[(idx + 1) % 3]

    if (editorMode.value !== 'edit') {
      nextTick(() => refreshPreviewAssets())
    }
  }

  function scrollToHeading(heading) {
    if (editorMode.value !== 'edit') {
      const previewEl = previewRef.value
      if (!previewEl) return
      const allHeadings = previewEl.querySelectorAll('h1, h2, h3')
      for (const h of allHeadings) {
        if (h.textContent?.trim() === heading.text) {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }
    }

    if (!editor.value) return

    const content = editor.value.storage.markdown.getMarkdown()
    const headingLine = new RegExp(
      `^#{1,3}\\s+${escapeRegExp(heading.text)}$`,
      'm',
    )
    const match = content.match(headingLine)
    if (!match) return

    const pos = match.index
    editor.value.commands.setTextSelection(Math.min(pos + 1, content.length))
    editor.value.commands.scrollIntoView()
  }

  function handleTocScroll() {
    if (editorMode.value === 'edit' || tocHeadings.value.length === 0) return

    const previewEl = previewRef.value
    if (!previewEl) return
    const allHeadings = previewEl.querySelectorAll('h1, h2, h3')
    if (allHeadings.length === 0) return

    const containerTop = previewEl.getBoundingClientRect().top
    let activeIndex = 0
    for (let i = 0; i < allHeadings.length; i++) {
      const rect = allHeadings[i].getBoundingClientRect()
      if (rect.top <= containerTop + 100) activeIndex = i
    }
    tocActiveIndex.value = activeIndex
  }

  function handlePreviewScroll({ scrollTop }) {
    const scrollWrap = document.querySelector(
      '.preview-panel .el-scrollbar__wrap',
    )
    if (!scrollWrap) return

    const scrollHeight = scrollWrap.scrollHeight
    const clientHeight = scrollWrap.clientHeight
    if (scrollHeight <= clientHeight) {
      readingProgress.value = 0
      return
    }

    const percent = (scrollTop / (scrollHeight - clientHeight)) * 100
    readingProgress.value = Math.min(100, Math.max(0, percent))
  }

  return {
    readingProgress,
    tocActiveIndex,
    tocHeadings,
    renderedContent,
    lineCount,
    estimatedReadTime,
    refreshPreviewAssets,
    cycleEditorMode,
    scrollToHeading,
    handleTocScroll,
    handlePreviewScroll,
  }
}
