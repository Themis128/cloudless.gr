export interface TreeNode {
  id: string | number
  text: string
  children?: TreeNode[]
  opened?: boolean
  selected?: boolean
  disabled?: boolean
  icon?: string
  [key: string]: any
}

export const useTreeView = () => {
  const selectedNodes = ref<(string | number)[]>([])
  const expandedNodes = ref<(string | number)[]>([])

  // Sample tree data - you can replace this with your actual data
  const sampleTreeData = ref<TreeNode[]>([
    {
      id: 1,
      text: 'Root Node 1',
      icon: 'folder',
      children: [
        {
          id: 11,
          text: 'Child Node 1.1',
          icon: 'folder',
          children: [
            { id: 111, text: 'Leaf Node 1.1.1', icon: 'file' },
            { id: 112, text: 'Leaf Node 1.1.2', icon: 'file' }
          ]
        },
        { id: 12, text: 'Child Node 1.2', icon: 'file' }
      ]
    },
    {
      id: 2,
      text: 'Root Node 2',
      icon: 'folder',
      children: [
        { id: 21, text: 'Child Node 2.1', icon: 'file' },
        { id: 22, text: 'Child Node 2.2', icon: 'file' }
      ]
    },
    {
      id: 3,
      text: 'Root Node 3',
      icon: 'file'
    }
  ])

  const onNodeSelect = (node: TreeNode) => {
    console.log('Node selected:', node)
    if (!selectedNodes.value.includes(node.id)) {
      selectedNodes.value.push(node.id)
    }
  }

  const onNodeExpand = (node: TreeNode) => {
    console.log('Node expanded:', node)
    if (!expandedNodes.value.includes(node.id)) {
      expandedNodes.value.push(node.id)
    }
  }

  const onNodeCollapse = (node: TreeNode) => {
    console.log('Node collapsed:', node)
    expandedNodes.value = expandedNodes.value.filter(id => id !== node.id)
  }

  const findNodeById = (nodes: TreeNode[], id: string | number): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }
  const addNode = (parentId: string | number, newNode: TreeNode) => {
    const parent = findNodeById(sampleTreeData.value, parentId)
    if (parent) {
      parent.children ??= []
      parent.children.push(newNode)
    }
  }

  const removeNode = (nodeId: string | number) => {
    const removeFromChildren = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) {
          return false
        }
        if (node.children) {
          node.children = removeFromChildren(node.children)
        }
        return true
      })
    }
    
    sampleTreeData.value = removeFromChildren(sampleTreeData.value)
  }

  return {
    sampleTreeData,
    selectedNodes,
    expandedNodes,
    onNodeSelect,
    onNodeExpand,
    onNodeCollapse,
    findNodeById,
    addNode,
    removeNode
  }
}
