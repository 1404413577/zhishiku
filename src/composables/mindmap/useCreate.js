/**
 * 思维导图新建功能
 */
import { createNode } from './useNodeModel'

export function useCreate() {
  /**
   * 创建新的空白思维导图（只包含一个中心主题）
   */
  function createNewMindMap() {
    // 不再返回 createSampleData()，而是创建一个干净的根节点
    return createNode('中心主题', 0)
  }

  /**
   * 居中显示画布的数值
   */
  function getCenterViewport() {
    return {
      zoom: 1,
      panX: 40,
      panY: 40,
    }
  }

  return {
    createNewMindMap,
    getCenterViewport,
  }
}