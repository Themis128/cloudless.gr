<template>
  <div class="documentation-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-text">
          <h1 class="text-h3 font-weight-bold mb-2">
            <v-icon icon="mdi-book-open-variant" class="me-3" color="primary" />
            Documentation
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Complete guide to using the Cloudless.gr ML platform
          </p>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <v-row class="mb-8">
      <v-col v-for="quickLink in quickLinks" :key="quickLink.title" cols="12" md="4">
        <v-card class="quick-link-card h-100" elevation="2" @click="navigateTo(quickLink.path)">
          <v-card-text class="pa-6">
            <div class="d-flex align-center mb-4">
              <v-icon :icon="quickLink.icon" size="32" color="primary" class="me-3" />
              <h3 class="text-h6 font-weight-bold">{{ quickLink.title }}</h3>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-3">
              {{ quickLink.description }}
            </p>
            <v-chip size="small" color="primary" variant="outlined">
              {{ quickLink.category }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Documentation Sections -->
    <div class="documentation-sections">
      <div v-for="section in documentationSections" :key="section.title" class="section mb-8">
        <div class="section-header mb-4">
          <h2 class="text-h4 font-weight-bold mb-2">
            <v-icon :icon="section.icon" class="me-3" color="primary" />
            {{ section.title }}
          </h2>
          <p class="text-body-1 text-medium-emphasis">{{ section.description }}</p>
        </div>

        <v-row>
          <v-col v-for="page in section.pages" :key="page.title" cols="12" md="6" lg="4">
            <v-card class="doc-page-card h-100" elevation="1" @click="navigateTo(page.path)">
              <v-card-text class="pa-5">
                <div class="d-flex align-center mb-3">
                  <v-icon :icon="page.icon" color="primary" class="me-2" />
                  <h4 class="text-h6 font-weight-medium">{{ page.title }}</h4>
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  {{ page.description }}
                </p>
                <div class="d-flex align-center justify-space-between">
                  <v-chip
                    size="small"
                    :color="
                      page.difficulty === 'Beginner'
                        ? 'success'
                        : page.difficulty === 'Intermediate'
                          ? 'warning'
                          : 'error'
                    "
                    variant="outlined"
                  >
                    {{ page.difficulty }}
                  </v-chip>
                  <v-btn variant="text" size="small" color="primary" append-icon="mdi-arrow-right">
                    Read
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Search Documentation -->
    <v-card class="search-section" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-magnify" class="me-2" color="primary" />
          Search Documentation
        </h3>
        <v-text-field
          v-model="searchQuery"
          placeholder="Search documentation..."
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          clearable
          @input="handleSearch"
        />
        <div v-if="searchResults.length > 0" class="search-results mt-4">
          <h4 class="text-h6 mb-3">Search Results</h4>
          <v-list>
            <v-list-item
              v-for="result in searchResults"
              :key="result.path"
              @click="navigateTo(result.path)"
            >
              <template #prepend>
                <v-icon :icon="result.icon" color="primary" />
              </template>
              <v-list-item-title>{{ result.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ result.description }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Documentation',
  description: 'Complete documentation for the Cloudless.gr ML platform',
  layout: 'documentation',
});

const searchQuery = ref('');
const searchResults = ref<any[]>([]);

const quickLinks = [
  {
    title: 'Getting Started',
    description: 'Quick start guide to begin using the platform',
    icon: 'mdi-rocket-launch',
    path: '/documentation/getting-started',
    category: 'Beginner',
  },
  {
    title: 'API Reference',
    description: 'Complete API documentation and examples',
    icon: 'mdi-api',
    path: '/documentation/api-reference',
    category: 'Reference',
  },
  {
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: 'mdi-help-circle',
    path: '/documentation/troubleshooting',
    category: 'Support',
  },
];

