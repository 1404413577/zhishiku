import { AIService } from './ai'

const stripMarkdownFence = (content: string) => {
  return String(content || '')
    .replace(/```markdown\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}

const buildMindMapPrompt = (topic: string) => `你是一个顶级的思维导图架构师。
请根据用户的输入，构建一个逻辑清晰、层级分明、结构严谨的思维导图大纲。
【严格输出规则】：
1. 只能使用 Markdown 的无序列表格式（如：- 主题、  - 子主题）。
2. 不要输出任何问候语、解释性文字、总结性文字。
3. 不要使用 \`\`\`markdown 代码块包裹内容，直接输出纯文本。
4. 层级深度控制在 3~5 级为最佳，内容要精炼，适合做导图节点。

用户需求：${topic}`

export const mindMapService = {
  getRootTitle(topic: string) {
    const text = String(topic || '').trim()
    return text.length > 15 ? `${text.substring(0, 15)}...` : text
  },

  stripMarkdownFence,

  async generateMarkdownOutline(
    topic: string,
    onUpdate: (markdown: string) => void
  ) {
    const prompt = buildMindMapPrompt(topic)
    await AIService.chatCompletion(
      [{ role: 'user', content: prompt }],
      (_delta: string, fullText: string) => {
        const markdown = stripMarkdownFence(fullText)
        if (markdown) onUpdate(markdown)
      }
    )
  }
}
