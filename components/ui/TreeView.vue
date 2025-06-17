<template>
  <div class="tree-view-container">
    <v-card
      v-if="showHeader"
      class="mb-4"
      variant="outlined"
    >
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="primary">mdi-file-tree</v-icon>
        {{ title }}
        <v-spacer />
        <v-btn
          v-if="allowAdd"
          icon="mdi-plus"
          size="small"
          variant="text"
          @click="addNewNode"
        />
        <v-btn
          v-if="allowRefresh"
          icon="mdi-refresh"
          size="small"
          variant="text"
          @click="refreshTree"
        />
      </v-card-title>
    </v-card>

    <v-card
      class="tree-card"
      :class="{ 'pa-4': !flat }"
      :variant="flat ? 'flat' : 'outlined'"
    >
      <div class="custom-tree">
        <TreeNode 
          v-for="node in treeData" 
          :key="node.id"
          :node="node"
          :level="0"
          :selectable="selectable"
          :multi-select="multiSelect"
          :selected-nodes="selectedNodeIds"
          @node-click="handleNodeClick"
          @node-expand="handleNodeExpand"
          @node-collapse="handleNodeCollapse"
        />
      </div>
    </v-card>

    <!-- Add Node Dialog -->
    <v-dialog v-model="addDialog" max-width="500px">
      <v-card>
        <v-card-title>Add New Node</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newNodeText"
            label="Node Text"
            variant="outlined"
            density="comfortable"
          />
          <v-select
            v-model="newNodeParent"
            :items="parentOptions"
            label="Parent Node"
            item-title="text"
            item-value="id"
            variant="outlined"
            density="comfortable"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey" @click="addDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="confirmAddNode">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useTreeView'

interface Props {
  nodes?: TreeNode[]
  title?: string
  showHeader?: boolean
  allowAdd?: boolean
  allowRefresh?: boolean
  selectable?: boolean
  multiSelect?: boolean
  flat?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nodes: () => [],
  title: 'Tree View',
  showHeader: true,
  allowAdd: true,
  allowRefresh: true,
  selectable: true,
  multiSelect: false,
  flat: false
})

const emit = defineEmits<{
  nodeSelect: [node: TreeNode]
  nodeExpand: [node: TreeNode]
  nodeCollapse: [node: TreeNode]
  nodeAdd: [parentId: string | number, text: string]
  refresh: []
}>()

const { sampleTreeData, selectedNodes, onNodeSelect, onNodeExpand, onNodeCollapse, addNode } = useTreeView()

// Use provided nodes or fallback to sample data
const treeData = computed(() => props.nodes.length > 0 ? props.nodes : sampleTreeData.value)
const selectedNodeIds = computed(() => selectedNodes.value)

// Add node functionality
const addDialog = ref(false)
const newNodeText = ref('')
const newNodeParent = ref<string | number | null>(null)

const parentOptions = computed(() => {
  const getAllNodes = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = []
    for (const node of nodes) {
      result.push(node)
      if (node.children) {
        result = result.concat(getAllNodes(node.children))
      }
    }
    return result
  }
  
  return [
    { id: null, text: 'Root Level' },
    ...getAllNodes(treeData.value)
  ]
})

const addNewNode = () => {
  newNodeText.value = ''
  newNodeParent.value = null
  addDialog.value = true
}

const confirmAddNode = () => {
  if (newNodeText.value.trim()) {
    const newNode: TreeNode = {
      id: Date.now(),
      text: newNodeText.value.trim(),
      icon: 'file'
    }
    
    if (newNodeParent.value) {
      addNode(newNodeParent.value, newNode)
      emit('nodeAdd', newNodeParent.value, newNodeText.value.trim())
    } else {
      // Add to root level
      sampleTreeData.value.push(newNode)
      emit('nodeAdd', 'root', newNodeText.value.trim())
    }
    
    addDialog.value = false
  }
}

const refreshTree = () => {
  emit('refresh')
}

const handleNodeClick = (node: TreeNode) => {
  if (props.selectable) {
    onNodeSelect(node)
    emit('nodeSelect', node)
  }
}

const handleNodeExpand = (node: TreeNode) => {
  onNodeExpand(node)
  emit('nodeExpand', node)
}

const handleNodeCollapse = (node: TreeNode) => {
  onNodeCollapse(node)
  emit('nodeCollapse', node)
}
</script>

<style scoped>
.tree-view-container {
  width: 100%;
}

.tree-card {
  min-height: 200px;
}

.custom-tree {
  font-family: inherit;
}
</style>
