<template>
  <div class="projects-layout">
    <!-- Dark animated background with patterns -->
    <div class="background-container">
      <!-- Animated geometric patterns -->
      <div class="pattern-layer pattern-1"></div>
      <div class="pattern-layer pattern-2"></div>
      <div class="pattern-layer pattern-3"></div>

      <!-- Strange shadow effects -->
      <div class="shadow-orb shadow-orb-1"></div>
      <div class="shadow-orb shadow-orb-2"></div>
      <div class="shadow-orb shadow-orb-3"></div>

      <!-- Neural network pattern overlay -->
      <div class="neural-pattern"></div>

      <!-- Subtle grid overlay -->
      <div class="grid-overlay"></div>
    </div>

    <!-- Navigation -->
    <LargeNav class="header projects-nav" />

    <!-- Main content area -->
    <main id="main-content" role="main" class="projects-content" tabindex="-1">
      <!-- Projects breadcrumb -->
      <div class="breadcrumb-section">
        <v-container>
          <v-breadcrumbs :items="breadcrumbItems" class="projects-breadcrumb pa-0" color="primary">
            <template #prepend>
              <v-icon icon="mdi-brain" class="me-2" color="primary" />
            </template>
            <template #divider>
              <v-icon icon="mdi-chevron-right" size="small" />
            </template>
          </v-breadcrumbs>
        </v-container>
      </div>

      <!-- Page content with glass effect -->
      <div class="content-wrapper">
        <NuxtPage />
      </div>
    </main>

    <!-- Footer with same structure as other layouts -->
    <Suspense>
      <template #default>
        <Footer :year="new Date().getFullYear()" :is-dark="true" />
      </template>
      <template #fallback>
        <div class="text-sm text-gray-400 text-center py-2">Loading footer...</div>
      </template>
    </Suspense>

    <!-- Accessibility menu -->
    <Suspense>
      <template #default>
        <AccessibilityMenu />
      </template>
    </Suspense>

    <!-- Floating Navigation Button -->
    <Suspense>
      <template #default>
        <FloatingNavButton />
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';

const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'));
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'));
const AccessibilityMenu = defineAsyncComponent(
  () => import('@/components/accessibility/AccessibilityMenu.vue'),
);
const FloatingNavButton = defineAsyncComponent(
  () => import('@/components/ui/FloatingNavButton.vue'),
);

const route = useRoute();

// Dynamic breadcrumb based on current route
const breadcrumbItems = computed(() => {
  const items = [
    {
      title: 'Home',
      disabled: false,
      href: '/',
    },
    {
      title: 'Projects',
      disabled: false,
      href: '/projects',
    },
  ];

  // Add specific project breadcrumb if we're in a project detail page
  if (route.params.id) {
    items.push({
      title: `Project ${route.params.id}`,
      disabled: true,
      href: '',
    });

    // Add sub-page breadcrumb
    const pathSegments = route.path.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment && lastSegment !== route.params.id) {
      items.push({
        title: lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1),
        disabled: true,
        href: '',
      });
    }
  }

  return items;
});
</script>

<style scoped>
.projects-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Dark background with animated patterns */
.background-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  background: linear-gradient(
    135deg,
    #0a0a0a 0%,
    #1a1a2e 25%,
    #16213e 50%,
    #0f0f23 75%,
    #0a0a0a 100%
  );
  overflow: hidden;
}

/* Geometric pattern layers */
.pattern-layer {
  position: absolute;
  width: 200%;
  height: 200%;
  opacity: 0.1;
  background-size: 100px 100px;
  animation: drift 20s linear infinite;
}

.pattern-1 {
  background-image:
    linear-gradient(
      45deg,
      transparent 40%,
      rgba(0, 255, 255, 0.1) 40%,
      rgba(0, 255, 255, 0.1) 60%,
      transparent 60%
    ),
    linear-gradient(
      -45deg,
      transparent 40%,
      rgba(255, 0, 255, 0.1) 40%,
      rgba(255, 0, 255, 0.1) 60%,
      transparent 60%
    );
  animation-duration: 25s;
  transform: rotate(15deg);
}

.pattern-2 {
  background-image:
    radial-gradient(circle at 25% 25%, rgba(0, 255, 127, 0.15) 2px, transparent 2px),
    radial-gradient(circle at 75% 75%, rgba(255, 69, 0, 0.15) 1px, transparent 1px);
  background-size:
    60px 60px,
    40px 40px;
  animation-duration: 30s;
  animation-direction: reverse;
  transform: rotate(-10deg);
}

.pattern-3 {
  background-image:
    linear-gradient(
      0deg,
      transparent 24%,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.05) 26%,
      transparent 27%,
      transparent 74%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(255, 255, 255, 0.05) 76%,
      transparent 77%,
      transparent
    ),
    linear-gradient(
      90deg,
      transparent 24%,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.05) 26%,
      transparent 27%,
      transparent 74%,
      rgba(255, 255, 255, 0.05) 75%,
      rgba(255, 255, 255, 0.05) 76%,
      transparent 77%,
      transparent
    );
  background-size: 80px 80px;
  animation-duration: 35s;
  transform: scale(1.5);
}

