<template>
  <div class="modern-tree">    <!-- Header Section -->
    <div class="tree-header">
      <div class="header-content">
        <div class="header-title">
          <v-avatar size="32" color="primary" class="me-3">
            <v-icon icon="mdi-file-tree" size="20" color="white" />
          </v-avatar>
          <div class="title-content">
            <h3 class="text-h5 font-weight-medium mb-0">Project Explorer</h3>
            <p class="text-caption text-medium-emphasis mb-0">Interactive file system visualization</p>
          </div>
        </div>
        <div class="header-actions">
          <v-btn
            prepend-icon="mdi-plus-circle"
            size="small"
            variant="tonal"
            color="primary"
            class="me-2"
            @click="addNewRootNode"
          >
            Add Root
            <v-tooltip activator="parent" location="bottom">Add New Root Node</v-tooltip>
          </v-btn>
          <v-btn
            :icon="'mdi-refresh'"
            size="small"
            variant="tonal"
            color="secondary"
            class="me-2"
            @click="refreshTree"
          >
            <v-icon>mdi-refresh</v-icon>
            <v-tooltip activator="parent" location="bottom">Refresh & Collapse All</v-tooltip>
          </v-btn>
          <v-btn
            :icon="viewMode === 'compact' ? 'mdi-view-comfy' : 'mdi-view-compact'"
            size="small"
            variant="tonal"
            color="info"
            @click="toggleViewMode"
          >
            <v-icon>{{ viewMode === 'compact' ? 'mdi-view-comfy' : 'mdi-view-compact' }}</v-icon>
            <v-tooltip activator="parent" location="bottom">
              {{ viewMode === 'compact' ? 'Expanded View' : 'Compact View' }}
            </v-tooltip>
          </v-btn>
        </div>
      </div>
      
      <!-- Enhanced Search Bar -->
      <div class="search-section mt-4">
        <v-text-field
          v-model="searchQuery"
          placeholder="Search files, folders, and project items..."
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          class="search-field"
        >
          <template #append-inner>
            <v-chip
              v-if="searchQuery"
              size="x-small"
              variant="tonal"
              color="primary"
              class="search-results-chip"
            >
              {{ filteredTreeData.length }} results
            </v-chip>
          </template>
        </v-text-field>
      </div>
    </div>

    <!-- Tree Container -->
    <div class="tree-container" :class="{ compact: viewMode === 'compact' }">      <div v-if="filteredTreeData.length === 0" class="empty-state">
        <v-avatar size="80" color="grey-lighten-4">
          <v-icon icon="mdi-folder-search-outline" size="40" color="grey-lighten-1" />
        </v-avatar>
        <h4 class="text-h6 text-grey-darken-1 mt-4 mb-2">No items found</h4>
        <p class="text-body-2 text-grey-darken-1 mb-4">
          {{ searchQuery ? 'Try adjusting your search terms' : 'Add some nodes to get started' }}
        </p>
        <v-btn
          v-if="!searchQuery"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-plus"
          @click="addNewRootNode"
        >
          Add First Node
        </v-btn>
      </div>
      
      <TreeNodeSimple 
        v-for="node in filteredTreeData" 
        :key="node.id"
        :node="node"
        :level="0"
        :view-mode="viewMode"
        :search-query="searchQuery"
        @node-select="handleNodeSelect"
        @node-toggle="handleNodeToggle"
        @node-add="handleNodeAdd"
        @node-delete="handleNodeDelete"
      />
    </div>
      <!-- Enhanced Selection Info -->
    <div v-if="selectedNode" class="selection-info">
      <div class="selection-content">
        <div class="selection-main">
          <v-avatar 
            size="28" 
            :color="getIconColor(selectedNode)"
            class="me-3"
          >
            <v-icon 
              :icon="`mdi-${selectedNode.icon}`" 
              size="16" 
              color="white"
            />
          </v-avatar>
          <div class="selection-details">
            <span class="selection-text">{{ selectedNode.text }}</span>
            <div class="selection-meta">
              <v-chip
                v-if="selectedNode.children"
                :color="selectedNode.expanded ? 'success' : 'info'"
                size="x-small"
                variant="flat"
                class="me-2"
              >
                <v-icon :icon="selectedNode.expanded ? 'mdi-folder-open' : 'mdi-folder'" size="12" class="me-1" />
                {{ selectedNode.children.length }} item{{ selectedNode.children.length !== 1 ? 's' : '' }}
              </v-chip>
              <v-chip
                v-if="selectedNode.type"
                size="x-small"
                variant="tonal"
                :color="getIconColor(selectedNode)"
              >
                {{ selectedNode.type.toUpperCase() }}
              </v-chip>
            </div>
          </div>
        </div>
        <div class="selection-actions">
          <v-btn
            v-if="selectedNode.children"
            :icon="selectedNode.expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            size="small"
            variant="tonal"
            color="primary"
            @click="handleNodeToggle(selectedNode)"
          />
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="selectedNode = null"
          />
        </div>
      </div>
    </div>

    <!-- Statistics Dashboard -->
    <div class="stats-dashboard">
      <v-row no-gutters>
        <v-col cols="3">
          <div class="stat-card primary">
            <div class="stat-icon">
              <v-icon icon="mdi-file-tree" size="20" />
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ totalNodes }}</div>
              <div class="stat-label">Total</div>
            </div>
          </div>
        </v-col>
        <v-col cols="3">
          <div class="stat-card success">
            <div class="stat-icon">
              <v-icon icon="mdi-folder-open" size="20" />
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ expandedNodes }}</div>
              <div class="stat-label">Expanded</div>
            </div>
          </div>
        </v-col>
        <v-col cols="3">
          <div class="stat-card info">
            <div class="stat-icon">
              <v-icon icon="mdi-file-document" size="20" />
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ leafNodes }}</div>
              <div class="stat-label">Files</div>
            </div>
          </div>
        </v-col>
        <v-col cols="3">
          <div class="stat-card warning">
            <div class="stat-icon">
              <v-icon icon="mdi-folder" size="20" />
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ folderNodes }}</div>
              <div class="stat-label">Folders</div>
            </div>
          </div>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup>
