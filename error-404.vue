<template>
  <div class="error-404-page">
    <!-- Spotlight Background -->
    <div class="spotlight"></div>
    
    <!-- Main Content -->
    <div class="error-content">
      <GradientCard variant="info" class="error-card">
        <div class="text-center">
          <!-- 404 Icon -->
          <div class="error-icon">
            <v-icon size="120" color="info">
              mdi-map-marker-question
            </v-icon>
          </div>
          
          <!-- 404 Code -->
          <h1 class="error-code">
            404
          </h1>
          
          <!-- Error Message -->
          <h2 class="error-title">
            Page Not Found
          </h2>
          
          <!-- Error Description -->
          <p class="error-description">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <!-- Search Suggestion -->
          <div class="search-suggestion">
            <v-text-field
              v-model="searchQuery"
              placeholder="Search for pages..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              class="search-input"
              @keyup.enter="handleSearch"
            >
              <template #append>
                <v-btn
                  color="primary"
                  variant="text"
                  @click="handleSearch"
                >
                  Search
                </v-btn>
              </template>
            </v-text-field>
          </div>
          
          <!-- Action Buttons -->
          <div class="error-actions">
            <v-btn
              color="primary"
              size="large"
              variant="elevated"
              @click="goBack"
              class="mr-4"
            >
              <v-icon start>mdi-arrow-left</v-icon>
              Go Back
            </v-btn>
            
            <v-btn
              color="secondary"
              size="large"
              variant="outlined"
              to="/"
            >
              <v-icon start>mdi-home</v-icon>
              Go Home
            </v-btn>
          </div>
          
          <!-- Quick Links -->
          <div class="quick-links">
            <h3 class="quick-links-title">Popular Pages</h3>
            <div class="quick-links-grid">
              <v-btn
                v-for="link in quickLinks"
                :key="link.path"
                :to="link.path"
                variant="text"
                color="primary"
                class="quick-link-btn"
              >
                <v-icon start>{{ link.icon }}</v-icon>
                {{ link.title }}
              </v-btn>
            </div>
          </div>
        </div>
      </GradientCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import GradientCard from '~/components/ui/GradientCard.vue'

const router = useRouter()
const searchQuery = ref('')

// Quick links for popular pages
const quickLinks = [
  { title: 'Dashboard', path: '/', icon: 'mdi-view-dashboard' },
  { title: 'Bots', path: '/bots', icon: 'mdi-robot' },
  { title: 'Models', path: '/models', icon: 'mdi-brain' },
  { title: 'Pipelines', path: '/pipelines', icon: 'mdi-timeline' },
  { title: 'Projects', path: '/projects', icon: 'mdi-folder' },
  { title: 'Documentation', path: '/documentation', icon: 'mdi-book-open' }
]

// Methods
const handleSearch = () => {
  if (searchQuery.value.trim()) {
    // You can implement search functionality here
    // For now, just redirect to home
    router.push('/')
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.error-404-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.error-content {
  max-width: 700px;
  width: 100%;
  z-index: 20;
}

.error-card {
  padding: 3rem 2rem;
}

.error-icon {
  margin-bottom: 2rem;
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  color: var(--v-info-base);
  margin: 0;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.error-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--v-text-primary);
  margin: 1rem 0;
  line-height: 1.2;
}

.error-description {
  font-size: 1.1rem;
  color: var(--v-text-secondary);
  margin: 1.5rem 0;
  line-height: 1.6;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.search-suggestion {
  margin: 2rem 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.search-input {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
}

.error-actions {
  margin: 2rem 0;
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.quick-links {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.quick-links-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--v-text-primary);
  margin-bottom: 1rem;
}

.quick-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  max-width: 500px;
  margin: 0 auto;
}

.quick-link-btn {
  justify-content: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.quick-link-btn:hover {
  background: rgba(var(--v-theme-primary), 0.1);
  transform: translateY(-1px);
}

/* Responsive Design */
@media (max-width: 768px) {
  .error-404-page {
    padding: 1rem;
  }
  
  .error-card {
    padding: 2rem 1rem;
  }
  
  .error-code {
    font-size: 4rem;
  }
  
  .error-title {
    font-size: 1.5rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .v-btn {
    width: 100%;
    max-width: 300px;
  }
  
  .quick-links-grid {
    grid-template-columns: 1fr;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .quick-links {
    border-top-color: rgba(255, 255, 255, 0.1);
  }
  
  .search-input {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style> 