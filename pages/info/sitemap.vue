<template>
  <section class="py-10">
    <UiTreeView
      v-if="newTreeData.length"
      title="Cloudless New Site Structure"
      role="tree"
      aria-label="Site Navigation Tree (New)"
      :nodes="newTreeData"
      :allow-add="false"
      :show-header="true"
      :flat="false"
      @node-select="onNodeSelect"
    >
      <template #node="{ node }">
        <span :class="[ 'sitemap-section', node.id.startsWith('user') ? 'sitemap-purple' : node.id.startsWith('core') ? 'sitemap-blue' : '' ]">
          {{ node.text }}
          <span v-if="node.children && node.children.length" class="sitemap-blue-count"> ({{ node.children.length }})</span>
        </span>
      </template>
    </UiTreeView>
    <v-skeleton-loader v-else type="list-item@5" class="mb-4" />
    <h1 class="text-h4 font-weight-bold white--text mb-4">Site Map (New)</h1>
    <p class="intro-text mb-6">Explore the new Cloudless site structure. Click any item to visit that page.</p>
  </section>
</template>

<script setup lang="ts">

import { navigateTo } from '#app';
import { ref } from 'vue';
import UiTreeView from '~/components/ui/TreeView.vue';
import type { TreeNode } from '~/composables/useTreeView';

