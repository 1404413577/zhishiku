import { ref, computed } from 'vue'

export function useUndoRedo(rootData, onStateChange) {
  const undoStack = ref([])
  const redoStack = ref([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  // 记录操作到历史栈
  function pushUndo() {
    undoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
    redoStack.value = []
    if (undoStack.value.length > 50) undoStack.value.shift() // 最多保留50步
  }

  // 执行撤销
  function undo() {
    if (!canUndo.value) return
    redoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
    rootData.value = undoStack.value.pop()
    if (onStateChange) onStateChange() // 通知视图重新计算布局
  }

  // 执行重做
  function redo() {
    if (!canRedo.value) return
    undoStack.value.push(JSON.parse(JSON.stringify(rootData.value)))
    rootData.value = redoStack.value.pop()
    if (onStateChange) onStateChange() // 通知视图重新计算布局
  }

  // 清空历史（切换导图时调用）
  function clearHistory() {
    undoStack.value = []
    redoStack.value = []
  }

  return {
    canUndo,
    canRedo,
    pushUndo,
    undo,
    redo,
    clearHistory
  }
}