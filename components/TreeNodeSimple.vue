<template>
  <div class="tree-node-wrapper">
    <div 
      class="tree-node"
      :class="{
        'selected': isSelected,
        'has-children': hasChildren,
        'expanded': node.expanded,
        'level-0': level === 0,
        'level-1': level === 1,
        'level-2': level === 2,
        'level-deep': level > 2
      }"
      :style="{ 
        paddingLeft: `${level * 20 + 12}px`,
        '--node-level': level
      }"
      @click="handleClick"
    >
      <!-- Connection Lines -->
      <div v-if="level > 0" class="connection-line" />
      <!-- Expand/Collapse Icon -->
      <div class="expand-container">
        <v-btn
          v-if="hasChildren"
          :icon="node.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline'"
          size="x-small"
          variant="flat"
          :color="node.expanded ? 'success' : 'primary'"
          class="expand-btn"
          :class="{ 'expanded': node.expanded }"
          @click.stop="toggleExpand"
        >
          <v-icon>{{ node.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}</v-icon>
        </v-btn>
        <div v-else class="expand-spacer">
          <v-icon 
            :icon="getFileTypeIcon" 
            size="14" 
            :color="getIconColor"
            class="leaf-indicator" 
          />
        </div>
      </div>      <!-- Node Icon with Enhanced Visual Indicators -->
      <div class="node-icon-container" :class="{ 'selected': isSelected }">
        <div class="icon-backdrop" />
        <div class="icon-glow" :style="{ '--glow-color': getGlowColor }" />
        <v-avatar
          :size="hasChildren ? 24 : 20"
          :color="isSelected ? 'primary' : 'transparent'"
          class="node-avatar"
        >
          <v-icon
            :icon="getNodeIcon"
            :size="hasChildren ? 18 : 16"
            class="node-icon"
            :color="isSelected ? 'white' : getIconColor"
          />
        </v-avatar>
        
        <!-- Status Indicators -->
        <div v-if="hasChildren" class="folder-status-indicator">
          <v-icon 
            :icon="node.expanded ? 'mdi-chevron-down' : 'mdi-chevron-right'" 
            size="10" 
            :color="node.expanded ? 'success' : 'primary'"
            class="status-chevron"
          />
        </div>
        
        <!-- File Extension Badge for Files -->
        <div v-if="!hasChildren && node.type" class="file-extension-badge">
          <span class="extension-text">{{ getFileExtension }}</span>
        </div>
      </div>

      <!-- Node Text with Enhanced Typography -->
      <div class="node-content">
        <span
          class="node-text"
          :class="{ 
            'text-primary font-weight-medium': isSelected,
            'folder-text': hasChildren,
            'file-text': !hasChildren
          }"
        >
          {{ node.text }}
        </span>
        
        <!-- Enhanced Status badges -->
        <div class="node-badges">
          <v-chip
            v-if="hasChildren && node.expanded"
            size="x-small"
            variant="flat"
            color="success"
            class="count-badge animate-pulse"
          >
            <v-icon icon="mdi-folder-open" size="10" class="me-1" />
            {{ node.children.length }}
          </v-chip>
          <v-chip
            v-if="node.type && !hasChildren"
            size="x-small"
            variant="tonal"
            :color="getTypeColor(node.type)"
            class="type-badge"
          >
            {{ node.type.charAt(0).toUpperCase() + node.type.slice(1) }}
          </v-chip>
          <v-chip
            v-if="isSelected"
            size="x-small"
            variant="flat"
            color="primary"
            class="selected-badge pulse"
          >
            <v-icon icon="mdi-check-circle" size="10" />
          </v-chip>
        </div>
      </div>

      <!-- Enhanced Node Actions with Tooltips -->
      <div class="node-actions" :class="{ 'visible': isSelected }">
        <v-btn
          v-if="hasChildren"
          icon="mdi-folder-plus"
          size="x-small"
          variant="tonal"
          color="success"
          class="action-btn add-btn"
          @click.stop="addChild"
        >
          <v-icon>mdi-folder-plus</v-icon>
          <v-tooltip activator="parent" location="top" text="Add Child Node" />
        </v-btn>
        
        <v-btn
          icon="mdi-pencil-outline"
          size="x-small"
          variant="tonal"
          color="info"
          class="action-btn edit-btn"
          @click.stop="editNode"
        >
          <v-icon>mdi-pencil-outline</v-icon>
          <v-tooltip activator="parent" location="top" text="Edit Node" />
        </v-btn>
        
        <v-btn
          icon="mdi-trash-can-outline"
          size="x-small"
          variant="tonal"
          color="error"
          class="action-btn delete-btn"
          @click.stop="deleteNode"
        >
          <v-icon>mdi-trash-can-outline</v-icon>
          <v-tooltip activator="parent" location="top" text="Delete Node" />
        </v-btn>
      </div>
    </div>

    <!-- Enhanced Children Container with Animation -->
    <div v-if="hasChildren && node.expanded" class="children-container">
      <div class="children-wrapper">
        <TreeNodeSimple
          v-for="(child, index) in node.children"
          :key="child.id"
          :node="child"
          :level="level + 1"
          :selected-node="selectedNode"
          :style="{ '--child-index': index }"
          class="child-node"
          @node-select="$emit('node-select', $event)"
          @node-toggle="$emit('node-toggle', $event)"
          @node-add="$emit('node-add', $event)"
          @node-delete="$emit('node-delete', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  level: {
    type: Number,
    default: 0
  },
  selectedNode: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['node-select', 'node-toggle', 'node-add', 'node-delete'])

