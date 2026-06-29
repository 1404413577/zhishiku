/**
 * 思维导图导入导出功能
 */
import { ElMessage } from 'element-plus'
import {
  cleanMindMapNodeForExport,
  stringifyMindMapJSON,
} from '@/domain/mindmap/exportRules'

/**
 * 清理导出节点，删除临时属性
 */
export function cleanNodeForExport(node) {
  return cleanMindMapNodeForExport(node)
}

/**
 * 计算 SVG 的边界框
 */
export function calculateSVGBBox(flatNodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of flatNodes) {
    minX = Math.min(minX, node._x)
    minY = Math.min(minY, node._y)
    maxX = Math.max(maxX, node._x + node._width)
    maxY = Math.max(maxY, node._y + node._height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function exportAsJSON(rootData) {
  try {
    const json = stringifyMindMapJSON(rootData)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `思维导图_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出 JSON 成功')
    return true
  } catch (error) {
    console.error('导出 JSON 失败:', error)
    ElMessage.error('导出失败')
    return false
  }
}

export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        resolve(data)
      } catch (error) {
        ElMessage.error('JSON 格式不正确')
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function exportAsPNG(svgRef, flatNodes, currentTheme) {
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer()
      const svgClone = svgRef.cloneNode(true)

      // 计算 SVG 边界
      const bbox = calculateSVGBBox(flatNodes)
      const width = bbox.width + 200
      const height = bbox.height + 100

      // 设置 SVG 属性
      setSVGAttributes(svgClone, bbox, width, height)
      
      // 添加背景
      addBackgroundToSVG(svgClone, bbox, width, height, currentTheme.bg)

      const svgStr = serializer.serializeToString(svgClone)
      renderSVGToImage(svgStr, currentTheme.bg, width, height, resolve, reject)
    } catch (error) {
      console.error('导出 PNG 失败:', error)
      ElMessage.error('导出失败')
      reject(error)
    }
  })
}

/**
 * 设置 SVG 属性
 */
export function setSVGAttributes(svgClone, bbox, width, height) {
  svgClone.setAttribute('width', width)
  svgClone.setAttribute('height', height)
  svgClone.setAttribute('viewBox', `${bbox.x - 80} ${bbox.y - 60} ${width} ${height}`)
  const g = svgClone.querySelector('g')
  if (g) g.removeAttribute('transform')
}

/**
 * 添加背景到 SVG
 */
export function addBackgroundToSVG(svgClone, bbox, width, height, bgColor) {
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', bbox.x - 80)
  bg.setAttribute('y', bbox.y - 60)
  bg.setAttribute('width', width)
  bg.setAttribute('height', height)
  bg.setAttribute('fill', bgColor)
  svgClone.insertBefore(bg, svgClone.firstChild)
}

/**
 * 将 SVG 渲染为图像
 */
export function renderSVGToImage(svgStr, bgColor, width, height, resolve, reject) {
  const img = new Image()
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    canvas.toBlob((pngBlob) => {
      downloadPNG(pngBlob)
      ElMessage.success('导出 PNG 成功')
      resolve(true)
    }, 'image/png')
  }

  img.onerror = reject
  img.src = url
}

/**
 * 下载 PNG 文件
 */
export function downloadPNG(pngBlob) {
  const pngUrl = URL.createObjectURL(pngBlob)
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = `思维导图_${new Date().toISOString().slice(0, 10)}.png`
  a.click()
  URL.revokeObjectURL(pngUrl)
}
