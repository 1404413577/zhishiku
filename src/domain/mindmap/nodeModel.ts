import type { MindMapNode } from './types'

let idCounter = 0

export function genMindMapNodeId() {
  return `node_${Date.now()}_${idCounter++}`
}

export function createMindMapNode(
  title: string,
  level = 0,
  children: MindMapNode[] = []
): MindMapNode {
  return {
    id: genMindMapNodeId(),
    title,
    children,
    collapsed: false,
    style: null,
    _level: level,
    _x: 0,
    _y: 0,
    _width: 120,
    _height: 38,
    _totalHeight: 38,
  }
}

export function cloneMindMapNode(node: MindMapNode): MindMapNode {
  return {
    ...node,
    id: genMindMapNodeId(),
    children: node.children.map(cloneMindMapNode),
    style: node.style ? { ...node.style } : null,
  }
}

export function createSampleMindMapData() {
  const root = createMindMapNode('思维导图', 0, [
    createMindMapNode('功能介绍', 1, [
      createMindMapNode('节点新增与编辑', 2),
      createMindMapNode('拖拽移动节点', 2),
      createMindMapNode('折叠/展开分支', 2),
      createMindMapNode('多主题切换', 2),
    ]),
    createMindMapNode('视觉样式', 1, [
      createMindMapNode('5 种内置主题', 2),
      createMindMapNode('节点颜色自定义', 2),
      createMindMapNode('字体与边框设置', 2),
      createMindMapNode('美观贝塞尔连线', 2),
    ]),
    createMindMapNode('数据管理', 1, [
      createMindMapNode('本地自动保存', 2),
      createMindMapNode('导出 JSON 格式', 2),
      createMindMapNode('导出 PNG 图片', 2),
    ]),
    createMindMapNode('交互操作', 1, [
      createMindMapNode('画布拖拽平移', 2),
      createMindMapNode('滚轮缩放', 2),
      createMindMapNode('快捷键支持', 2),
    ]),
  ])
  return root
}

export function findMindMapNode(id: string, root: MindMapNode): MindMapNode | null {
  if (root.id === id) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findMindMapNode(id, child)
    if (found) return found
  }
  return null
}

export function findMindMapParent(id: string, root: MindMapNode): MindMapNode | null {
  if (!root.children) return null
  for (const child of root.children) {
    if (child.id === id) return root
    const found = findMindMapParent(id, child)
    if (found) return found
  }
  return null
}

export function collectMindMapNodes(root: MindMapNode) {
  const nodes: MindMapNode[] = []
  function walk(node: MindMapNode) {
    nodes.push(node)
    if (node.children) {
      for (const child of node.children) {
        walk(child)
      }
    }
  }
  walk(root)
  return nodes
}