const selectedNode = ref(null)
const searchQuery = ref('')
const viewMode = ref('normal') // 'normal' or 'compact'

const treeData = ref([
  {
    id: '1',
    text: 'Frontend Projects',
    icon: 'folder-multiple',
    expanded: true,
    children: [
      {
        id: '1-1',
        text: 'Web Applications',
        icon: 'web',
        expanded: false,
        children: [
          { id: '1-1-1', text: 'React Dashboard', icon: 'react', type: 'react' },
          { id: '1-1-2', text: 'Vue Portfolio', icon: 'vuejs', type: 'vue' },
          { id: '1-1-3', text: 'Angular CRM', icon: 'angular', type: 'angular' },
          { id: '1-1-4', text: 'Nuxt Blog', icon: 'nuxt', type: 'nuxt' }
        ]
      },
      {
        id: '1-2',
        text: 'Mobile Applications',
        icon: 'cellphone',
        expanded: false,
        children: [
          { id: '1-2-1', text: 'iOS Shopping App', icon: 'apple', type: 'ios' },
          { id: '1-2-2', text: 'Android Weather', icon: 'android', type: 'android' },
          { id: '1-2-3', text: 'Flutter Finance', icon: 'flutter', type: 'flutter' }
        ]
      },
      { id: '1-3', text: 'Desktop Electron', icon: 'electron-framework', type: 'electron' }
    ]
  },
  {
    id: '2',
    text: 'Backend Services',
    icon: 'server',
    expanded: false,
    children: [
      { id: '2-1', text: 'Node.js API', icon: 'nodejs', type: 'nodejs' },
      { id: '2-2', text: 'Python FastAPI', icon: 'language-python', type: 'python' },
      { id: '2-3', text: 'Go Microservice', icon: 'language-go', type: 'go' },
      { id: '2-4', text: 'Rust WebService', icon: 'language-rust', type: 'rust' }
    ]
  },
  {
    id: '3',
    text: 'Documentation',
    icon: 'book-open-variant',
    expanded: false,
    children: [
      { id: '3-1', text: 'README.md', icon: 'markdown', type: 'markdown' },
      { id: '3-2', text: 'API Documentation', icon: 'api', type: 'api' },
      { id: '3-3', text: 'User Guide', icon: 'account-question', type: 'guide' },
      { id: '3-4', text: 'CHANGELOG.md', icon: 'history', type: 'changelog' }
    ]
  },
  {
    id: '4',
    text: 'DevOps & Config',
    icon: 'cog-outline',
    expanded: false,
    children: [
      { id: '4-1', text: 'Docker Compose', icon: 'docker', type: 'docker' },
      { id: '4-2', text: 'Kubernetes Manifests', icon: 'kubernetes', type: 'k8s' },
      { id: '4-3', text: 'CI/CD Pipeline', icon: 'pipe', type: 'cicd' },
      { id: '4-4', text: 'Environment Config', icon: 'file-cog', type: 'config' }
    ]
  },
  {
    id: '5',
    text: 'Database Backup.sql',
    icon: 'database',
    type: 'database'
  }
])