const documentationSections = [
  {
    title: 'Getting Started',
    description: 'Everything you need to know to start using the platform',
    icon: 'mdi-play-circle',
    pages: [
      {
        title: 'Quick Start',
        description: 'Get up and running in 5 minutes',
        icon: 'mdi-rocket-launch',
        path: '/documentation/getting-started',
        difficulty: 'Beginner',
      },
      {
        title: 'User Guide',
        description: 'Complete guide to using the platform',
        icon: 'mdi-account-group',
        path: '/documentation/user-guide',
        difficulty: 'Beginner',
      },
      {
        title: 'First Project',
        description: 'Create your first ML project step by step',
        icon: 'mdi-folder-plus',
        path: '/documentation/first-project',
        difficulty: 'Beginner',
      },
    ],
  },
  {
    title: 'API Documentation',
    description: 'Complete API reference and integration guides',
    icon: 'mdi-api',
    pages: [
      {
        title: 'API Reference',
        description: 'Complete REST API documentation with examples',
        icon: 'mdi-api',
        path: '/documentation/api-reference',
        difficulty: 'Intermediate',
      },
      {
        title: 'Authentication',
        description: 'How to authenticate with the API',
        icon: 'mdi-lock',
        path: '/documentation/api/authentication',
        difficulty: 'Intermediate',
      },
      {
        title: 'SDKs & Libraries',
        description: 'Official SDKs and integration libraries',
        icon: 'mdi-code-braces',
        path: '/documentation/api/sdks',
        difficulty: 'Intermediate',
      },
    ],
  },
  {
    title: 'Platform Features',
    description: 'Detailed guides for platform features',
    icon: 'mdi-cog',
    pages: [
      {
        title: 'Project Management',
        description: 'Creating and managing ML projects',
        icon: 'mdi-folder-cog',
        path: '/documentation/project-management',
        difficulty: 'Intermediate',
      },
      {
        title: 'Model Training',
        description: 'Training and managing ML models',
        icon: 'mdi-brain',
        path: '/documentation/model-training',
        difficulty: 'Intermediate',
      },
      {
        title: 'Deployment',
        description: 'Deploying models to production',
        icon: 'mdi-cloud-upload',
        path: '/documentation/deployment',
        difficulty: 'Advanced',
      },
      {
        title: 'Pipeline Builder',
        description: 'Visual pipeline creation and management',
        icon: 'mdi-pipe',
        path: '/documentation/pipeline-builder',
        difficulty: 'Intermediate',
      },
    ],
  },
  {
    title: 'Help & Support',
    description: 'Troubleshooting and support resources',
    icon: 'mdi-help-circle',
    pages: [
      {
        title: 'Troubleshooting',
        description: 'Common issues and solutions',
        icon: 'mdi-help-circle',
        path: '/documentation/troubleshooting',
        difficulty: 'Beginner',
      },
      {
        title: 'FAQ',
        description: 'Frequently asked questions',
        icon: 'mdi-frequently-asked-questions',
        path: '/documentation/faq',
        difficulty: 'Beginner',
      },
      {
        title: 'Contact Support',
        description: 'Get help from our support team',
        icon: 'mdi-headset',
        path: '/support',
        difficulty: 'Beginner',
      },
    ],
  },
  {
    title: 'Advanced Topics',
    description: 'Advanced features and customization',
    icon: 'mdi-school',
    pages: [
      {
        title: 'Custom Models',
        description: 'Integrating custom ML models',
        icon: 'mdi-brain',
        path: '/documentation/advanced/custom-models',
        difficulty: 'Advanced',
      },
      {
        title: 'Data Connectors',
        description: 'Connecting to external data sources',
        icon: 'mdi-database-arrow-right',
        path: '/documentation/advanced/data-connectors',
        difficulty: 'Advanced',
      },
      {
        title: 'Monitoring',
        description: 'Monitoring and observability',
        icon: 'mdi-chart-line',
        path: '/documentation/advanced/monitoring',
        difficulty: 'Advanced',
      },
    ],
  },
];

// Flatten all pages for search
const allPages = computed(() => {
  const pages: any[] = [];
  documentationSections.forEach((section) => {
    section.pages.forEach((page) => {
      pages.push({
        ...page,
        section: section.title,
      });
    });
  });
  quickLinks.forEach((link) => {
    pages.push({
      title: link.title,
      description: link.description,
      icon: link.icon,
      path: link.path,
      difficulty: link.category,
      section: 'Quick Links',
    });
  });
  return pages;
});

const handleSearch = () => {
  if (!searchQuery.value) {
    searchResults.value = [];
    return;
  }

  const query = searchQuery.value.toLowerCase();
  searchResults.value = allPages.value
    .filter(
      (page) =>
        page.title.toLowerCase().includes(query) ||
        page.description.toLowerCase().includes(query) ||
        page.section.toLowerCase().includes(query),
    )
    .slice(0, 10);
};
</script>

<style scoped>
.documentation-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: white;
}

.page-header {
  margin-bottom: 48px;
  text-align: center;
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.quick-link-card {
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.quick-link-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.section {
  margin-bottom: 48px;
}

.section-header {
  text-align: center;
  margin-bottom: 32px;
}

.doc-page-card {
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.doc-page-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(var(--v-theme-primary), 0.2);
}

.search-section {
  margin-top: 48px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .documentation-page {
    padding: 16px;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .section {
    margin-bottom: 32px;
  }
}
</style>
