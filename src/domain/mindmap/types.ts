export type MindMapNodeStyle = {
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  fontColor?: string
  fontSize?: number
}

export type MindMapNode = {
  id: string
  title: string
  children: MindMapNode[]
  collapsed: boolean
  style: MindMapNodeStyle | null
  note?: string
  _level: number
  _x: number
  _y: number
  _width: number
  _height: number
  _totalHeight: number
}
