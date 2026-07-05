export function useAutoSave({ save, afterChange, delay = 3000 }) {
  let autoSaveTimer = null

  function clearAutoSave() {
    if (!autoSaveTimer) return
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  function handleContentChange() {
    clearAutoSave()
    autoSaveTimer = setTimeout(() => {
      save()
      autoSaveTimer = null
    }, delay)

    if (afterChange) afterChange()
  }

  return {
    handleContentChange,
    clearAutoSave,
  }
}
