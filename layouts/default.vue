<template>
  <v-app>
    <div class="app-layout">
      <header class="app-header">
        <div class="logo-row">
          <NuxtImg src="/logo.svg" width="40" height="40" alt="Cloudless Logo" class="logo" />
          <span class="wizard-hat-emoji">🧙‍♂️</span>
          <h1 class="logo-text">Cloudless Wizard</h1>
        </div>
      </header>
      <div class="wizard-body">
        <aside class="wizard-sidebar">
          <nav class="main-nav nav-steps">
            <div v-for="(step, i) in steps" :key="step.title" class="nav-section">
              <div class="nav-header">
                <span v-if="i < currentIndex">🟢</span>
                <span v-else-if="i === currentIndex">🧙‍♂️</span>
                <span v-else>⚪</span>
                Step {{ i + 1 }}: {{ step.title }}
              </div>
              <NuxtLink :to="step.path">
                <span class="step-link-icon">
                  <span v-if="i === currentIndex">✨</span>
                  <span v-else-if="i < currentIndex">✔️</span>
                  <span v-else>⭐</span>
                </span>
                {{ step.title }} Setup
              </NuxtLink>
            </div>
          </nav>
        </aside>
        <main class="app-main">
          <slot />
        </main>
      </div>
      <footer class="app-footer">
        <span>&copy; 2025 Cloudless</span>
      </footer>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useWizardSteps } from '~/composables/useWizardSteps'

const route = useRoute()
const { steps } = useWizardSteps()

const currentIndex = computed(() =>
  steps.findIndex(s => route.path.startsWith(s.path.replace('/create', '')))
)
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(120deg, #23232b 0%, #2d2d3a 100%);
}
.wizard-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.wizard-sidebar {
  width: 270px;
  background: #23232b;
  padding: 2rem 1.2rem 2rem 2rem;
  border-right: 1px solid #222;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 2px 0 16px 0 rgba(0,0,0,0.10);
  z-index: 2;
}
.app-header {
  background: #23232b;
  color: #fff;
  padding: 1.5rem 2rem 1rem 2rem;
  text-align: center;
  letter-spacing: 2px;
  border-bottom: 1px solid #23232b;
}
.main-nav {
  margin-top: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
}
.main-nav a {
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s, background 0.2s;
  margin-left: 1.5rem;
  border-radius: 6px;
  padding: 0.25rem 0.75rem 0.25rem 0.5rem;
  display: flex;
  align-items: center;
}
.main-nav .router-link-active {
  color: #64b5f6;
  font-weight: 600;
  background: rgba(100,181,246,0.08);
}
.main-nav a:hover {
  color: #90caf9;
  background: rgba(100,181,246,0.10);
}
.nav-steps {
  width: 100%;
}
.nav-section {
  margin-bottom: 1.2rem;
}
.nav-header {
  font-size: 1.08rem;
  font-weight: 600;
  color: #90caf9;
  margin-bottom: 0.2rem;
  margin-left: 0.2rem;
  display: flex;
  align-items: center;
}
.nav-header span {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}
.step-link-icon {
  display: inline-flex;
  align-items: center;
  margin-right: 0.5rem;
  font-size: 1.1em;
}
.wizard-hat-emoji {
  font-size: 2rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  vertical-align: middle;
}
.logo-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.logo {
  vertical-align: middle;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.logo-text {
  font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 2px;
  margin: 0;
}
.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  background: #23232b;
  border-radius: 18px;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.08);
}
.app-footer {
  background: #23232b;
  color: #fff;
  text-align: center;
  padding: 1rem 2rem;
  font-size: 0.95rem;
  border-top: 1px solid #23232b;
}
</style>
