<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="transparent" elevation="0" class="glassmorphism-header" height="80" fixed>
      <div class="app-bar-content d-flex align-center w-100 px-4">
        <!-- Logo and Brand -->
        <div class="brand-section d-flex align-center">
          <v-btn icon="mdi-arrow-left" variant="text" class="me-2" @click="navigateTo('/')" />
          <NuxtLink to="/" class="brand-link d-flex align-center text-decoration-none">
            <v-icon icon="mdi-cloud" size="32" color="primary" class="me-2" />
            <span class="text-h5 font-weight-bold text-white">Cloudless.gr</span>
          </NuxtLink>
          <v-divider vertical class="mx-4" />
          <span class="text-h6 text-medium-emphasis">Documentation</span>
        </div>

        <v-spacer />

        <!-- Search -->
        <div class="search-section">
          <v-text-field
            v-model="searchQuery"
            placeholder="Search docs..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            class="search-field"
            style="max-width: 300px"
            hide-details
            @keyup.enter="performSearch"
          />
        </div>

        <v-spacer />

        <!-- Action Buttons -->
        <div class="action-buttons d-flex align-center">
          <v-btn
            prepend-icon="mdi-github"
            variant="outlined"
            size="small"
            class="me-2"
            href="https://github.com/cloudless-gr/platform"
            target="_blank"
          >
            GitHub
          </v-btn>
          <v-btn color="primary" size="small" @click="navigateTo('/dashboard')"> Dashboard </v-btn>
        </div>
      </div>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      class="glassmorphism-sidebar"
      width="300"
      permanent
      :rail="rail"
      @click="rail = false"
    >
      <!-- Toggle Rail Button -->
      <div class="drawer-header pa-4">
        <v-btn icon variant="text" @click="rail = !rail">
          <v-icon>{{ rail ? 'mdi-menu' : 'mdi-menu-open' }}</v-icon>
        </v-btn>
      </div>

      <!-- Navigation Menu -->
      <v-list class="navigation-list" nav>
        <!-- Overview -->
        <v-list-subheader v-if="!rail" class="text-primary font-weight-bold">
          OVERVIEW
        </v-list-subheader>

        <v-list-item
          v-for="item in overviewItems"
          :key="item.path"
          :to="item.path"
          :prepend-icon="item.icon"
          :title="rail ? '' : item.title"
          class="nav-item"
          router
          exact
        >
          <v-tooltip v-if="rail" activator="parent" location="end">
            {{ item.title }}
          </v-tooltip>
        </v-list-item>

        <v-divider class="my-4" />

        <!-- Getting Started -->
        <v-list-subheader v-if="!rail" class="text-primary font-weight-bold">
          GETTING STARTED
        </v-list-subheader>

        <v-list-item
          v-for="item in gettingStartedItems"
          :key="item.path"
          :to="item.path"
          :prepend-icon="item.icon"
          :title="rail ? '' : item.title"
          class="nav-item"
          router
        >
          <v-tooltip v-if="rail" activator="parent" location="end">
            {{ item.title }}
          </v-tooltip>
        </v-list-item>

        <v-divider class="my-4" />

        <!-- API Reference -->
        <v-list-subheader v-if="!rail" class="text-primary font-weight-bold">
          API REFERENCE
        </v-list-subheader>

        <v-list-item
          v-for="item in apiItems"
          :key="item.path"
          :to="item.path"
          :prepend-icon="item.icon"
          :title="rail ? '' : item.title"
          class="nav-item"
          router
        >
          <v-tooltip v-if="rail" activator="parent" location="end">
            {{ item.title }}
          </v-tooltip>
        </v-list-item>

        <v-divider class="my-4" />

        <!-- Support -->
        <v-list-subheader v-if="!rail" class="text-primary font-weight-bold">
          SUPPORT
        </v-list-subheader>

        <v-list-item
          v-for="item in supportItems"
          :key="item.path"
          :to="item.path"
          :prepend-icon="item.icon"
          :title="rail ? '' : item.title"
          class="nav-item"
          router
        >
          <v-tooltip v-if="rail" activator="parent" location="end">
            {{ item.title }}
          </v-tooltip>
        </v-list-item>
      </v-list>

      <!-- Footer -->
      <template #append>
        <div v-if="!rail" class="drawer-footer pa-4">
          <v-card class="feedback-card" elevation="1">
            <v-card-text class="pa-3">
              <div class="text-caption text-medium-emphasis mb-2">Help us improve</div>
              <v-btn
                size="small"
                variant="outlined"
                prepend-icon="mdi-message-text"
                block
                @click="openFeedback"
              >
                Give Feedback
              </v-btn>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main class="documentation-main">
      <div class="content-wrapper">
        <!-- Breadcrumbs -->
        <div class="breadcrumbs-section mb-6">
          <v-breadcrumbs :items="breadcrumbs" class="glassmorphism-breadcrumbs px-0">
            <template #item="{ item }">
              <v-breadcrumbs-item :to="item.href" :disabled="item.disabled" class="breadcrumb-item">
                {{ item.title }}
              </v-breadcrumbs-item>
            </template>
            <template #divider>
              <v-icon>mdi-chevron-right</v-icon>
            </template>
          </v-breadcrumbs>
        </div>

        <!-- Page Content -->
        <div class="page-content">
          <slot />
        </div>

        <!-- Page Navigation -->
        <div class="page-navigation mt-8">
          <v-row>
            <v-col cols="6">
              <v-btn
                v-if="previousPage"
                :to="previousPage.path"
                variant="outlined"
                prepend-icon="mdi-arrow-left"
                class="w-100"
              >
                <div class="text-left">
                  <div class="text-caption text-medium-emphasis">Previous</div>
                  <div class="font-weight-medium">{{ previousPage.title }}</div>
                </div>
              </v-btn>
            </v-col>
            <v-col cols="6" class="text-right">
              <v-btn
                v-if="nextPage"
                :to="nextPage.path"
                variant="outlined"
                append-icon="mdi-arrow-right"
                class="w-100"
              >
                <div class="text-right">
                  <div class="text-caption text-medium-emphasis">Next</div>
                  <div class="font-weight-medium">{{ nextPage.title }}</div>
                </div>
              </v-btn>
            </v-col>
          </v-row>
        </div>
      </div>
    </v-main>

    <!-- Feedback Dialog -->
    <v-dialog v-model="feedbackDialog" max-width="500">
      <v-card class="glassmorphism-dialog">
        <v-card-title class="glassmorphism-dialog-header">
          <v-icon icon="mdi-message-text" class="me-2" />
          Documentation Feedback
        </v-card-title>
        <v-divider color="rgba(255, 255, 255, 0.2)" />
        <v-card-text class="pa-6">
          <v-textarea
            v-model="feedbackText"
            label="Your feedback"
            placeholder="Tell us how we can improve our documentation..."
            rows="4"
            variant="outlined"
          />
          <v-rating v-model="feedbackRating" class="mt-4" color="warning" half-increments />
          <div class="text-caption text-medium-emphasis mt-2">
            How would you rate this documentation?
          </div>
        </v-card-text>
        <v-card-actions class="glassmorphism-dialog-actions">
          <v-spacer />
          <v-btn variant="text" @click="feedbackDialog = false"> Cancel </v-btn>
          <v-btn color="primary" @click="submitFeedback"> Submit Feedback </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
