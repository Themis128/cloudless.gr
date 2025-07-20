<template>
  <v-card class="models-nav-menu">
    <v-card-title class="nav-title">
      <v-icon start color="primary">
        mdi-brain
      </v-icon>
      Model Management
    </v-card-title>
    
    <v-card-text class="nav-content">
      <v-list class="nav-list">
        <v-list-item
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :active="isActive(item.path)"
          class="nav-item"
          rounded="lg"
        >
          <template #prepend>
            <v-icon :color="isActive(item.path) ? 'primary' : 'grey'">
              {{ item.icon }}
            </v-icon>
          </template>
          
          <v-list-item-title class="nav-item-title">
            {{ item.title }}
          </v-list-item-title>
          
          <v-list-item-subtitle class="nav-item-subtitle">
            {{ item.description }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  {
    title: 'All Models',
    description: 'View and manage your models',
    path: '/models',
    icon: 'mdi-view-list'
  },
  {
    title: 'Create Model',
    description: 'Create a new AI model',
    path: '/models/create',
    icon: 'mdi-plus-circle'
  },
  {
    title: 'Train Model',
    description: 'Train your models with data',
    path: '/models/train',
    icon: 'mdi-school'
  },
  {
    title: 'Deploy Model',
    description: 'Deploy models to production',
    path: '/models/deploy',
    icon: 'mdi-rocket-launch'
  }
]

const isActive = (path: string) => {
  return route.path === path
}
</script>

<style scoped>
.models-nav-menu {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.nav-title {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  padding: 1.5rem;
  margin: 0;
}

.nav-content {
  padding: 0;
}

.nav-list {
  padding: 0;
}

.nav-item {
  margin: 0.5rem 1rem;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: translateX(4px);
}

.nav-item.v-list-item--active {
  background: rgba(102, 126, 234, 0.1);
  border-left: 3px solid #667eea;
}

.nav-item-title {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  font-size: 1rem;
}

.nav-item-subtitle {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.v-list-item--active .nav-item-title {
  color: #667eea;
}

.v-list-item--active .nav-item-subtitle {
  color: rgba(102, 126, 234, 0.8);
}

@media (max-width: 768px) {
  .nav-item {
    margin: 0.25rem 0.5rem;
  }
  
  .nav-title {
    padding: 1rem;
  }
}
</style> 