// Computed properties for statistics
const totalNodes = computed(() => {
  const countNodes = (nodes) => {
    let count = 0
    for (const node of nodes) {
      count++
      if (node.children) {
        count += countNodes(node.children)
      }
    }
    return count
  }
  return countNodes(treeData.value)
})

const expandedNodes = computed(() => {
  const countExpanded = (nodes) => {
    let count = 0
    for (const node of nodes) {
      if (node.expanded) count++
      if (node.children) {
        count += countExpanded(node.children)
      }
    }
    return count
  }
  return countExpanded(treeData.value)
})

const leafNodes = computed(() => {
  const countLeaves = (nodes) => {
    let count = 0
    for (const node of nodes) {
      if (!node.children || node.children.length === 0) {
        count++
      } else {
        count += countLeaves(node.children)
      }
    }
    return count
  }
  return countLeaves(treeData.value)
})

const folderNodes = computed(() => {
  const countFolders = (nodes) => {
    let count = 0
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        count++
        count += countFolders(node.children)
      }
    }
    return count
  }
  return countFolders(treeData.value)
})

// Filtered tree data based on search
const filteredTreeData = computed(() => {
  if (!searchQuery.value) return treeData.value
  
  const filterNodes = (nodes) => {
    return nodes.filter(node => {
      const matchesSearch = node.text.toLowerCase().includes(searchQuery.value.toLowerCase())
      const hasMatchingChildren = node.children ? filterNodes(node.children).length > 0 : false
      
      if (matchesSearch || hasMatchingChildren) {
        if (node.children) {
          node.children = filterNodes(node.children)
          if (hasMatchingChildren) node.expanded = true
        }
        return true
      }
      return false
    })
  }
  
  return filterNodes(JSON.parse(JSON.stringify(treeData.value)))
})

const getIconColor = (node) => {
  const colorMap = {
    'react': 'light-blue',
    'vue': 'green',
    'angular': 'red',
    'nuxt': 'green-darken-2',
    'nodejs': 'green-darken-3',
    'python': 'yellow-darken-2',
    'go': 'cyan',
    'rust': 'orange-darken-2',
    'docker': 'blue',
    'kubernetes': 'blue-darken-2',
    'database': 'indigo',
    'ios': 'grey-darken-2',
    'android': 'green-accent-4',
    'flutter': 'blue-accent-2',
    'electron': 'purple',
    'markdown': 'blue-grey',
    'api': 'orange',
    'config': 'brown'
  }
  return colorMap[node.type] || 'primary'
}