const hasChildren = computed(() => 
  props.node.children && props.node.children.length > 0
)

const isSelected = computed(() => 
  props.selectedNode && props.selectedNode.id === props.node.id
)

const getNodeIcon = computed(() => {
  if (props.node.icon) {
    return `mdi-${props.node.icon}`
  }
  if (hasChildren.value) {
    return props.node.expanded ? 'mdi-folder-open' : 'mdi-folder'
  }
  return 'mdi-file-document'
})

const getIconColor = computed(() => {
  if (props.node.icon) {
    // Return specific colors for different file types
    const iconColors = {
      'react': 'info',
      'vuejs': 'success',
      'angular': 'error',
      'nodejs': 'success',
      'database': 'warning',
      'apple': 'grey-darken-2',
      'android': 'success',
      'folder-multiple': 'orange',
      'web': 'blue',
      'cellphone': 'purple',
      'server': 'green',
      'book-open-variant': 'teal',
      'cog-outline': 'grey',
      'nuxt': 'green-darken-2',
      'flutter': 'blue-accent-2',
      'electron-framework': 'purple',
      'language-python': 'yellow-darken-2',
      'language-go': 'cyan',
      'language-rust': 'orange-darken-2',
      'docker': 'blue',
      'kubernetes': 'blue-darken-2',
      'markdown': 'blue-grey',
      'api': 'orange',
      'account-question': 'green',
      'history': 'purple',
      'pipe': 'indigo',
      'file-cog': 'brown'
    }
    return iconColors[props.node.icon] || 'grey-darken-1'
  }
  return hasChildren.value ? 'warning' : 'grey-darken-1'
})

const getGlowColor = computed(() => {
  const color = getIconColor.value
  const glowColors = {
    'info': '#2196F3',
    'success': '#4CAF50',
    'error': '#F44336',
    'warning': '#FF9800',
    'orange': '#FF5722',
    'purple': '#9C27B0',
    'blue': '#2196F3',
    'green': '#4CAF50',
    'teal': '#009688',
    'cyan': '#00BCD4',
    'indigo': '#3F51B5',
    'brown': '#795548'
  }
  return glowColors[color] || '#6B7280'
})

