import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function useEditorDocument({
  documentId,
  editor,
  documentsStore,
  router,
  getEditorMarkdown,
  afterEditorContentLoaded,
}) {
  const documentTitle = ref('')
  const documentContent = ref('')
  const documentTags = ref([])
  const knowledgeMeta = ref({
    knowledgeType: 'note',
    knowledgeStatus: 'draft',
    confidence: 'medium',
    aliases: [],
    sourceUrl: '',
    relatedIds: [],
    reviewedAt: null,
  })
  const saving = ref(false)
  const lastSaved = ref(null)

  async function loadDocument() {
    if (!documentId.value) {
      documentTitle.value = '新文档'
      documentContent.value = ''
      documentTags.value = []
      knowledgeMeta.value = {
        knowledgeType: 'note',
        knowledgeStatus: 'draft',
        confidence: 'medium',
        aliases: [],
        sourceUrl: '',
        relatedIds: [],
        reviewedAt: null,
      }
      if (editor.value) editor.value.commands.setContent('')
      return
    }

    try {
      const doc = await documentsStore.getDocument(documentId.value)
      if (!doc) return

      documentTitle.value = doc.title
      documentContent.value = doc.content || ''
      documentTags.value = doc.tags || []
      knowledgeMeta.value = {
        knowledgeType: doc.knowledgeType || 'note',
        knowledgeStatus: doc.knowledgeStatus || 'draft',
        confidence: doc.confidence || 'medium',
        aliases: Array.isArray(doc.aliases) ? doc.aliases : [],
        sourceUrl: doc.sourceUrl || '',
        relatedIds: Array.isArray(doc.relatedIds) ? doc.relatedIds.map(String) : [],
        reviewedAt: doc.reviewedAt || null,
      }

      if (editor.value) {
        editor.value.commands.setContent(documentContent.value)
        if (afterEditorContentLoaded) afterEditorContentLoaded()
      }
    } catch (error) {
      ElMessage.error('加载文档失败')
      router.push('/')
    }
  }

  async function saveDocument() {
    if (saving.value) return

    saving.value = true
    try {
      const content = getEditorMarkdown ? getEditorMarkdown() : documentContent.value
      const updates = {
        title: documentTitle.value,
        content,
        tags: documentTags.value,
        ...knowledgeMeta.value,
      }

      if (documentId.value) {
        await documentsStore.saveDocument(documentId.value, updates)
      } else {
        const doc = await documentsStore.createDocument(
          documentTitle.value,
          updates.content,
        )
        documentId.value = doc.id
        router.replace(`/editor/${doc.id}`)
      }

      documentContent.value = updates.content
      lastSaved.value = new Date()
      ElMessage.success('保存成功')
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.value = false
    }
  }

  return {
    documentTitle,
    documentContent,
    documentTags,
    knowledgeMeta,
    saving,
    lastSaved,
    loadDocument,
    saveDocument,
  }
}
