import type { MindMapNode } from './types'

type ExportableMindMapNode = Omit<
  MindMapNode,
  '_level' | '_x' | '_y' | '_width' | '_height' | '_totalHeight'
> & {
  children: ExportableMindMapNode[]
}

export function cleanMindMapNodeForExport(node: MindMapNode): ExportableMindMapNode {
  const { _level, _x, _y, _width, _height, _totalHeight, ...rest } = node
  return {
    ...rest,
    children: rest.children ? rest.children.map(cleanMindMapNodeForExport) : [],
  }
}

export function stringifyMindMapJSON(rootData: MindMapNode) {
  return JSON.stringify(cleanMindMapNodeForExport(rootData), null, 2)
}