const newTreeData = ref<TreeNode[]>([
  // Public
  {
    id: 'public',
    text: 'Public Pages',
    icon: 'mdi-earth',
    children: [
      { id: 'home', text: 'Home', icon: 'mdi-home', link: '/' },
      { id: 'info', text: 'Info', icon: 'mdi-information', link: '/info' },
      { id: 'info-matrix', text: 'Matrix', icon: 'mdi-chart-box-outline', link: '/info/matrix' },
      { id: 'info-about', text: 'About', icon: 'mdi-information-outline', link: '/info/about' },
      { id: 'info-contact', text: 'Contact', icon: 'mdi-email-outline', link: '/info/contact' },
      { id: 'info-faq', text: 'FAQ', icon: 'mdi-help-circle-outline', link: '/info/faq' },
      { id: 'info-sitemap', text: 'Sitemap', icon: 'mdi-sitemap-outline', link: '/info/sitemap' },
      { id: 'test-navigation', text: 'Test Navigation', icon: 'mdi-compass', link: '/test-navigation' },
    ]
  },
  // Auth
  {
    id: 'auth',
    text: 'Authentication',
    icon: 'mdi-account-key',    children: [
      { id: 'auth', text: 'Login', icon: 'mdi-login', link: '/auth' },
      { id: 'auth-register', text: 'Register', icon: 'mdi-account-plus', link: '/auth/register' },
      { id: 'auth-reset', text: 'Password Reset', icon: 'mdi-lock-reset', link: '/auth/reset' },
      { id: 'auth-users-nav', text: 'User Navigation', icon: 'mdi-navigation', link: '/auth/users-nav' },
      { id: 'auth-callback', text: 'Auth Callback', icon: 'mdi-link', link: '/auth/callback' },
    ]
  },
  // Documentation
  {
    id: 'docs',
    text: 'Documentation',
    icon: 'mdi-book-open-page-variant',
    children: [
      { id: 'docs-index', text: 'Overview', icon: 'mdi-book-open', link: '/documentation' },
      { id: 'docs-getting-started', text: 'Getting Started', icon: 'mdi-rocket-launch', link: '/documentation/getting-started' },
      { id: 'docs-user-guide', text: 'User Guide', icon: 'mdi-account-school', link: '/documentation/user-guide' },
      { id: 'docs-api-reference', text: 'API Reference', icon: 'mdi-api', link: '/documentation/api-reference' },
      { id: 'docs-faq', text: 'FAQ', icon: 'mdi-help-circle-outline', link: '/documentation/faq' },
      { id: 'docs-roadmap', text: 'Roadmap', icon: 'mdi-road-variant', link: '/documentation/roadmap' },
      { id: 'docs-troubleshooting', text: 'Troubleshooting', icon: 'mdi-alert-circle-outline', link: '/documentation/troubleshooting' },
    ]
  },
  // User (private)
  {
    id: 'user',
    text: 'User Area',
    icon: 'mdi-account',
    children: [
      { id: 'user-index', text: 'User Dashboard', icon: 'mdi-view-dashboard', link: '/users/' },
      { id: 'user-contact', text: 'Contact', icon: 'mdi-email-outline', link: '/users/contact' },
      { id: 'user-codegen', text: 'Codegen', icon: 'mdi-code-braces', link: '/users/codegen' },
      { id: 'user-profile', text: 'Profile', icon: 'mdi-account-circle', link: '/users/profile/index' },
      { id: 'user-profile-edit', text: 'Edit Profile', icon: 'mdi-account-edit', link: '/users/profile/edit' },
      { id: 'user-activity', text: 'Activity', icon: 'mdi-run', link: '/users/activity/index' },
      { id: 'user-notifications', text: 'Notifications', icon: 'mdi-bell', link: '/users/notifications/index' },
      { id: 'user-account', text: 'Account', icon: 'mdi-account-cog', link: '/users/account/index' },
      { id: 'user-account-security', text: 'Security', icon: 'mdi-shield-lock', link: '/users/account/security' },
      { id: 'user-account-preferences', text: 'Preferences', icon: 'mdi-tune', link: '/users/account/preferences' },
      { id: 'user-id', text: 'User Details', icon: 'mdi-account-details', link: '/users/[id]' },
    ]
  },
  // Projects (private)
  {
    id: 'projects',
    text: 'Projects',
    icon: 'mdi-folder-multiple',
    children: [
      { id: 'projects-index', text: 'All Projects', icon: 'mdi-format-list-bulleted', link: '/projects/index' },
      { id: 'projects-create', text: 'Create Project', icon: 'mdi-plus-circle', link: '/projects/create' },
      { id: 'projects-templates', text: 'Templates', icon: 'mdi-file-document-multiple', link: '/projects/templates' },
      { id: 'projects-id-index', text: 'Project Details', icon: 'mdi-folder', link: '/projects/[id]/index' },
      { id: 'projects-id-config', text: 'Project Config', icon: 'mdi-cog', link: '/projects/[id]/config' },
      { id: 'projects-id-deploy', text: 'Project Deploy', icon: 'mdi-rocket', link: '/projects/[id]/deploy' },
      { id: 'projects-id-train', text: 'Project Train', icon: 'mdi-robot', link: '/projects/[id]/train' },
    ]
  },
  // Storage (private)
  {
    id: 'storage',
    text: 'Storage',
    icon: 'mdi-database',
    children: [
      { id: 'storage-index', text: 'Storage Home', icon: 'mdi-database', link: '/storage/index' },
    ]
  },
  // Settings (private)
  {
    id: 'settings',
    text: 'Settings',
    icon: 'mdi-cog',
    children: [
      { id: 'settings-index', text: 'Settings', icon: 'mdi-cog', link: '/settings/index' },
    ]
  },
  // (Admin Area removed)
])

const onNodeSelect = (node: TreeNode) => {
  if (node.link) {
    navigateTo(node.link);
  }
};
</script>

<style scoped>
.intro-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  line-height: 1.6;
  font-weight: 400;
}
.sitemap-blue {
  color: #1565c0 !important;
  font-weight: 700;
  text-shadow: 0 1px 2px #fff, 0 0 2px #fff;
}
.sitemap-blue-count {
  color: #1565c0 !important;
  font-weight: 600;
  margin-left: 2px;
  text-shadow: 0 1px 2px #fff, 0 0 2px #fff;
}
.sitemap-purple {
  color: #7c3aed !important;
  font-weight: 700;
  text-shadow: 0 1px 2px #fff, 0 0 2px #fff;
}
.sitemap-purple-count {
  color: #7c3aed !important;
  font-weight: 600;
  margin-left: 2px;
  text-shadow: 0 1px 2px #fff, 0 0 2px #fff;
}
</style>
