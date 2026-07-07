import { ref } from 'vue'

// 新增 layoutMode 参数: 'right' (向右展开) | 'centered' (两边散开)
export function useLayout(rootData, currentTheme, lineStyle, layoutMode) {
  const flatNodes = ref([])
  const connections = ref([])

  const GAP_X = 170
  const GAP_Y = 10
  const NODE_PADDING_X = 20
  const NODE_HEIGHT = 38
  const ROOT_MAX_WIDTH = 280
  const NODE_MAX_WIDTH = 220
  const LINE_HEIGHT = 18
  let measureCtx = null

  function getTextWidth(text, fontSize) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
    measureCtx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    return measureCtx.measureText(text).width
  }

  function wrapText(text, fontSize, maxTextWidth, maxLines = 2) {
    const source = String(text || '未命名')
    const chars = Array.from(source)
    const lines = []
    let current = ''

    for (const char of chars) {
      const next = current + char
      if (current && getTextWidth(next, fontSize) > maxTextWidth) {
        lines.push(current)
        current = char
        if (lines.length === maxLines - 1) break
      } else {
        current = next
      }
    }

    const consumed = lines.join('').length + current.length
    if (consumed < chars.length && current) {
      while (current.length > 1 && getTextWidth(`${current}…`, fontSize) > maxTextWidth) {
        current = current.slice(0, -1)
      }
      current = `${current}…`
    }

    if (current) lines.push(current)
    return lines.length > 0 ? lines : [source]
  }

  function computeLayout(node, level = 0) {
    node._level = level
    const fs = level === 0 ? 16 : (node.style?.fontSize || 13)
    const maxWidth = level === 0 ? ROOT_MAX_WIDTH : NODE_MAX_WIDTH
    const maxTextWidth = maxWidth - NODE_PADDING_X * 2
    node._lines = wrapText(node.title, fs, maxTextWidth, level === 0 ? 2 : 2)
    const widestLine = Math.max(...node._lines.map(line => getTextWidth(line, fs)))
    node._width = Math.min(maxWidth, Math.max(90, Math.ceil(widestLine + NODE_PADDING_X * 2)))
    node._height = Math.max(level === 0 ? 48 : NODE_HEIGHT, node._lines.length * LINE_HEIGHT + (level === 0 ? 22 : 16))

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

  // 增加 direction 参数：1向右，-1向左
  function assignPositions(node, x, topY, direction = 1) {
    node._x = direction === 1 ? x : x - node._width
    node._y = topY + node._totalHeight / 2 - node._height / 2
    node._direction = direction // 记录节点朝向，用于画线

    if (!node.children || node.children.length === 0 || node.collapsed) return

    const childrenTotalH = node.children.reduce((s, c) => s + c._totalHeight, 0) + (node.children.length - 1) * GAP_Y
    let childY = topY + (node._totalHeight - childrenTotalH) / 2

    for (const child of node.children) {
      const nextX = direction === 1 ? node._x + node._width + GAP_X : node._x - GAP_X
      assignPositions(child, nextX, childY, direction)
      childY += child._totalHeight + GAP_Y
    }
  }

  function collectNodesAndConnections() {
    const nodes = []
    const conns = []
    const color = currentTheme.value.lineColor
    const style = lineStyle?.value || 'curve'

    function walk(node) {
      nodes.push(node)
      if (node.children && !node.collapsed) {
        for (const child of node.children) {
          const isLeft = child._direction === -1
          // 连线起点：根据左右方向决定是从右边缘出还是左边缘出
          const startX = isLeft ? node._x : node._x + node._width
          const startY = node._y + node._height / 2
          // 连线终点
          const endX = isLeft ? child._x + child._width : child._x
          const endY = child._y + child._height / 2
          const midX = (startX + endX) / 2

          let path = ''
          if (style === 'curve') path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
          else if (style === 'orthogonal') path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
          else if (style === 'straight') path = `M ${startX} ${startY} L ${endX} ${endY}`

          conns.push({ id: `${node.id}-${child.id}`, path, color })
          walk(child)
        }
      }
    }
    walk(rootData.value)
    flatNodes.value = nodes
    connections.value = conns
  }

  function recalc() {
    if (!rootData.value) return
    computeLayout(rootData.value, 0)

    const mode = layoutMode?.value || 'right'
    if (mode === 'centered' && rootData.value.children && rootData.value.children.length > 0) {
      // 中心布局：子节点按奇偶分发到左右两边
      rootData.value._x = 80 // 假定初始位置，后由 pan 控制
      rootData.value._y = 60
      rootData.value._direction = 1

      const leftChildren = rootData.value.children.filter((_, i) => i % 2 !== 0)
      const rightChildren = rootData.value.children.filter((_, i) => i % 2 === 0)

      const calcHalfLayout = (children, direction) => {
        if (!children.length) return
        const totalH = children.reduce((s, c) => s + c._totalHeight, 0) + (children.length - 1) * GAP_Y
        let startY = rootData.value._y + rootData.value._height / 2 - totalH / 2
        children.forEach(child => {
          const nextX = direction === 1 ? rootData.value._x + rootData.value._width + GAP_X : rootData.value._x - GAP_X
          assignPositions(child, nextX, startY, direction)
          startY += child._totalHeight + GAP_Y
        })
      }
      calcHalfLayout(rightChildren, 1)
      calcHalfLayout(leftChildren, -1)
    } else {
      // 传统的向右布局
      assignPositions(rootData.value, 80, 60, 1)
    }
    collectNodesAndConnections()
  }

  return { flatNodes, connections, recalc }
}