/* Strange shadow orbs */
.shadow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  animation: float 6s ease-in-out infinite;
}

.shadow-orb-1 {
  width: 300px;
  height: 300px;
  background: radial-gradient(
    circle,
    rgba(138, 43, 226, 0.3) 0%,
    rgba(138, 43, 226, 0.1) 50%,
    transparent 100%
  );
  top: 10%;
  left: 10%;
  animation-delay: -2s;
}

.shadow-orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(
    circle,
    rgba(0, 255, 255, 0.25) 0%,
    rgba(0, 255, 255, 0.08) 50%,
    transparent 100%
  );
  top: 60%;
  right: 15%;
  animation-delay: -4s;
  animation-duration: 8s;
}

.shadow-orb-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(
    circle,
    rgba(255, 20, 147, 0.35) 0%,
    rgba(255, 20, 147, 0.12) 50%,
    transparent 100%
  );
  bottom: 20%;
  left: 50%;
  animation-delay: -1s;
  animation-duration: 10s;
}

/* Neural network pattern */
.neural-pattern {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0.08;
  background-image:
    radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.3) 1px, transparent 1px),
    radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.3) 1px, transparent 1px),
    radial-gradient(circle at 20% 80%, rgba(255, 255, 0, 0.3) 1px, transparent 1px),
    radial-gradient(circle at 80% 80%, rgba(0, 255, 127, 0.3) 1px, transparent 1px);
  background-size:
    150px 150px,
    180px 180px,
    200px 200px,
    170px 170px;
  animation: pulse 4s ease-in-out infinite;
}

/* Grid overlay */
.grid-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0.03;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 50px 50px;
}

/* Header styling */
.projects-nav {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 10;
}

/* Breadcrumb section */
.breadcrumb-section {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.5rem 0;
  position: relative;
  z-index: 5;
}

.projects-breadcrumb :deep(.v-breadcrumbs-item) {
  color: rgba(255, 255, 255, 0.8);
}

.projects-breadcrumb :deep(.v-breadcrumbs-item--disabled) {
  color: rgba(255, 255, 255, 0.5);
}

/* Content wrapper with glass effect */
.projects-content {
  flex: 1;
  position: relative;
  z-index: 2;
}

.content-wrapper {
  position: relative;
  backdrop-filter: blur(1px);
  background: rgba(255, 255, 255, 0.02);
  min-height: calc(100vh - 200px);
}

/* Content cards enhancement for projects pages */
.content-wrapper :deep(.v-card) {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 2px 8px rgba(255, 255, 255, 0.1) inset;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.content-wrapper :deep(.v-card:hover) {
  transform: translateY(-8px);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.4),
    0 4px 16px rgba(255, 255, 255, 0.15) inset;
  border-color: rgba(var(--v-theme-primary), 0.5);
}

/* Statistics cards special effects */
.content-wrapper :deep(.stats-card) {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.9) 0%,
    rgba(var(--v-theme-primary-darken-1), 0.95) 100%
  ) !important;
  box-shadow:
    0 8px 32px rgba(var(--v-theme-primary), 0.3),
    0 2px 8px rgba(255, 255, 255, 0.2) inset;
}

.content-wrapper :deep(.stats-card:hover) {
  box-shadow:
    0 16px 48px rgba(var(--v-theme-primary), 0.4),
    0 4px 16px rgba(255, 255, 255, 0.3) inset;
}

/* Enhanced button effects */
.content-wrapper :deep(.v-btn) {
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.content-wrapper :deep(.v-btn:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

/* Animations */
@keyframes drift {
  0% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(5%, 5%) rotate(90deg);
  }
  50% {
    transform: translate(-5%, 10%) rotate(180deg);
  }
  75% {
    transform: translate(-10%, -5%) rotate(270deg);
  }
  100% {
    transform: translate(0, 0) rotate(360deg);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.08;
  }
  50% {
    opacity: 0.15;
  }
}

/* Dark mode adjustments for form elements */
.content-wrapper :deep(.v-field--variant-outlined) {
  background: rgba(255, 255, 255, 0.9);
}

.content-wrapper :deep(.v-field--variant-filled) {
  background: rgba(255, 255, 255, 0.85);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .pattern-layer {
    animation-duration: 15s;
  }

  .shadow-orb {
    filter: blur(20px);
  }

  .shadow-orb-1,
  .shadow-orb-2,
  .shadow-orb-3 {
    width: 150px;
    height: 150px;
  }

  .content-wrapper :deep(.v-card:hover) {
    transform: none;
  }
}

/* Footer dark theme */
.content-wrapper + * :deep(.footer-dark) {
  background: rgba(0, 0, 0, 0.8) !important;
  backdrop-filter: blur(20px);
  color: rgba(255, 255, 255, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
