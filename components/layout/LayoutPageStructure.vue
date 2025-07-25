<template>
  <div class="page-wrapper">
    <!-- Page Header -->
    <div class="page-header" :class="{ 'white-header': whiteHeader }">
      <div class="page-header-content">
        <div class="page-title-section">
          <BackButton 
            v-if="showBackButton" 
            :to="backButtonTo" 
            class="back-button" 
          />
          <div class="page-title-content">
            <h1 class="page-title">
              {{ title }}
            </h1>
            <p v-if="subtitle" class="page-subtitle">
              {{ subtitle }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="page-content">
      <div class="content-wrapper" :class="{ 'sidebar-layout': hasSidebar }">
        <!-- Main Content Area -->
        <div class="main-content">
          <slot name="main" />
        </div>

        <!-- Sidebar -->
        <div v-if="hasSidebar" class="sidebar">
          <slot name="sidebar" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BackButton from '~/components/ui/BackButton.vue'

interface Props {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backButtonTo?: string
  hasSidebar?: boolean
  whiteHeader?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  showBackButton: true,
  backButtonTo: '/',
  hasSidebar: false,
  whiteHeader: false
})
</script>

<style scoped>
/* Page Structure */
.page-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.01) 0%, rgba(248, 250, 252, 0.01) 100%);
  backdrop-filter: blur(6.5px);
  position: relative;
}

/* Page Header */
.page-header {
  background: #ffffff;
  backdrop-filter: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1rem 0;
  margin-bottom: 1rem;
  position: relative;
  z-index: 10;
}

.page-header.white-header {
  background: #ffffff;
  backdrop-filter: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-title-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-button {
  flex-shrink: 0;
}

.page-title-content {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: black !important;
  text-shadow: none;
  margin: 0 0 0.5rem 0;
  line-height: 1.2;
  transition: all 0.3s ease;
}

.page-subtitle {
  font-size: 1.125rem;
  color: black !important;
  text-shadow: none;
  margin: 0;
  line-height: 1.5;
  transition: all 0.3s ease;
  font-weight: 500;
}

/* Ensure subtitle is always black regardless of parent styles */
.page-subtitle,
.page-subtitle * {
  color: black !important;
}

/* Main Content */
.page-content {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem 2rem;
  width: 100%;
  position: relative;
  z-index: 5;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: start;
  min-height: 0;
}

.content-wrapper.sidebar-layout {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  align-items: start;
}

/* Main Content Area - Enhanced card styling */
.main-content {
  min-width: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  z-index: 1;
}

.main-content:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    0 6px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* Enhanced Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: sticky;
  top: 2rem;
  width: 100%;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 10px 36px rgba(0, 0, 0, 0.14),
    0 5px 18px rgba(0, 0, 0, 0.09),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* Responsive Design - Enhanced */
@media (max-width: 1200px) {
  .page-content {
    max-width: 100%;
    padding: 0 1.5rem 1.5rem;
  }
  
  .content-wrapper.sidebar-layout {
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
  }
}

@media (max-width: 1024px) {
  .content-wrapper.sidebar-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .sidebar {
    position: static;
    order: -1;
    max-width: none;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .main-content {
    padding: 2rem;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 0.75rem 0;
    margin-bottom: 1.5rem;
  }
  
  .page-header-content {
    padding: 0 1rem;
  }
  
  .page-content {
    padding: 0 1rem 1.5rem;
  }
  
  .page-title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .page-title {
    font-size: 1.75rem;
  }
  
  .page-subtitle {
    font-size: 1rem;
  }
  
  .content-wrapper {
    gap: 1rem;
  }
  
  .main-content {
    border-radius: 16px;
    padding: 1.5rem;
  }
  
  .sidebar {
    border-radius: 16px;
    padding: 1.25rem;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 0.5rem 0;
  }
  
  .page-content {
    padding: 0 0.75rem 1rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .main-content {
    border-radius: 12px;
    padding: 1.25rem;
  }
  
  .sidebar {
    border-radius: 12px;
    padding: 1rem;
  }
}

/* Animation - Enhanced */
.page-wrapper {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content {
  animation: slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar {
  animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .main-content {
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  .sidebar {
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
}

/* Print styles */
@media print {
  .main-content,
  .sidebar {
    background: white !important;
    box-shadow: none !important;
    border: 1px solid #ddd !important;
  }
  
  .page-header {
    background: white !important;
    box-shadow: none !important;
    border-bottom: 1px solid #ddd !important;
  }
}
</style> 