<template>
  <div>
    <!-- Layout-only page content -->
    <div class="layout-demo">
      <h1 class="text-h3 mb-6">
        Layout Demo
      </h1>
      <p class="text-body-1 mb-4">
        This page demonstrates the layout structure with Vanta background effects.
      </p>
      
      <!-- Layout structure visualization -->
      <div class="layout-structure">
        <div class="structure-item">
          <h3 class="text-h5 mb-2">
            Header Area
          </h3>
          <p class="text-body-2">
            Navigation and app header with transparent background
          </p>
        </div>
        
        <div class="structure-item">
          <h3 class="text-h5 mb-2">
            Main Content Area
          </h3>
          <p class="text-body-2">
            App main content with backdrop blur and transparency
          </p>
        </div>
        
        <div class="structure-item">
          <h3 class="text-h5 mb-2">
            Vanta Background
          </h3>
          <p class="text-body-2">
            Animated background effects visible through transparent UI
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Layout-only page - no specific functionality needed
</script>

<style scoped>
.layout-demo {
  padding: 2rem;
  text-align: center;
}

.layout-structure {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.structure-item {
  padding: 2rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.structure-item:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
}

.structure-item h3 {
  color: var(--v-primary-base);
  margin-bottom: 1rem;
}

.structure-item p {
  color: var(--v-text-primary);
  opacity: 0.8;
}
</style> 