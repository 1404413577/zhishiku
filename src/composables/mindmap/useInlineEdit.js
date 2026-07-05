import { computed, nextTick, ref } from 'vue'

export function useInlineEdit({ panX, panY, zoom, pushUndo, recalc }) {
  const editingNode = ref(null)
  const editText = ref('')
  const editInputRef = ref(null)

  const editInputStyle = computed(() => {
    if (!editingNode.value) return {}
    const node = editingNode.value

    return {
      left: `${panX.value + (node._x + 4) * zoom.value}px`,
      top: `${panY.value + (node._y + 4) * zoom.value}px`,
      width: `${Math.max(node._width - 8, 60) * zoom.value}px`,
      fontSize: `${(node._level === 0 ? 16 : node.style?.fontSize || 13) * zoom.value}px`,
    }
  })

  function startEdit(node) {
    editingNode.value = node
    editText.value = node.title
    nextTick(() => {
      if (editInputRef.value) {
        editInputRef.value.focus()
        editInputRef.value.select()
      }
    })
  }

  function finishEdit() {
    if (
      editingNode.value &&
      editText.value.trim() &&
      editText.value !== editingNode.value.title
    ) {
      pushUndo()
      editingNode.value.title = editText.value.trim()
      recalc()
    }
    cancelEdit()
  }

  function cancelEdit() {
    editingNode.value = null
  }

  return {
    editingNode,
    editText,
    editInputRef,
    editInputStyle,
    startEdit,
    finishEdit,
    cancelEdit,
  }
}
