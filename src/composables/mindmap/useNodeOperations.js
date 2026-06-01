import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { createNode } from './useNodeModel'

export function useNodeOperations({ rootData, selectedNodeId, pushUndo, recalc, startEdit }) {
  
  function findNode(id, root = rootData.value) {
    if (root.id === id) return root
    if (!root.children) return null
    for (const child of root.children) {
      const found = findNode(id, child)
      if (found) return found
    }
    return null
  }

  function findParent(id, root = rootData.value) {
    if (!root.children) return null
    for (const child of root.children) {
      if (child.id === id) return root
      const found = findParent(id, child)
      if (found) return found
    }
    return null
  }

  function addChildNode(parent) {
    pushUndo()
    const child = createNode('新节点', parent._level + 1)
    if (!parent.children) parent.children = []
    parent.children.push(child)
    recalc()
    selectedNodeId.value = child.id
    if (startEdit) nextTick(() => startEdit(child))
  }

  function addSiblingNode(node) {
    if (node === rootData.value) return
    const parent = findParent(node.id)
    if (!parent) return
    pushUndo()
    const idx = parent.children.findIndex(c => c.id === node.id)
    const sibling = createNode('新节点', node._level)
    parent.children.splice(idx + 1, 0, sibling)
    recalc()
    selectedNodeId.value = sibling.id
    if (startEdit) nextTick(() => startEdit(sibling))
  }

  function deleteNode(node) {
    if (node === rootData.value) return ElMessage.warning('不能删除根节点')
    pushUndo()
    const parent = findParent(node.id)
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === node.id)
      if (idx > -1) parent.children.splice(idx, 1)
    }
    selectedNodeId.value = null
    recalc()
  }

  function toggleCollapse(node) {
    pushUndo()
    node.collapsed = !node.collapsed
    recalc()
  }

  return {
    findNode,
    findParent,
    addChildNode,
    addSiblingNode,
    deleteNode,
    toggleCollapse
  }
}