import { parseMarkdownToMindMapData } from '@/domain/mindmap/markdown'

export function useMarkdown() {
  return {
    parseMarkdownToData: parseMarkdownToMindMapData
  }
}
