import { createNode } from './useNodeModel'

export function useMarkdown() {
  function parseMarkdownToData(mdText) {
    const lines = mdText.split('\n').filter(l => l.trim())
    if (!lines.length) return createNode('中心主题', 0)

    const root = createNode('导入的导图', 0)
    const stack = [{ level: -1, node: root }] // 虚拟根节点

    for (const line of lines) {
      // 匹配 Markdown 标题 (#) 或 无序列表 (-)
      const headerMatch = line.match(/^(#+)\s+(.*)/)
      const listMatch = line.match(/^(\s*)([-*])\s+(.*)/)

      let level = 0
      let title = ''

      if (headerMatch) {
        level = headerMatch[1].length
        title = headerMatch[2].trim()
      } else if (listMatch) {
        // 每 2 个空格算一级缩进
        level = Math.floor(listMatch[1].length / 2) + 1 
        title = listMatch[3].trim()
      } else {
        continue // 忽略纯文本行
      }

      const node = createNode(title, 0) // level 在后续由布局统一计算

      // 回溯栈，找到对应的父节点
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      const parent = stack[stack.length - 1].node
      if (!parent.children) parent.children = []
      parent.children.push(node)
      
      stack.push({ level, node })
    }

    // 如果只有一个顶层 H1，直接用它做根节点，去掉外层的虚拟根
    if (root.children?.length === 1) {
      return root.children[0]
    }
    return root
  }

  return {
    parseMarkdownToData
  }
}