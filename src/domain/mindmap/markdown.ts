import { createMindMapNode } from './nodeModel'

export function parseMarkdownToMindMapData(markdown: string) {
  const lines = String(markdown || '').split('\n').filter(line => line.trim())
  if (!lines.length) return createMindMapNode('中心主题', 0)

  const root = createMindMapNode('导入的导图', 0)
  const stack = [{ level: -1, node: root }]

  for (const line of lines) {
    const headerMatch = line.match(/^(#+)\s+(.*)/)
    const listMatch = line.match(/^(\s*)([-*])\s+(.*)/)

    let level = 0
    let title = ''

    if (headerMatch) {
      level = headerMatch[1].length
      title = headerMatch[2].trim()
    } else if (listMatch) {
      level = Math.floor(listMatch[1].length / 2) + 1
      title = listMatch[3].trim()
    } else {
      continue
    }

    const node = createMindMapNode(title, 0)

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].node
    if (!parent.children) parent.children = []
    parent.children.push(node)

    stack.push({ level, node })
  }

  if (root.children?.length === 1) {
    return root.children[0]
  }
  return root
}
