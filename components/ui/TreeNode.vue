<template>
  <div class="tree-node-wrapper">
    <div 
      class="tree-node"
      :class="{
        'selected': isSelected,
        'has-children': hasChildren,
        'expanded': node.opened
      }"
      :style="{ paddingLeft: `${level * 20 + 8}px` }"
      @click="handleClick"
    >
      <!-- Expand/Collapse Icon -->
      <v-btn
        v-if="hasChildren"
        :icon="node.opened ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        size="x-small"
        variant="text"
        class="expand-btn me-1"
        @click.stop="toggleExpand"
      />
      <div v-else class="expand-spacer"></div>

      <!-- Node Icon -->
      <v-icon
        :icon="getNodeIcon"
        size="small"
        class="node-icon me-2"
        :color="isSelected ? 'primary' : 'grey-darken-1'"
      />

      <!-- Checkbox for multi-select -->
      <v-checkbox
        v-if="multiSelect"
        :model-value="isSelected"
        density="compact"
        hide-details
        class="me-2"
        @click.stop
        @update:model-value="handleSelect"
      />

      <!-- Node Text -->
      <span class="node-text" :class="{ 'text-primary': isSelected }">
        {{ node.text }}
      </span>

      <!-- Node Actions -->
      <div class="node-actions ms-auto">
        <v-btn
          icon="mdi-dots-vertical"
          size="x-small"
          variant="text"
          class="action-btn"
          @click.stop="showContextMenu"
        />
      </div>
    </div>

    <!-- Children -->
    <div v-if="hasChildren && node.opened" class="children-container">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :selectable="selectable"
        :multi-select="multiSelect"
        :selected-nodes="selectedNodes"
        @node-click="$emit('node-click', $event)"
        @node-expand="$emit('node-expand', $event)"
        @node-collapse="$emit('node-collapse', $event)"
      />
    </div>

    <!-- Context Menu -->
    <v-menu
      v-model="contextMenu"
      :activator="contextMenuActivator"
      location="bottom start"
    >
      <v-list density="compact">
        <v-list-item @click="editNode">
          <template #prepend>
            <v-icon icon="mdi-pencil" size="small" />
          </template>
          <v-list-item-title>Edit</v-list-item-title>
        </v-list-item>
        <v-list-item @click="deleteNode">
          <template #prepend>
            <v-icon icon="mdi-delete" size="small" />
          </template>
          <v-list-item-title>Delete</v-list-item-title>
        </v-list-item>
        <v-list-item v-if="hasChildren" @click="addChild">
          <template #prepend>
            <v-icon icon="mdi-plus" size="small" />
          </template>
          <v-list-item-title>Add Child</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useTreeView'

interface Props {
  node: TreeNode
  level: number
  selectable?: boolean
  multiSelect?: boolean
  selectedNodes?: (string | number)[]
}

const props = withDefaults(defineProps<Props>(), {
  selectable: true,
  multiSelect: false,
  selectedNodes: () => []
})

const emit = defineEmits<{
  'node-click': [node: TreeNode]
  'node-expand': [node: TreeNode]
  'node-collapse': [node: TreeNode]
}>()

const contextMenu = ref(false)
const contextMenuActivator = ref()

const hasChildren = computed(() => 
  props.node.children && props.node.children.length > 0
)

const isSelected = computed(() => 
  props.selectedNodes.includes(props.node.id)
)

const getNodeIcon = computed(() => {
  if (props.node.icon) return `mdi-${props.node.icon}`
  if (hasChildren.value) {
    return props.node.opened ? 'mdi-folder-open' : 'mdi-folder'
  }
  return 'mdi-file-document'
})

const handleClick = () => {
  if (props.selectable) {
    emit('node-click', props.node)
  }
}

const toggleExpand = () => {
  if (hasChildren.value) {
    props.node.opened = !props.node.opened
    if (props.node.opened) {
      emit('node-expand', props.node)
    } else {
      emit('node-collapse', props.node)
    }
  }
}

const handleSelect = (selected: boolean | null) => {
  if (selected) {
    emit('node-click', props.node)
  }
}

const showContextMenu = (event: Event) => {
  contextMenuActivator.value = event.target
  contextMenu.value = true
}

const editNode = () => {
  console.log('Edit node:', props.node)
  contextMenu.value = false
}

const deleteNode = () => {
  console.log('Delete node:', props.node)
  contextMenu.value = false
}

const addChild = () => {
  console.log('Add child to:', props.node)
  contextMenu.value = false
}
</script>

<style scoped>
.tree-node-wrapper {
  width: 100%;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  min-height: 32px;
  user-select: none;
}

.tree-node:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.5);
}

.tree-node.selected {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.expand-btn {
  min-width: 20px !important;
  width: 20px;
  height: 20px;
}

.expand-spacer {
  width: 20px;
  min-width: 20px;
}

.node-icon {
  flex-shrink: 0;
}

.node-text {
  flex-grow: 1;
  font-size: 0.875rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-actions {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tree-node:hover .node-actions {
  opacity: 1;
}

.action-btn {
  min-width: 20px !important;
  width: 20px;
  height: 20px;
}

.children-container {
  border-left: 1px solid rgba(var(--v-theme-outline), 0.2);
  margin-left: 10px;
}

.tree-node.has-children.expanded {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.1);
  margin-bottom: 2px;
}
</style>
