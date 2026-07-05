import { ElMessage } from 'element-plus'

export function useEditorImages({
  documentId,
  documentTitle,
  editor,
  documentsStore,
  markdownProcessor,
  imageService,
  saveDocument,
}) {
  async function resolveEditorImages() {
    if (!editor.value?.view?.dom) return
    await markdownProcessor.resolveLazyImages(
      editor.value.view.dom,
      documentId.value,
      documentsStore.workspaceMode,
      documentsStore.localDirHandle,
    )
  }

  function resolvePreviewImages(previewElement) {
    if (!previewElement) return
    markdownProcessor.resolveLazyImages(
      previewElement,
      documentId.value,
      documentsStore.workspaceMode,
      documentsStore.localDirHandle,
    )
  }

  async function handleImageUpload(file) {
    try {
      const defaultTitle = '未命名文档'
      if (!documentId.value) {
        if (!documentTitle.value || documentTitle.value === '新文档') {
          documentTitle.value = defaultTitle
        }
        await saveDocument()
        if (!documentId.value) return
      }

      const uploadMessage = ElMessage({
        message: '图片保存中...',
        type: 'info',
        duration: 0,
      })

      const imagePath = await imageService.saveImage(
        file,
        documentId.value,
        documentsStore.workspaceMode,
        documentsStore.localDirHandle,
      )
      uploadMessage.close()

      if (editor.value && imagePath) {
        const markdownImage = `\n![](${imagePath})\n`
        editor.value.chain().focus().insertContent(markdownImage).run()
        ElMessage.success('图片粘帖成功')
      }
    } catch (err) {
      console.error(err)
      ElMessage.error(`图片保存失败: ${err.message}`)
    }
  }

  return {
    resolveEditorImages,
    resolvePreviewImages,
    handleImageUpload,
  }
}