const handleNodeSelect = (node) => {
  selectedNode.value = node
  console.log('Selected node:', node)
}

const handleNodeToggle = (node) => {
  node.expanded = !node.expanded
  console.log('Toggled node:', node.text, 'expanded:', node.expanded)
}

const handleNodeAdd = (parentNode) => {
  const nodeTypes = ['file-document', 'folder', 'code-tags', 'database', 'web']
  const randomType = nodeTypes[Math.floor(Math.random() * nodeTypes.length)]
  
  const newNode = {
    id: `new-${Date.now()}`,
    text: `New ${randomType === 'folder' ? 'Folder' : 'File'} ${Date.now()}`,
    icon: randomType,
    type: randomType
  }
  
  if (!parentNode.children) {
    parentNode.children = []
  }
  parentNode.children.push(newNode)
  parentNode.expanded = true
  
  console.log('Added node to:', parentNode.text)
}

const handleNodeDelete = (nodeToDelete, parentNodes = treeData.value) => {
  const deleteFromArray = (nodes) => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeToDelete.id) {
        nodes.splice(i, 1)
        return true
      }
      if (nodes[i].children && deleteFromArray(nodes[i].children)) {
        return true
      }
    }
    return false
  }
  
  deleteFromArray(parentNodes)
  if (selectedNode.value?.id === nodeToDelete.id) {
    selectedNode.value = null
  }
  console.log('Deleted node:', nodeToDelete.text)
}

const addNewRootNode = () => {
  const newNode = {
    id: `root-${Date.now()}`,
    text: `New Project ${treeData.value.length + 1}`,
    icon: 'folder-star',
    expanded: false,
    children: [],
    type: 'project'
  }
  treeData.value.push(newNode)
}

const refreshTree = () => {
  const collapseAll = (nodes) => {
    nodes.forEach(node => {
      node.expanded = false
      if (node.children) {
        collapseAll(node.children)
      }
    })
  }
  
  collapseAll(treeData.value)
  selectedNode.value = null
  searchQuery.value = ''
  console.log('Tree refreshed')
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'normal' ? 'compact' : 'normal'
}
</script>

<style scoped>
.modern-tree {
  max-width: 100%;
  background: linear-gradient(135deg, 
    rgba(var(--v-theme-surface), 0.95) 0%, 
    rgba(var(--v-theme-surface-variant), 0.9) 50%,
    rgba(var(--v-theme-surface), 0.95) 100%
  );
  border-radius: 20px;
  padding: 28px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(var(--v-theme-outline), 0.15);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.modern-tree::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 50%, rgba(var(--v-theme-primary), 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(var(--v-theme-secondary), 0.05) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.modern-tree > * {
  position: relative;
  z-index: 1;
}

.tree-header {
  margin-bottom: 28px;
  position: relative;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.header-title {
  display: flex;
  align-items: center;
}

.header-title h3 {
  background: linear-gradient(135deg, 
    rgb(var(--v-theme-primary)), 
    rgb(var(--v-theme-secondary)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.title-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--v-theme-surface-variant), 0.5);
  padding: 8px;
  border-radius: 12px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.search-section {
  margin-top: 20px;
  position: relative;
}

.search-field {
  background: rgba(var(--v-theme-surface), 0.8);
  border-radius: 16px;
  backdrop-filter: blur(8px);
}

.search-field :deep(.v-field) {
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(var(--v-theme-outline), 0.15);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.search-field :deep(.v-field):hover {
  box-shadow: 
    0 6px 20px rgba(var(--v-theme-primary), 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.search-field :deep(.v-field--focused) {
  box-shadow: 
    0 8px 25px rgba(var(--v-theme-primary), 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-color: rgb(var(--v-theme-primary));
}

.tree-container {
  background: rgba(var(--v-theme-surface), 0.7);
  border-radius: 16px;
  padding: 24px;
  min-height: 400px;
  max-height: 550px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-theme-outline), 0.08);
  box-shadow: 
    inset 0 4px 12px rgba(0, 0, 0, 0.05),
    0 2px 8px rgba(0, 0, 0, 0.03);
  position: relative;
  animation: containerSlideIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
}

@keyframes containerSlideIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.tree-container.compact {
  padding: 16px;
  min-height: 280px;
}

.tree-container::-webkit-scrollbar {
  width: 10px;
}

.tree-container::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-surface-variant), 0.2);
  border-radius: 8px;
  margin: 4px;
}

.tree-container::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, 
    rgba(var(--v-theme-primary), 0.4),
    rgba(var(--v-theme-secondary), 0.3)
  );
  border-radius: 8px;
  border: 2px solid rgba(var(--v-theme-surface), 0.5);
}

.tree-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, 
    rgba(var(--v-theme-primary), 0.6),
    rgba(var(--v-theme-secondary), 0.5)
  );
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 280px;
  opacity: 0.8;
  padding: 40px;
  text-align: center;
}

