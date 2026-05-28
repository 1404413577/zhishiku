<template>
  <div class="tags-section">
    <el-tag
      v-for="tag in tags"
      :key="tag"
      closable
      @close="handleRemove(tag)"
      class="tag-item"
    >
      {{ tag }}
    </el-tag>

    <el-input
      v-if="inputVisible"
      ref="inputRef"
      v-model="inputValue"
      size="small"
      class="tag-input"
      @keyup.enter="handleConfirm"
      @blur="handleConfirm"
    />

    <el-button
      v-else
      size="small"
      @click="showInput"
      :icon="Plus"
      text
      bg
    >
      添加标签
    </el-button>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Plus } from '@element-plus/icons-vue'

const props = defineProps({
  tags: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:tags', 'change'])

const inputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref(null)

const handleRemove = (tag) => {
  const newTags = props.tags.filter(t => t !== tag)
  emit('update:tags', newTags)
  emit('change')
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const handleConfirm = () => {
  if (inputValue.value && !props.tags.includes(inputValue.value)) {
    emit('update:tags', [...props.tags, inputValue.value])
    emit('change')
  }
  inputVisible.value = false
  inputValue.value = ''
}
</script>

<style scoped>
.tags-section { padding: 10px 20px; border-bottom: 1px solid var(--el-border-color-light); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
.tag-item { margin: 2px; }
.tag-input { width: 100px; }
</style>