const route = useRoute();
const searchQuery = ref('');
const drawer = ref(true);
const rail = ref(false);
const feedbackDialog = ref(false);
const feedbackText = ref('');
const feedbackRating = ref(0);

// Navigation items
const overviewItems = [
  { title: 'Documentation Home', path: '/documentation', icon: 'mdi-home' },
  { title: "What's New", path: '/documentation/changelog', icon: 'mdi-new-box' },
];

const gettingStartedItems = [
  { title: 'Quick Start', path: '/documentation/getting-started', icon: 'mdi-rocket-launch' },
  { title: 'User Guide', path: '/documentation/user-guide', icon: 'mdi-account-group' },
  { title: 'Installation', path: '/documentation/installation', icon: 'mdi-download' },
];

const apiItems = [
  { title: 'API Reference', path: '/documentation/api-reference', icon: 'mdi-api' },
  { title: 'Authentication', path: '/documentation/api/auth', icon: 'mdi-lock' },
  { title: 'SDKs', path: '/documentation/api/sdks', icon: 'mdi-code-braces' },
];

const supportItems = [
  { title: 'FAQ', path: '/documentation/faq', icon: 'mdi-frequently-asked-questions' },
  { title: 'Troubleshooting', path: '/documentation/troubleshooting', icon: 'mdi-help-circle' },
  { title: 'Contact Support', path: '/support', icon: 'mdi-headset' },
];