.selection-info {
  margin-top: 24px;
  background: linear-gradient(135deg, 
    rgba(var(--v-theme-primary-container), 0.8), 
    rgba(var(--v-theme-secondary-container), 0.6));
  border-radius: 16px;
  padding: 20px;
  border-left: 4px solid rgb(var(--v-theme-primary));
  box-shadow: 
    0 6px 20px rgba(var(--v-theme-primary), 0.15),
    0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideInUp 0.4s ease-out;
  backdrop-filter: blur(8px);
}

.selection-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selection-main {
  display: flex;
  align-items: flex-start;
  flex-grow: 1;
}

.selection-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex-grow: 1;
}

.selection-text {
  font-weight: 600;
  font-size: 1rem;
  color: rgb(var(--v-theme-on-primary-container));
  margin-bottom: 8px;
  display: block;
}

.selection-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selection-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stats-dashboard {
  margin-top: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  margin: 0 4px;
  position: relative;
  overflow: hidden;
  animation: statCardLoad 0.6s ease-out;
  animation-fill-mode: both;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.stat-card.primary {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1)));
  color: rgb(var(--v-theme-on-primary));
}

.stat-card.success {
  background: linear-gradient(135deg, rgb(var(--v-theme-success)), rgb(var(--v-theme-success-darken-1)));
  color: rgb(var(--v-theme-on-success));
}

.stat-card.info {
  background: linear-gradient(135deg, rgb(var(--v-theme-info)), rgb(var(--v-theme-info-darken-1)));
  color: rgb(var(--v-theme-on-info));
}

.stat-card.warning {
  background: linear-gradient(135deg, rgb(var(--v-theme-warning)), rgb(var(--v-theme-warning-darken-1)));
  color: rgb(var(--v-theme-on-warning));
}

.stat-icon {
  margin-right: 12px;
  opacity: 0.9;
}

.stat-content {
  flex-grow: 1;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.9;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes statCardLoad {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Animation delays */
.stat-card:nth-child(1) { animation-delay: 0.1s; }
.stat-card:nth-child(2) { animation-delay: 0.2s; }
.stat-card:nth-child(3) { animation-delay: 0.3s; }
.stat-card:nth-child(4) { animation-delay: 0.4s; }

/* Responsive design */
@media (max-width: 768px) {
  .modern-tree {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    gap: 16px;
  }
  
  .tree-container {
    padding: 16px;
    min-height: 300px;
  }
  
  .stat-card {
    margin: 2px 0;
    padding: 12px;
  }
  
  .stat-number {
    font-size: 1.25rem;
  }
}

/* Dark mode enhancements */
@media (prefers-color-scheme: dark) {
  .modern-tree {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .tree-container {
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  .stat-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}
</style>
