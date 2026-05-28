<template>
  <div v-if="headings?.length > 0" class="toc-sidebar">
    <div class="toc-title">目录</div>
    <div class="toc-list">
      <div
        v-for="(h, i) in headings"
        :key="i"
        :class="['toc-item', `toc-level-${h.level}`, { active: i === activeIndex }]"
        @click="$emit('scrollTo', h)"
      >
        {{ h.text }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  headings: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 }
})
defineEmits(['scrollTo'])
</script>

<style scoped>
.toc-sidebar { width: 200px; border-left: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color-page); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.toc-title { padding: 14px 16px; font-size: 13px; font-weight: 600; color: var(--el-text-color-secondary); border-bottom: 1px solid var(--el-border-color-extra-light); text-transform: uppercase; letter-spacing: 1px; }
.toc-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.toc-item { padding: 5px 16px; font-size: 13px; color: var(--el-text-color-regular); cursor: pointer; border-left: 2px solid transparent; transition: all 0.15s; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toc-item:hover { color: var(--el-color-primary); background: var(--el-fill-color-light); }
.toc-item.active { color: var(--el-color-primary); border-left-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.toc-level-1 { padding-left: 16px; font-weight: 600; }
.toc-level-2 { padding-left: 28px; }
.toc-level-3 { padding-left: 40px; font-size: 12px; }
@media (max-width: 768px) {
  .toc-sidebar { display: none; }
}
</style>