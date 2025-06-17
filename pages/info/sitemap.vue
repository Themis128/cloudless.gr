<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" lg="10">
        <v-card class="glass-card pa-6" elevation="0">          <v-card-title class="text-h4 font-weight-bold white--text mb-4">
                                                                  Site Map
                                                                </v-card-title>
          <v-card-text>
            <p class="intro-text mb-6">
              Navigate through the complete structure of Cloudless. Click on any item to visit that page.
            </p>
            
            <!-- Current location indicator -->
            <v-alert
              v-if="currentPath !== '/info/sitemap'"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
              icon="mdi-map-marker"
            >
              <template #text>
                <span class="text-caption">
                  You are currently viewing: <strong>{{ currentPath }}</strong>
                </span>
              </template>
            </v-alert>

            <!-- Loading state -->
            <v-skeleton-loader 
              v-if="!sitemapTreeData.length" 
              type="list-item@5" 
              class="mb-4"
            />            <!-- Tree View with enhanced accessibility -->
            <UiTreeView
              v-else
              title="Cloudless Site Structure"
              role="tree"
              aria-label="Site Navigation Tree"
              :nodes="sitemapTreeData"
              :allow-add="false"
              :show-header="true"
              :flat="false"
              @node-select="onNodeSelect"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useTreeView'

// Use defineAsyncComponent for better SSR performance
// const UiTreeView = defineAsyncComponent(() => import('~/components/ui/TreeView.vue'))

// Temporarily import directly to debug
import UiTreeView from '~/components/ui/TreeView.vue'

definePageMeta({
  title: 'Site Map - Cloudless',
  layout: 'default'
})

// SEO and meta improvements
useHead({
  title: 'Site Map - Cloudless',
  meta: [
    {
      name: 'description',
      content: 'Navigate through the complete structure of Cloudless GR. Interactive sitemap showing all available pages and sections.'
    },
    {
      name: 'keywords',
      content: 'sitemap, navigation, cloudless, site structure, pages'
    },
    {
      property: 'og:title',
      content: 'Site Map - Cloudless GR'
    },
    {
      property: 'og:description',
      content: 'Interactive sitemap for Cloudless GR platform'
    }
  ]
})

// Get current route for active highlighting
const route = useRoute()
const currentPath = computed(() => route.path)

// Helper function to check if a node is active
const isNodeActive = (node: TreeNode): boolean => {
  return node.link === currentPath.value
}

// Helper function to recursively check if any child node is active
const hasActiveChild = (node: TreeNode): boolean => {
  if (isNodeActive(node)) return true
  if (!node.children) return false
  return node.children.some(child => hasActiveChild(child))
}

// Hierarchical sitemap data representing your actual site structure
const sitemapTreeData = ref<TreeNode[]>([
  {
    id: 'home',
    text: 'Home',
    icon: 'mdi-home',
    link: '/',
    children: []
  },
  {
    id: 'auth',
    text: 'Authentication',
    icon: 'mdi-account-key',
    children: [
      {
        id: 'auth-login',
        text: 'Login',
        icon: 'mdi-login',
        link: '/auth',
        children: []
      },
      {
        id: 'auth-register',
        text: 'Register',
        icon: 'mdi-account-plus',
        link: '/auth/register',
        children: []
      },
      {
        id: 'auth-reset',
        text: 'Password Reset',
        icon: 'mdi-lock-reset',
        link: '/auth/reset',
        children: []
      },
      {
        id: 'auth-admin',
        text: 'Admin Login',
        icon: 'mdi-shield-account',
        link: '/auth/admin-login',
        children: []
      },
      {
        id: 'auth-users-nav',
        text: 'User Navigation',
        icon: 'mdi-navigation',
        link: '/auth/users-nav',
        children: []
      }
    ]
  },
  {
    id: 'info',
    text: 'Information Center',
    icon: 'mdi-information',
    link: '/info',
    children: [
      {
        id: 'info-about',
        text: 'About Us',
        icon: 'mdi-information-outline',
        link: '/info/about',
        children: []
      },
      {
        id: 'info-faq',
        text: 'FAQ',
        icon: 'mdi-help-circle-outline',
        link: '/info/faq',
        children: []
      },
      {
        id: 'info-contact',
        text: 'Contact',
        icon: 'mdi-email-outline',
        link: '/info/contact',
        children: []
      },
      {
        id: 'info-matrix',
        text: 'Platform Matrix',
        icon: 'mdi-chart-box-outline',
        link: '/info/matrix',
        children: []
      },
      {
        id: 'info-sitemap',
        text: 'Site Map',
        icon: 'mdi-sitemap-outline',
        link: '/info/sitemap',
        children: []
      }
    ]
  },
  {
    id: 'projects',
    text: 'Projects',
    icon: 'mdi-folder-multiple',
    children: [
      {
        id: 'projects-dashboard',
        text: 'Project Dashboard',
        icon: 'mdi-view-dashboard',
        link: '/projects',
        children: []
      },
      {
        id: 'projects-create',
        text: 'Create Project',
        icon: 'mdi-plus-circle',
        link: '/projects/create',
        children: []
      }
    ]
  },
  {
    id: 'admin',
    text: 'Administration',
    icon: 'mdi-shield-crown',
    children: [
      {
        id: 'admin-dashboard',
        text: 'Admin Dashboard',
        icon: 'mdi-view-dashboard-variant',
        link: '/admin',
        children: []
      },
      {
        id: 'admin-users',
        text: 'User Management',
        icon: 'mdi-account-group',
        link: '/admin/users',
        children: []
      }
    ]
  },
  {
    id: 'user',
    text: 'User Area',
    icon: 'mdi-account',
    children: [
      {        id: 'user-profile',
        text: 'Profile',
        icon: 'mdi-account-circle',
        link: '/users/profile',
        children: []
      },
      {
        id: 'user-settings',
        text: 'Settings',
        icon: 'mdi-cog',
        link: '/settings',
        children: []
      }
    ]
  }
])