// All pages for navigation
const allPages = [...overviewItems, ...gettingStartedItems, ...apiItems, ...supportItems];

// Breadcrumbs
const breadcrumbs = computed(() => {
  const pathSegments = route.path.split('/').filter(Boolean);
  const crumbs = [{ title: 'Home', href: '/', disabled: false }];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;

    let title = segment.charAt(0).toUpperCase() + segment.slice(1);
    if (segment === 'documentation') {
      title = 'Documentation';
    } else if (segment === 'api-reference') {
      title = 'API Reference';
    } else if (segment === 'getting-started') {
      title = 'Getting Started';
    } else if (segment === 'user-guide') {
      title = 'User Guide';
    }

    crumbs.push({
      title,
      href: isLast ? undefined : currentPath,
      disabled: isLast,
    });
  });

  return crumbs;
});

// Page navigation
const currentPageIndex = computed(() => {
  return allPages.findIndex((page) => page.path === route.path);
});

const previousPage = computed(() => {
  const index = currentPageIndex.value;
  return index > 0 ? allPages[index - 1] : null;
});

const nextPage = computed(() => {
  const index = currentPageIndex.value;
  return index >= 0 && index < allPages.length - 1 ? allPages[index + 1] : null;
});

// Functions
const performSearch = () => {
  if (searchQuery.value.trim()) {
    navigateTo(`/documentation/search?q=${encodeURIComponent(searchQuery.value)}`);
  }
};

const openFeedback = () => {
  feedbackDialog.value = true;
};

const submitFeedback = () => {
  // TODO: Implement feedback submission
  console.log('Feedback:', feedbackText.value, 'Rating:', feedbackRating.value);
  feedbackDialog.value = false;
  feedbackText.value = '';
  feedbackRating.value = 0;
};

// Handle responsive drawer
const { width } = useDisplay();
watch(
  width,
  (newWidth) => {
    if (newWidth < 1280) {
      drawer.value = false;
    } else {
      drawer.value = true;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
/* Glassmorphism Effects */
.glassmorphism-header {
  background: rgba(13, 17, 23, 0.8) !important;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.glassmorphism-sidebar {
  background: rgba(13, 17, 23, 0.9) !important;
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.glassmorphism-breadcrumbs {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glassmorphism-dialog {
  background: rgba(13, 17, 23, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glassmorphism-dialog-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.glassmorphism-dialog-actions {
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Layout Styles */
.app-bar-content {
  max-width: 100%;
}

.brand-link {
  color: white !important;
}

.search-field {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.documentation-main {
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  color: white;
  min-height: 100vh;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.navigation-list {
  background: transparent;
}

.nav-item {
  margin: 2px 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

.nav-item.router-link-active {
  background: rgba(var(--v-theme-primary), 0.2) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.drawer-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.feedback-card {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.breadcrumb-item {
  color: rgba(255, 255, 255, 0.7);
}

.breadcrumb-item:hover {
  color: rgb(var(--v-theme-primary));
}

.page-navigation .v-btn {
  height: auto;
  padding: 16px;
  text-transform: none;
}

/* Responsive */
@media (max-width: 1279px) {
  .content-wrapper {
    padding: 16px;
  }

  .brand-section {
    flex-shrink: 1;
  }

  .search-section {
    display: none;
  }

  .action-buttons .v-btn:first-child {
    display: none;
  }
}

@media (max-width: 959px) {
  .app-bar-content {
    padding: 0 16px;
  }

  .brand-section span.text-h6 {
    display: none;
  }
}
</style>