const getFileTypeIcon = computed(() => {
  if (!props.node.type) return 'mdi-file-outline'
  
  const fileTypeIcons = {
    'react': 'mdi-react',
    'vue': 'mdi-vuejs',
    'angular': 'mdi-angular',
    'nuxt': 'mdi-nuxt',
    'nodejs': 'mdi-nodejs',
    'python': 'mdi-language-python',
    'go': 'mdi-language-go',
    'rust': 'mdi-language-rust',
    'docker': 'mdi-docker',
    'k8s': 'mdi-kubernetes',
    'kubernetes': 'mdi-kubernetes',
    'database': 'mdi-database',
    'ios': 'mdi-apple',
    'android': 'mdi-android',
    'flutter': 'mdi-flutter',
    'electron': 'mdi-electron-framework',
    'markdown': 'mdi-language-markdown',
    'api': 'mdi-api',
    'config': 'mdi-cog',
    'project': 'mdi-folder-star',
    'guide': 'mdi-book-open-page-variant',
    'changelog': 'mdi-format-list-numbered',
    'cicd': 'mdi-pipe',
    'javascript': 'mdi-language-javascript',
    'typescript': 'mdi-language-typescript',
    'css': 'mdi-language-css3',
    'html': 'mdi-language-html5',
    'json': 'mdi-code-json',
    'xml': 'mdi-xml',
    'yaml': 'mdi-file-code',
    'sql': 'mdi-database-search'
  }
    return fileTypeIcons[props.node.type] || 'mdi-file-document-outline'
})

const getFileExtension = computed(() => {
  if (!props.node.type) return ''
  
  const extensions = {
    'react': 'JSX',
    'vue': 'VUE',
    'angular': 'TS',
    'nuxt': 'VUE',
    'nodejs': 'JS',
    'python': 'PY',
    'go': 'GO',
    'rust': 'RS',
    'docker': 'YML',
    'k8s': 'YML',
    'kubernetes': 'YML',
    'database': 'SQL',
    'markdown': 'MD',
    'api': 'JSON',
    'config': 'CFG',
    'javascript': 'JS',
    'typescript': 'TS',
    'css': 'CSS',
    'html': 'HTML',
    'json': 'JSON',
    'xml': 'XML',
    'yaml': 'YML',
    'sql': 'SQL'
  }
  
  return extensions[props.node.type] || 'FILE'
})

const getTypeColor = (type) => {
  const colorMap = {
    'react': 'light-blue',
    'vue': 'green',
    'angular': 'red',
    'nuxt': 'green',
    'nodejs': 'green',
    'python': 'yellow',
    'go': 'cyan',
    'rust': 'orange',
    'docker': 'blue',
    'k8s': 'blue',
    'database': 'indigo',
    'ios': 'grey',
    'android': 'green',
    'flutter': 'blue',
    'electron': 'purple',
    'markdown': 'blue-grey',
    'api': 'orange',
    'config': 'brown',
    'project': 'primary',
    'guide': 'teal',
    'changelog': 'purple',
    'cicd': 'indigo'  }
  return colorMap[type] || 'grey'
}

const handleClick = () => {
  emit('node-select', props.node)
}

const toggleExpand = () => {
  if (hasChildren.value) {
    emit('node-toggle', props.node)
  }
}

const addChild = () => {
  emit('node-add', props.node)
}

const editNode = () => {
  // You can implement edit functionality here
  console.log('Edit node:', props.node.text)
  // emit('node-edit', props.node) // If you want to handle this in parent
}

const deleteNode = () => {
  emit('node-delete', props.node)
}
</script>

<style scoped>
.tree-node-wrapper {
  width: 100%;
  position: relative;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 44px;
  user-select: none;
  margin-bottom: 4px;
  position: relative;
  backdrop-filter: blur(8px);
}

/* Level-based styling */
.tree-node.level-0 {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.05), rgba(var(--v-theme-secondary), 0.05));
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  font-weight: 600;
}

.tree-node.level-1 {
  background: linear-gradient(135deg, rgba(var(--v-theme-surface-variant), 0.5), rgba(var(--v-theme-surface), 0.8));
  border-left: 2px solid rgba(var(--v-theme-primary), 0.2);
}

.tree-node.level-2 {
  background: rgba(var(--v-theme-surface), 0.6);
  border-left: 2px solid rgba(var(--v-theme-secondary), 0.3);
}

.tree-node.level-deep {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-left: 2px solid rgba(var(--v-theme-outline), 0.2);
}

.tree-node:hover {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.08), rgba(var(--v-theme-secondary), 0.06));
  transform: translateX(4px) scale(1.02);
  box-shadow: 0 4px 20px rgba(var(--v-theme-primary), 0.15);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.tree-node.selected {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.15), rgba(var(--v-theme-primary-container), 0.8));
  border: 2px solid rgb(var(--v-theme-primary));
  box-shadow: 0 6px 24px rgba(var(--v-theme-primary), 0.25);
  transform: scale(1.03);
}