const onNodeSelect = (node: TreeNode) => {
  console.log('Node selected in sitemap:', node)
  
  // Add analytics or tracking here if needed
  if (process.client) {
    // Track navigation event
    console.log(`User navigating from ${currentPath.value} to ${node.link}`)
  }
  
  if (node.link) {
    console.log(`Navigating to: ${node.link}`)
    // Use router push for better navigation handling
    navigateTo(node.link)
  } else {
    console.log('Node has no link - likely a category node')
  }
}

// Enhanced debugging and development helpers
onMounted(() => {
  console.log('Sitemap tree data:', sitemapTreeData.value)
  console.log('Tree data length:', sitemapTreeData.value.length)
  console.log('Current path:', currentPath.value)
  
  // Find and log the active node
  const findActiveNode = (nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (isNodeActive(node)) return node
      if (node.children) {
        const activeChild = findActiveNode(node.children)
        if (activeChild) return activeChild
      }
    }
    return null
  }
  
  const activeNode = findActiveNode(sitemapTreeData.value)
  if (activeNode) {
    console.log('Active node found:', activeNode)
  }
})
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  color: white;
  transition: all 0.3s ease;
}

.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 6px 40px rgba(0, 0, 0, 0.3);
}

.intro-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  line-height: 1.6;
  font-weight: 400;
}

.v-card-title {
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  color: #ffffff !important;
}

/* Enhanced tree node styling */
:deep(.tree-node) {
  transition: all 0.2s ease;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 2px 0;
  color: white !important;
}

:deep(.tree-node:hover) {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

:deep(.tree-node.active) {
  background: rgba(66, 165, 245, 0.2);
  border-left: 3px solid #42a5f5;
  font-weight: 600;
  color: #42a5f5 !important;
}

:deep(.tree-node .node-text) {
  transition: color 0.2s ease;
  color: white !important;
}

:deep(.tree-node:hover .node-text) {
  color: rgba(255, 255, 255, 0.95) !important;
}

/* Vuetify tree view styling */
:deep(.v-treeview) {
  color: white !important;
}

:deep(.v-treeview-item__label) {
  color: white !important;
  font-weight: 500;
}

:deep(.v-treeview-item) {
  color: white !important;
}

:deep(.v-treeview-node__root) {
  background: rgba(255, 255, 255, 0.05);
  color: white !important;
  border-radius: 4px;
  margin: 2px 0;
  padding: 4px 8px;
}

:deep(.v-treeview-node__root:hover) {
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
}

/* Skeleton loader styling */
:deep(.v-skeleton-loader) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

/* Improved accessibility */
:deep([role="tree"]) {
  outline: none;
}

:deep([role="tree"]:focus-visible) {
  outline: 2px solid #42a5f5;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Animation for tree expansion */
:deep(.tree-node-children) {
  transition: all 0.3s ease;
}

:deep(.tree-expand-enter-active),
:deep(.tree-expand-leave-active) {
  transition: all 0.3s ease;
}

:deep(.tree-expand-enter-from),
:deep(.tree-expand-leave-to) {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
