<template>
  <section class="demo-section">
    <v-container>
      <div class="section-header text-center mb-8">
        <h2 class="section-title text-h4 font-weight-bold mb-3">Interactive Demo</h2>
        <p class="section-subtitle text-h6 mx-auto">
          Experience the power of our comprehensive data analytics platform
        </p>
      </div>

      <div class="app-demo-section">
        <CloudlessDemo />
      </div>
    </v-container>
  </section>
</template>

<script setup lang="ts">
// This component wraps the existing CloudlessDemo component
</script>

<style scoped>
/* Section Styles */
.demo-section {
  padding: 2rem 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.02) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  position: relative;
  z-index: 1;
}

.section-header {
  margin-bottom: 2rem;
}

.section-title {
  color: #ffffff;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.6);
  font-weight: 700;
  margin-bottom: 1rem;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  font-weight: 400;
  max-width: 600px;
  margin: 0 auto;
}

/* Demo Section */
.app-demo-section {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 2rem;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  max-width: 1200px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  position: relative;
  margin: 0 auto;
}

.app-demo-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 24px;
  pointer-events: none;
}

.app-demo-section :deep(.demo-content h3) {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  margin-bottom: 16px;
  font-weight: 700;
}

.app-demo-section :deep(.workflow-container) {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Responsive Design */
@media (max-width: 960px) {
  .demo-section {
    padding: 3rem 0;
  }

  .app-demo-section {
    padding: 1.5rem;
    border-radius: 20px;
  }
}

@media (max-width: 600px) {
  .section-header {
    margin-bottom: 2rem;
  }

  .app-demo-section {
    padding: 1rem;
    border-radius: 16px;
  }
}
</style>
