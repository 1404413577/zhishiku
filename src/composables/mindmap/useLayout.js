import { ref } from 'vue'

export function useLayout(rootData, currentTheme) {
  const flatNodes = ref([])
  const connections = ref([])

  const GAP_X = 170
  const GAP_Y = 10
  const NODE_PADDING_X = 20
  const NODE_HEIGHT = 38
  let measureCtx = null

  // 使用 Canvas API 测量文本宽度
  function getTextWidth(text, fontSize) {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d')
    }
    measureCtx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    return measureCtx.measureText(text).width
  }

  // 递归计算宽高
  function computeLayout(node, level = 0) {
    node._level = level
    const fs = level === 0 ? 16 : (node.style?.fontSize || 13)
    node._width = Math.max(90, Math.ceil(getTextWidth(node.title, fs) + NODE_PADDING_X * 2))
    node._height = level === 0 ? 48 : NODE_HEIGHT

    if (!node.children || node.children.length === 0 || node.collapsed) {
      node._totalHeight = node._height
      return
    }

    let total = 0
    for (const child of node.children) {
      computeLayout(child, level + 1)
      total += child._totalHeight
    }
    total += (node.children.length - 1) * GAP_Y
    node._totalHeight = Math.max(node._height, total)
  }

  // 递归分配 X, Y 坐标
  function assignPositions(node, x, topY) {
    node._x = x
    node._y = topY + node._totalHeight / 2 - node._height / 2

    if (!node.children || node.children.length === 0 || node.collapsed) return

    const childrenTotalH = node.children.reduce((s, c) => s + c._totalHeight, 0) + (node.children.length - 1) * GAP_Y
    let childY = topY + (node._totalHeight - childrenTotalH) / 2

    for (const child of node.children) {
      assignPositions(child, x + node._width + GAP_X, childY)
      childY += child._totalHeight + GAP_Y
    }
  }

  // 收集所有节点用于扁平渲染，并生成贝塞尔曲线连线
  function collectNodesAndConnections() {
    const nodes = []
    const conns = []
    const lineColor = currentTheme.value.lineColor

    function walk(node) {
      nodes.push(node)
      if (node.children && !node.collapsed) {
        for (const child of node.children) {
          const parentRight = node._x + node._width
          const parentCY = node._y + node._height / 2
          const childLeft = child._x
          const childCY = child._y + child._height / 2
          const midX = (parentRight + childLeft) / 2

          conns.push({
            id: `${node.id}-${child.id}`,
            path: `M ${parentRight} ${parentCY} C ${midX} ${parentCY}, ${midX} ${childCY}, ${childLeft} ${childCY}`,
            color: lineColor,
          })
          walk(child)
        }
      }
    }
    walk(rootData.value)
    flatNodes.value = nodes
    connections.value = conns
  }

  // 触发一次完整的排版计算
  function recalc() {
    if (!rootData.value) return
    computeLayout(rootData.value, 0)
    assignPositions(rootData.value, 80, 60)
    collectNodesAndConnections()
  }

  return {
    flatNodes,
    connections,
    recalc
  }
}