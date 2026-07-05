import { ref } from 'vue'
import { useCreate } from './useCreate'

export function useViewport({ canvasContainer, findNode }) {
  const zoom = ref(1)
  const panX = ref(40)
  const panY = ref(40)
  const { getCenterViewport } = useCreate()

  function fitToCenter() {
    const vp = getCenterViewport()
    zoom.value = vp.zoom
    panX.value = vp.panX
    panY.value = vp.panY
  }

  function zoomIn() {
    zoom.value = Math.min(3, zoom.value * 1.2)
  }

  function zoomOut() {
    zoom.value = Math.max(0.2, zoom.value / 1.2)
  }

  function focusNode(id) {
    const node = findNode(id)
    if (!node) return

    panX.value =
      -node._x * zoom.value + (canvasContainer.value?.clientWidth / 2 || 400)
    panY.value =
      -node._y * zoom.value + (canvasContainer.value?.clientHeight / 2 || 300)
  }

  function onWheel(event) {
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(3, Math.max(0.2, zoom.value * delta))
    const rect = canvasContainer.value.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const scale = newZoom / zoom.value

    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
    zoom.value = newZoom
  }

  return {
    zoom,
    panX,
    panY,
    fitToCenter,
    zoomIn,
    zoomOut,
    focusNode,
    onWheel,
  }
}
