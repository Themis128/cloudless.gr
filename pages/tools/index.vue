<template>
  <div>
    <v-container>
      <!-- Header Section -->
      <v-row>
        <v-col cols="12">
          <div class="text-center mb-8">
            <v-icon size="64" color="primary" class="mb-4">mdi-tools</v-icon>
            <h1 class="text-h3 font-weight-bold mb-4">Development Tools</h1>
            <p class="text-body-1 text-medium-emphasis mb-6">
              A comprehensive collection of powerful tools to accelerate your development workflow
            </p>
            
            <!-- Quick Stats -->
            <v-row class="justify-center mb-6">
              <v-col cols="6" md="3">
                <v-card class="text-center" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-primary mb-1">{{ toolStats.total }}</div>
                    <div class="text-body-2 text-medium-emphasis">Available Tools</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-success mb-1">{{ toolStats.recent }}</div>
                    <div class="text-body-2 text-medium-emphasis">Recently Used</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-info mb-1">{{ toolStats.favorites }}</div>
                    <div class="text-body-2 text-medium-emphasis">Favorites</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6" md="3">
                <v-card class="text-center" variant="outlined">
                  <v-card-text class="pa-4">
                    <div class="text-h4 font-weight-bold text-warning mb-1">{{ toolStats.new }}</div>
                    <div class="text-body-2 text-medium-emphasis">New Tools</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>

      <!-- Search and Filter -->
      <v-row class="mb-6">
        <v-col cols="12" md="8">
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search tools..."
            variant="outlined"
            clearable
            hide-details
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="selectedCategory"
            :items="categories"
            label="Filter by Category"
            variant="outlined"
            clearable
            hide-details
          ></v-select>
        </v-col>
      </v-row>

      <!-- Tools Grid -->
      <v-row>
        <v-col 
          v-for="tool in filteredTools" 
          :key="tool.id"
          cols="12" 
          md="6" 
          lg="4"
        >
          <v-card 
            class="tool-card h-100" 
            :to="tool.route"
            hover
            elevation="2"
          >
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-icon 
                  :color="tool.color" 
                  class="mr-3"
                  size="24"
                >
                  {{ tool.icon }}
                </v-icon>
                <span class="text-h6">{{ tool.name }}</span>
              </div>
              <v-btn
                icon="mdi-heart"
                variant="text"
                size="small"
                :color="tool.isFavorite ? 'error' : 'grey'"
                @click.stop="toggleFavorite(tool.id)"
              ></v-btn>
            </v-card-title>
            
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis mb-3">
                {{ tool.description }}
              </p>
              
              <div class="d-flex align-center justify-space-between">
                <v-chip
                  :color="getCategoryColor(tool.category)"
                  size="small"
                  variant="tonal"
                >
                  {{ tool.category }}
                </v-chip>
                
                <div class="d-flex align-center">
                  <v-icon size="16" color="grey" class="mr-1">mdi-clock-outline</v-icon>
                  <span class="text-caption text-grey">{{ tool.estimatedTime }}</span>
                </div>
              </div>
            </v-card-text>

            <v-card-actions>
              <v-btn
                :color="tool.color"
                variant="outlined"
                size="small"
                block
                :to="tool.route"
              >
                Open Tool
              </v-btn>
            </v-card-actions>

            <!-- New Badge -->
            <v-chip
              v-if="tool.isNew"
              color="warning"
              size="small"
              class="position-absolute"
              style="top: 8px; right: 8px;"
            >
              NEW
            </v-chip>
          </v-card>
        </v-col>
      </v-row>

      <!-- No Results -->
      <v-row v-if="filteredTools.length === 0">
        <v-col cols="12">
          <v-card class="text-center pa-8">
            <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-magnify</v-icon>
            <h3 class="text-h5 mb-2">No tools found</h3>
            <p class="text-body-1 text-medium-emphasis">
              Try adjusting your search or filter criteria
            </p>
            <v-btn
              color="primary"
              variant="outlined"
              class="mt-4"
              @click="clearFilters"
            >
              Clear Filters
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recently Used Tools -->
      <v-row v-if="recentlyUsedTools.length > 0" class="mt-8">
        <v-col cols="12">
          <h2 class="text-h4 mb-4">Recently Used</h2>
          <v-row>
            <v-col 
              v-for="tool in recentlyUsedTools" 
              :key="tool.id"
              cols="12" 
              md="6" 
              lg="3"
            >
              <v-card 
                class="recent-tool-card" 
                :to="tool.route"
                variant="outlined"
                hover
              >
                <v-card-text class="text-center pa-4">
                  <v-icon 
                    :color="tool.color" 
                    size="32"
                    class="mb-2"
                  >
                    {{ tool.icon }}
                  </v-icon>
                  <div class="text-subtitle-2 font-weight-medium">{{ tool.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ tool.lastUsed }}</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

definePageMeta({
  layout: 'default',
})

// Use the tools store
const toolsStore = useToolsStore()

// Reactive state
const searchQuery = ref('')
const selectedCategory = ref('')

// Computed properties from store
const tools = computed(() => toolsStore.tools)
const categories = computed(() => toolsStore.categories)
const toolStats = computed(() => toolsStore.toolStats)
const recentlyUsedTools = computed(() => toolsStore.recentlyUsedTools)

// Filtered tools based on search and category
const filteredTools = computed(() => {
  return toolsStore.filteredTools(searchQuery.value, selectedCategory.value)
})

// Methods
const toggleFavorite = (toolId: string) => {
  toolsStore.toggleFavorite(toolId)
}

const getCategoryColor = (category: string) => {
  return toolsStore.getCategoryColor(category)
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
}

// Load user preferences on mount
onMounted(() => {
  toolsStore.loadUserPreferences()
})
</script>

<style scoped>
.tool-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.recent-tool-card {
  transition: transform 0.2s ease;
}

.recent-tool-card:hover {
  transform: translateY(-2px);
}

.h-100 {
  height: 100%;
}
</style>
