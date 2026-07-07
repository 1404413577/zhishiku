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
  padding: 0 24px 20px;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  background: linear-gradient(to top, var(--el-bg-color) 72%, rgba(255, 255, 255, 0));
}
.input-wrapper {
  position: relative;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 14px;
  padding: 5px;
  box-shadow: var(--el-box-shadow-lighter);
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
}
.input-wrapper:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
}
.chat-input :deep(.el-textarea__inner) {
  background-color: transparent;
  border: none !important;
  box-shadow: none !important;
  min-height: 44px !important;
  padding: 12px 58px 12px 14px;
  font-size: 15px;
  line-height: 1.55;
}
.input-actions {
  position: absolute;
  right: 11px;
  bottom: 10px;
  display: flex;
  align-items: center;
}
.send-btn {
  width: 34px;
  height: 34px;
}
.footer-hint {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

@media (max-width: 768px) {
  .chat-footer {
    padding: 0 12px 12px;
  }
  .footer-hint {
    margin-top: 6px;
  }
}
</style>
