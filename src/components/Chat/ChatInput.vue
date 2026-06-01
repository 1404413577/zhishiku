<template>
  <div class="chat-footer">
    <div class="input-wrapper">
      <el-input
        v-model="userInput"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 6 }"
        placeholder="给 AI 发送消息... (Shift + Enter 换行)"
        @keydown="handleKeydown"
        resize="none"
        class="chat-input"
        :disabled="isGenerating"
      />
      <div class="input-actions">
        <el-button
          v-if="isGenerating"
          type="danger"
          circle
          :icon="Close"
          @click="$emit('stop')"
          title="停止生成"
        />
        <el-button
          v-else
          type="primary"
          circle
          :icon="Promotion"
          @click="onSend"
          :disabled="!userInput.trim() || disabled"
          class="send-btn"
        />
      </div>
    </div>
    <div class="footer-hint">AI 可能会产生错误，请核实重要信息。</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Close, Promotion } from '@element-plus/icons-vue'

const props = defineProps({
  isGenerating: Boolean,
  disabled: Boolean
})

const emit = defineEmits(['send', 'stop'])
const userInput = ref('')

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  }
}

const onSend = () => {
  const text = userInput.value.trim()
  if (!text || props.disabled || props.isGenerating) return
  emit('send', text)
  userInput.value = ''
}
</script>

<style scoped>
.chat-footer {
  padding: 0 24px 24px;
  max-width: 850px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
.input-wrapper {
  position: relative;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 20px;
  padding: 4px;
  box-shadow: var(--el-box-shadow-lighter);
  transition: border-color 0.2s;
}
.input-wrapper:focus-within {
  border-color: var(--el-color-primary);
}
.chat-input :deep(.el-textarea__inner) {
  background-color: transparent;
  border: none !important;
  box-shadow: none !important;
  padding: 12px 60px 12px 16px;
  font-size: 15px;
  line-height: 1.5;
}
.input-actions {
  position: absolute;
  right: 12px;
  bottom: 8px;
  display: flex;
  align-items: center;
}
.send-btn {
  width: 32px;
  height: 32px;
}
.footer-hint {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 12px;
}

@media (max-width: 768px) {
  .chat-footer {
    padding: 0 12px 12px;
  }
}
</style>