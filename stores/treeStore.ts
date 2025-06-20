import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TreeNode } from '~/composables/useTreeView'

export const useTreeStore = defineStore('tree', () => {
  // The tree data for the sitemap
  const treeData = ref<TreeNode[]>([])

  // Set the tree data (replace all)
  function setTreeData(newData: TreeNode[]) {
    treeData.value = newData
  }

  // Optionally, add a node
  function addNode(parentId: string, node: TreeNode) {
    const findAndAdd = (nodes: TreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.id === parentId) {
          n.children = n.children || []
          n.children.push(node)
          return true
        }
        if (n.children && findAndAdd(n.children)) return true
      }
      return false
    }
    findAndAdd(treeData.value)
  }

  // Optionally, remove a node
  function removeNode(nodeId: string) {
    const findAndRemove = (nodes: TreeNode[]): boolean => {
      const idx = nodes.findIndex(n => n.id === nodeId)
      if (idx !== -1) {
        nodes.splice(idx, 1)
        return true
      }
      for (const n of nodes) {
        if (n.children && findAndRemove(n.children)) return true
      }
      return false
    }
    findAndRemove(treeData.value)
  }

  return { treeData, setTreeData, addNode, removeNode }
})
