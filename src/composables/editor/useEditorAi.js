import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { aiUseCases } from '@/services/aiUseCases'

export function useEditorAi({
  editor,
  documentTitle,
  documentContent,
  markdownProcessor,
  saveDocument,
}) {
  const aiLoading = ref(false)
  const aiWritingLoading = ref(false)
  const aiAbortController = ref(null)

  async function handleAIPolish() {
    if (!editor.value) return

    const { empty, from, to } = editor.value.state.selection
    if (empty) {
      ElMessage.warning('请先选中文本')
      return
    }

    const selectedText = editor.value.state.doc.textBetween(from, to, ' ')
    if (!selectedText.trim()) return

    aiLoading.value = true
    try {
      const polishedText = await aiUseCases.polishEditorSelection(
        selectedText,
        null,
      )
      editor.value.chain().focus().insertContent(polishedText).run()
      ElMessage.success('润色完成')
    } catch (err) {
      ElMessage.error(err.message || 'AI 润色失败')
    } finally {
      aiLoading.value = false
    }
  }

  async function handleAIWrite() {
    const currentContent = editor.value?.storage.markdown.getMarkdown() || ''
    if (currentContent.trim()) {
      try {
        await ElMessageBox.confirm(
          '当前文档已有内容，AI 帮写将覆盖现有内容，是否继续？',
          'AI 帮写',
          {
            confirmButtonText: '继续',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )
      } catch {
        return
      }
    }

    try {
      const { value: title } = await ElMessageBox.prompt(
        '请输入文档标题，AI 将根据标题自动生成文档内容',
        'AI 帮写',
        {
          confirmButtonText: '开始生成',
          cancelButtonText: '取消',
          inputPlaceholder: '输入标题...',
          inputValue: documentTitle.value || '',
        },
      )
      if (!title || !title.trim()) return

      documentTitle.value = title.trim()
      aiWritingLoading.value = true
      editor.value?.commands.setContent('')
      documentContent.value = ''
      aiAbortController.value = new AbortController()

      ElMessage.info('正在生成文档内容，请稍候...')

      try {
        await aiUseCases.writeDocumentFromTitle(
          title,
          (_delta, fullText) => {
            editor.value?.commands.setContent(fullText)
            documentContent.value = fullText
          },
          { signal: aiAbortController.value.signal },
        )
        await saveDocument()
        ElMessage.success('AI 帮写完成')
      } catch (err) {
        if (err.name === 'AbortError') {
          ElMessage.warning('已停止生成')
        } else {
          throw err
        }
      }
    } catch (err) {
      if (err !== 'cancel' && err !== 'close') {
        ElMessage.error(err.message || 'AI 帮写失败')
      }
    } finally {
      aiWritingLoading.value = false
      aiAbortController.value = null
    }
  }

  function stopAIWrite() {
    aiAbortController.value?.abort()
  }

  function handleEditorAiAction(event) {
    const { type } = event.detail

    if (type === 'summary') {
      const content = editor.value?.storage.markdown.getMarkdown() || ''
      if (!content.trim()) {
        ElMessage.warning('文档内容为空，无法生成总结')
        return
      }

      aiLoading.value = true
      aiUseCases
        .generateSummary(content, () => {})
        .then((summary) => {
          ElMessageBox.alert(
            `<div class="markdown-body">${markdownProcessor.render(summary)}</div>`,
            'AI 总结',
            { dangerouslyUseHTMLString: true, confirmButtonText: '关闭' },
          )
        })
        .catch((err) => {
          ElMessage.error(err.message || 'AI 总结失败')
        })
        .finally(() => {
          aiLoading.value = false
        })
    } else if (type === 'polish') {
      handleAIPolish()
    }
  }

  return {
    aiLoading,
    aiWritingLoading,
    handleAIPolish,
    handleAIWrite,
    stopAIWrite,
    handleEditorAiAction,
  }
}
