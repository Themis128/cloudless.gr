<template>
  <div class="documentation-search">
    <!-- Search Input -->
    <div class="search-container mb-6">
      <v-text-field
        v-model="searchQuery"
        label="Search Documentation"
        placeholder="Search guides, API reference, admin docs..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        clearable
        :loading="loading"
        @input="handleSearch"
        @keyup.enter="performSearch"
      />
      
      <!-- Search Filters -->
      <div v-if="authStore.isAdmin" class="search-filters mt-3">
        <v-chip-group v-model="searchFilters" multiple>
          <v-chip filter variant="outlined" value="public">
            <v-icon start>mdi-earth</v-icon>
            Public Docs
          </v-chip>
          <v-chip filter variant="outlined" value="admin">
            <v-icon start>mdi-shield-crown</v-icon>
            Admin Docs
          </v-chip>
        </v-chip-group>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchResults.length > 0" class="search-results">
      <div class="results-header mb-4">
        <h3 class="text-h6 font-weight-bold">
          Search Results ({{ searchResults.length }})
        </h3>
        <v-btn 
          variant="text" 
          size="small" 
          @click="clearSearch"
        >
          Clear
        </v-btn>
      </div>

      <div class="results-list">
        <v-card
          v-for="result in searchResults"
          :key="result.page.id"
          class="mb-3 result-card"
          elevation="1"
          @click="navigateToPage(result.page)"
        >
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-2">
              <v-icon 
                :color="getPageIconColor(result.page)"
                class="me-3"
              >
                {{ result.page.icon }}
              </v-icon>
              <div class="flex-grow-1">
                <h4 class="text-subtitle-1 font-weight-medium">
                  {{ result.page.title }}
                </h4>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  {{ result.page.description }}
                </p>
              </div>
              <div class="result-meta text-right">
                <v-chip 
                  size="small" 
                  :color="result.page.isAdminOnly ? 'purple' : 'green'"
                  variant="tonal"
                >
                  {{ result.page.isAdminOnly ? 'Admin' : 'Public' }}
                </v-chip>
              </div>
            </div>
            
            <div class="d-flex align-center justify-space-between">
              <div class="result-tags">
                <v-chip
                  v-for="tag in result.page.tags.slice(0, 3)"
                  :key="tag"
                  size="x-small"
                  variant="outlined"
                  class="me-1"
                >
                  {{ tag }}
                </v-chip>
              </div>
              <div class="result-info text-caption text-medium-emphasis">
                {{ result.page.estimatedReadTime }} min read • {{ result.page.difficulty }}
              </div>
            </div>

            <!-- Matched Content Preview -->
            <div v-if="result.matchedContent" class="matched-content mt-2">
              <v-divider class="mb-2" />
              <p class="text-caption text-medium-emphasis">
                <strong>Match:</strong> {{ result.matchedContent }}
              </p>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- No Results -->
    <div v-else-if="searchQuery && !loading" class="no-results text-center py-8">
      <v-icon size="64" color="grey">mdi-file-search</v-icon>
      <h3 class="text-h6 mt-4 mb-2">No documentation found</h3>
      <p class="text-body-2 text-medium-emphasis">
        Try different keywords or check your spelling
      </p>
    </div>

    <!-- Quick Links (when no search) -->
    <div v-else-if="!searchQuery" class="quick-access">
      <h3 class="text-h6 font-weight-bold mb-4">Quick Access</h3>
      <v-row>
        <v-col 
          v-for="link in quickLinks" 
          :key="link.id"
          cols="12" 
          sm="6" 
          md="4"
        >
          <v-card
            class="quick-link-card h-100"
            elevation="2"
            @click="navigateToPage(link)"
          >
            <v-card-text class="pa-4 text-center">
              <v-icon 
                :color="getPageIconColor(link)"
                size="32"
                class="mb-3"
              >
                {{ link.icon }}
              </v-icon>
              <h4 class="text-subtitle-1 font-weight-medium mb-2">
                {{ link.title }}
              </h4>
              <p class="text-body-2 text-medium-emphasis">
                {{ link.description }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const _props = defineProps({
  placeholder: {
    type: String,
    default: 'Search documentation...'
  },
  showFilters: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['pageSelected'])

// Composables
const authStore = useAuthStore()
const { 
  searchDocs, 
  getQuickLinks, 
  clearSearch: clearStoreSearch,
  loading,
  searchResults: storeSearchResults
} = useDocumentation()

// Local state
const searchQuery = ref('')
const searchFilters = ref(['public'])
const quickLinks = ref([])

// Computed
const searchResults = computed(() => storeSearchResults.value || [])

// Methods
const handleSearch = debounce(async () => {
  if (searchQuery.value.trim()) {
    await performSearch()
  } else {
    clearSearch()
  }
}, 300)

const performSearch = async () => {
  if (!searchQuery.value.trim()) return
  await searchDocs(searchQuery.value)
}

const clearSearch = () => {
  searchQuery.value = ''
  clearStoreSearch()
}

const navigateToPage = (page) => {
  emit('pageSelected', page)
  navigateTo(page.path)
}

const getPageIconColor = (page) => {
  if (page.isAdminOnly) return 'purple'
  
  const colors = {
    'Getting Started': 'green',
    'Guides': 'blue',
    'Reference': 'orange',
    'Support': 'red',
    'Architecture': 'indigo',
    'Development': 'teal',
    'Security': 'deep-orange',
    'Administration': 'purple'
  }
  
  return colors[page.category] || 'primary'
}

// Debounce utility
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Initialize
onMounted(async () => {
  quickLinks.value = await getQuickLinks()
})

// Watch for admin filter changes
watch(searchFilters, () => {
  if (searchQuery.value.trim()) {
    performSearch()
  }
}, { deep: true })
</script>

<style scoped>
.result-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.quick-link-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-link-card:hover {
  transform: translateY(-2px);
}

.matched-content {
  background: rgba(var(--v-theme-primary), 0.05);
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.search-filters .v-chip {
  margin-right: 8px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-meta {
  min-width: fit-content;
  margin-left: 16px;
}

.result-tags {
  flex-grow: 1;
}

.result-info {
  white-space: nowrap;
  margin-left: 12px;
}
</style>
