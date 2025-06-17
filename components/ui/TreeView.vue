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
    </v-card>    <v-card
      class="tree-card"
      :class="{ 'pa-4': !flat }"
      :variant="flat ? 'flat' : 'outlined'"
    >
      <div class="custom-tree">
        <!-- Simple hierarchical tree that actually works -->
        <div v-for="node in treeData" :key="node.id" class="tree-node-simple">          <!-- Root level node -->
          <div 
            class="node-item" 
            style="color: #ffffff; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; align-items: center; font-weight: 500;"
            @click="handleNodeClick(node)"
          >
            <v-btn
              v-if="node.children && node.children.length > 0"
              :icon="node.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              size="x-small"
              variant="text"
              class="me-1"
              style="color: #ffffff;"
              @click.stop="toggleNode(node)"
            />
            <div v-else style="width: 28px;" />
            
            <v-icon
              :icon="node.icon || 'mdi-file'"
              size="small"
              class="me-2"
              style="color: #e0e0e0;"
            />
            <span style="font-weight: 500;">{{ node.text }}</span>
            <span v-if="node.children && node.children.length > 0" class="ms-2" style="font-size: 11px; opacity: 0.8; color: #cccccc;">
              ({{ node.children.length }})
            </span>
          </div>
          <!-- Children (when expanded) -->
          <div v-if="node.children && node.children.length > 0 && node.expanded" class="children-container" style="margin-left: 20px;">
            <div 
              v-for="child in node.children" 
              :key="child.id"
              class="node-item child-item"
              style="color: #f5f5f5; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; display: flex; align-items: center; font-weight: 400;"
              @click="handleNodeClick(child)"
            >
              <v-icon
                :icon="child.icon || 'mdi-file'"
                size="small"
                class="me-2"
                style="color: #d0d0d0;"
              />
              <span style="font-size: 0.9em; font-weight: 400;">{{ child.text }}</span>
            </div>
          </div>
        </div>
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

// Toggle node expansion
const toggleNode = (node: TreeNode) => {
  node.expanded = !node.expanded
  if (node.expanded) {
    emit('nodeExpand', node)
  } else {
    emit('nodeCollapse', node)
  }
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
  color: white;
}

.tree-card {
  min-height: 200px;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.custom-tree {
  font-family: inherit;
  color: white;
  padding: 8px;
}

/* Ensure all text in the tree is visible */
:deep(.tree-node) {
  color: white !important;
}

:deep(.tree-node-wrapper) {
  color: white !important;
}

:deep(.v-card-title) {
  color: white !important;
}

/* Simple tree styling */
.tree-node-simple .node-item:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-radius: 4px;
  color: #ffffff !important;
}

.tree-node-simple .child-item:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 4px;
  color: #ffffff !important;
}
</style>
