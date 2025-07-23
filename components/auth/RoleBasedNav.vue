<template>
  <nav class="role-based-nav">
    <!-- User Menu -->
    <div class="nav-section">
      <h3 class="nav-section-title">User</h3>
      <div class="nav-items">
        <NuxtLink to="/dashboard" class="nav-item">
          <v-icon>mdi-view-dashboard</v-icon>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink to="/profile" class="nav-item">
          <v-icon>mdi-account</v-icon>
          <span>Profile</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="nav-item">
          <v-icon>mdi-cog</v-icon>
          <span>Settings</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Build Section -->
    <div class="nav-section">
      <h3 class="nav-section-title">Build</h3>
      <div class="nav-items">
        <NuxtLink to="/projects" class="nav-item">
          <v-icon>mdi-folder-multiple</v-icon>
          <span>Projects</span>
        </NuxtLink>
        
        <PermissionGuard resource="bot" action="read">
          <NuxtLink to="/bots" class="nav-item">
            <v-icon>mdi-robot</v-icon>
            <span>Bots</span>
          </NuxtLink>
        </PermissionGuard>
        
        <PermissionGuard resource="model" action="read">
          <NuxtLink to="/models" class="nav-item">
            <v-icon>mdi-brain</v-icon>
            <span>Models</span>
          </NuxtLink>
        </PermissionGuard>
        
        <PermissionGuard resource="pipeline" action="read">
          <NuxtLink to="/pipelines" class="nav-item">
            <v-icon>mdi-timeline</v-icon>
            <span>Pipelines</span>
          </NuxtLink>
        </PermissionGuard>
      </div>
    </div>

    <!-- AI Section -->
    <div class="nav-section">
      <h3 class="nav-section-title">AI</h3>
      <div class="nav-items">
        <NuxtLink to="/llm" class="nav-item">
          <v-icon>mdi-brain</v-icon>
          <span>LLM Overview</span>
        </NuxtLink>
        
        <PermissionGuard resource="model" action="read">
          <NuxtLink to="/llm/models" class="nav-item">
            <v-icon>mdi-brain</v-icon>
            <span>Models</span>
          </NuxtLink>
        </PermissionGuard>
        
        <PermissionGuard resource="model" action="train">
          <NuxtLink to="/llm/training" class="nav-item">
            <v-icon>mdi-school</v-icon>
            <span>Training</span>
          </NuxtLink>
        </PermissionGuard>
        
        <NuxtLink to="/llm/datasets" class="nav-item">
          <v-icon>mdi-database</v-icon>
          <span>Datasets</span>
        </NuxtLink>
        
        <PermissionGuard resource="admin" action="analytics">
          <NuxtLink to="/llm/analytics" class="nav-item">
            <v-icon>mdi-chart-line</v-icon>
            <span>Analytics</span>
          </NuxtLink>
        </PermissionGuard>
        
        <NuxtLink to="/llm/api" class="nav-item">
          <v-icon>mdi-api</v-icon>
          <span>API Docs</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Operations Section -->
    <div class="nav-section">
      <h3 class="nav-section-title">Operations</h3>
      <div class="nav-items">
        <PermissionGuard resource="bot" action="deploy">
          <NuxtLink to="/deploy" class="nav-item">
            <v-icon>mdi-rocket-launch</v-icon>
            <span>Deploy</span>
          </NuxtLink>
        </PermissionGuard>
        
        <NuxtLink to="/debug" class="nav-item">
          <v-icon>mdi-bug</v-icon>
          <span>Debug</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Admin Section -->
    <PermissionGuard resource="admin" action="users">
      <div class="nav-section">
        <h3 class="nav-section-title">Administration</h3>
        <div class="nav-items">
          <NuxtLink to="/admin/users" class="nav-item">
            <v-icon>mdi-account-group</v-icon>
            <span>Users</span>
          </NuxtLink>
          
          <PermissionGuard resource="admin" action="roles">
            <NuxtLink to="/admin/roles" class="nav-item">
              <v-icon>mdi-shield-account</v-icon>
              <span>Roles</span>
            </NuxtLink>
          </PermissionGuard>
          
          <PermissionGuard resource="admin" action="analytics">
            <NuxtLink to="/admin/redis-analytics" class="nav-item">
              <v-icon>mdi-chart-line</v-icon>
              <span>Analytics</span>
            </NuxtLink>
          </PermissionGuard>
        </div>
      </div>
    </PermissionGuard>

    <!-- Resources Section -->
    <div class="nav-section">
      <h3 class="nav-section-title">Resources</h3>
      <div class="nav-items">
        <NuxtLink to="/documentation" class="nav-item">
          <v-icon>mdi-book-open-variant</v-icon>
          <span>Documentation</span>
        </NuxtLink>
        <NuxtLink to="/support" class="nav-item">
          <v-icon>mdi-help-circle</v-icon>
          <span>Support</span>
        </NuxtLink>
        <NuxtLink to="/api-reference" class="nav-item">
          <v-icon>mdi-api</v-icon>
          <span>API Reference</span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
// Auth store
const authStore = useAuthStore()

// Computed
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const isDeveloper = computed(() => authStore.isDeveloper)
const isUser = computed(() => authStore.isUser)
</script>

<style scoped>
.role-based-nav {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nav-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
  padding: 0 0.5rem;
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.nav-item:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  border-color: rgba(102, 126, 234, 0.2);
  transform: translateX(4px);
}

.nav-item.router-link-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-item.router-link-active:hover {
  transform: translateX(4px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.nav-item .v-icon {
  font-size: 1.25rem;
}

@media (max-width: 768px) {
  .role-based-nav {
    padding: 0.5rem;
  }
  
  .nav-item {
    padding: 0.625rem 0.75rem;
    font-size: 0.8rem;
  }
  
  .nav-item .v-icon {
    font-size: 1.125rem;
  }
}
</style> 