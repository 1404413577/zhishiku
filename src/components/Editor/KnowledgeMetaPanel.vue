<template>
  <section class="knowledge-meta-panel" aria-label="知识元数据">
    <div class="meta-row primary-row">
      <el-select
        v-model="localMeta.knowledgeType"
        size="small"
        placeholder="知识类型"
        @change="emitChange"
      >
        <el-option
          v-for="item in typeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-select
        v-model="localMeta.knowledgeStatus"
        size="small"
        placeholder="状态"
        @change="emitChange"
      >
        <el-option
          v-for="item in statusOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-select
        v-model="localMeta.confidence"
        size="small"
        placeholder="可信度"
        @change="emitChange"
      >
        <el-option label="高可信" value="high" />
        <el-option label="中可信" value="medium" />
        <el-option label="低可信" value="low" />
      </el-select>

      <el-date-picker
        v-model="localMeta.reviewedAt"
        size="small"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="复核日期"
        @change="emitChange"
      />
    </div>

    <div class="meta-row">
      <el-input
        v-model="aliasesText"
        size="small"
        placeholder="别名，用逗号分隔"
        @blur="commitAliases"
        @keyup.enter="commitAliases"
      />

      <el-input
        v-model="localMeta.sourceUrl"
        size="small"
        placeholder="来源链接"
        @blur="emitChange"
        @keyup.enter="emitChange"
      />

      <el-select
        v-model="localMeta.relatedIds"
        size="small"
        multiple
        collapse-tags
        collapse-tags-tooltip
        filterable
        placeholder="手动关联"
        @change="emitChange"
      >
        <el-option
          v-for="doc in relationOptions"
          :key="doc.id"
          :label="doc.title"
          :value="String(doc.id)"
        />
      </el-select>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TYPE_LABELS
} from '@/domain/knowledge/knowledgeAnalytics'

const props = defineProps({
  meta: { type: Object, required: true },
  currentId: { type: [String, Number], default: '' },
  documents: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:meta', 'change'])

const localMeta = reactive({
  knowledgeType: 'note',
  knowledgeStatus: 'draft',
  confidence: 'medium',
  aliases: [],
  sourceUrl: '',
  relatedIds: [],
  reviewedAt: null
})

const aliasesText = ref('')

const typeOptions = computed(() => (
  Object.entries(KNOWLEDGE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
))

const statusOptions = computed(() => (
  Object.entries(KNOWLEDGE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
))

const relationOptions = computed(() => {
  const currentId = String(props.currentId || '')
  return props.documents
    .filter((doc) => !doc.isFolder && String(doc.id) !== currentId)
    .map((doc) => ({ id: String(doc.id), title: doc.title || '未命名' }))
})

const syncFromProps = () => {
  localMeta.knowledgeType = props.meta.knowledgeType || 'note'
  localMeta.knowledgeStatus = props.meta.knowledgeStatus || 'draft'
  localMeta.confidence = props.meta.confidence || 'medium'
  localMeta.aliases = Array.isArray(props.meta.aliases) ? [...props.meta.aliases] : []
  localMeta.sourceUrl = props.meta.sourceUrl || ''
  localMeta.relatedIds = Array.isArray(props.meta.relatedIds) ? props.meta.relatedIds.map(String) : []
  localMeta.reviewedAt = props.meta.reviewedAt ? String(props.meta.reviewedAt).slice(0, 10) : null
  aliasesText.value = localMeta.aliases.join(', ')
}

const buildMetaPayload = () => ({
  knowledgeType: localMeta.knowledgeType,
  knowledgeStatus: localMeta.knowledgeStatus,
  confidence: localMeta.confidence,
  aliases: [...localMeta.aliases],
  sourceUrl: localMeta.sourceUrl.trim(),
  relatedIds: [...localMeta.relatedIds],
  reviewedAt: localMeta.reviewedAt || null
})

const emitChange = () => {
  const payload = buildMetaPayload()
  emit('update:meta', payload)
  emit('change')
}

const commitAliases = () => {
  localMeta.aliases = aliasesText.value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
  emitChange()
}

watch(
  () => props.meta,
  syncFromProps,
  { immediate: true, deep: true }
)
</script>

<style scoped>
.knowledge-meta-panel {
  flex-shrink: 0;
  padding: 10px 20px 12px;
  background:
    linear-gradient(90deg, rgba(15, 159, 110, 0.06), transparent 64%),
    var(--el-fill-color-extra-light);
  border-bottom: 1px solid var(--el-border-color-light);
}

.meta-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.7fr) minmax(180px, 1fr) minmax(180px, 1fr);
  gap: 10px;
  align-items: center;
}

.primary-row {
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  margin-bottom: 8px;
}

@media (max-width: 900px) {
  .meta-row,
  .primary-row {
    grid-template-columns: 1fr;
  }
}
</style>