.tree-node.selected::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-secondary)));
  border-radius: 2px;
}

/* Connection Lines */
.connection-line {
  position: absolute;
  left: calc(var(--node-level) * 20px - 8px);
  top: 0;
  bottom: 50%;
  width: 2px;
  background: linear-gradient(to bottom, 
    rgba(var(--v-theme-primary), 0.3) 0%, 
    rgba(var(--v-theme-primary), 0.1) 100%);
  border-radius: 1px;
}

/* Enhanced Expand Container */
.expand-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  min-width: 32px;
}

.expand-btn {
  transition: all 0.3s ease !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.expand-btn:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

.expand-spacer {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, 
    rgba(var(--v-theme-surface-variant), 0.6) 0%, 
    rgba(var(--v-theme-surface), 0.8) 100%);
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
}

/* Enhanced Node Icon Container */
.node-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  min-width: 32px;
}

.icon-backdrop {
  position: absolute;
  inset: -4px;
  background: radial-gradient(circle, 
    rgba(var(--v-theme-surface), 0.8) 0%, 
    transparent 70%);
  border-radius: 50%;
  z-index: 0;
}

.icon-glow {
  position: absolute;
  inset: -8px;
  background: radial-gradient(circle, 
    rgba(var(--glow-color, 107, 114, 128), 0.2) 0%, 
    transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 0;
}

.node-icon-container.selected .icon-glow {
  opacity: 1;
  animation: iconPulse 2s ease-in-out infinite;
}

.node-avatar {
  z-index: 1;
  transition: all 0.3s ease !important;
  border: 2px solid rgba(var(--v-theme-outline), 0.1) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.node-icon-container:hover .node-avatar {
  transform: scale(1.1) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
}

/* Status Indicators */
.folder-status-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: rgb(var(--v-theme-surface));
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

.file-extension-badge {
  position: absolute;
  bottom: -4px;
  right: -6px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 8px;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: 6px;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(var(--v-theme-primary), 0.4);
  z-index: 2;
}

.extension-text {
  letter-spacing: 0.5px;
}

/* Enhanced Badges */
.node-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.count-badge {
  animation: slideInRight 0.3s ease-out;
  box-shadow: 0 2px 8px rgba(var(--v-theme-success), 0.2);
}

.type-badge {
  font-weight: 600;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.selected-badge {
  animation: bounceIn 0.4s ease-out;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.3);
}

/* Enhanced Node Actions */
.node-actions {
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.tree-node:hover .node-actions,
.node-actions.visible {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  min-width: 28px !important;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  transition: all 0.3s ease;
  backdrop-filter: blur(4px);
}

.action-btn:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.add-btn:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-success), 0.3);
}

.edit-btn:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-info), 0.3);
}

.delete-btn:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-error), 0.3);
}

/* Enhanced Children Container */
.children-container {
  position: relative;
  margin-left: 20px;
  padding-left: 8px;
  animation: expandIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.children-container::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, 
    rgba(var(--v-theme-primary), 0.4), 
    rgba(var(--v-theme-outline), 0.1)
  );
  border-radius: 1px;
}

.children-wrapper {
  position: relative;
}

.child-node {
  animation: slideInLeft 0.3s ease-out;
  animation-delay: calc(var(--child-index) * 0.05s);
  animation-fill-mode: both;
}

/* Animations */
@keyframes pulseGlow {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

@keyframes iconPulse {
  0%, 100% { 
    transform: scale(1);
    opacity: 0.7;
  }
  50% { 
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .tree-node {
    padding: 6px 8px;
    min-height: 40px;
  }
  
  .node-text {
    font-size: 0.85rem;
  }
  
  .action-btn {
    width: 24px;
    height: 24px;
    min-width: 24px !important;
  }
  
  .expand-btn {
    width: 24px;
    height: 24px;
    min-width: 24px !important;
  }
}

/* Dark Mode Enhancements */
@media (prefers-color-scheme: dark) {
  .tree-node:hover {
    box-shadow: 0 4px 20px rgba(var(--v-theme-primary), 0.25);
  }
  
  .tree-node.selected {
    box-shadow: 0 6px 24px rgba(var(--v-theme-primary), 0.35);
  }
  
  .action-btn:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus styles for keyboard navigation */
.tree-node:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.action-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
