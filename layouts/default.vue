<template>
  <v-app>
    <div class="app-layout">
      <header class="app-header">
        <div class="logo-row">
          <NuxtImg src="/logo.svg" width="40" height="40" alt="Cloudless Logo" class="logo" />
          <h1 class="logo-text">Cloudless</h1>
        </div>
        <nav class="main-nav" style="flex-direction:column;align-items:flex-start">
          <ClientOnly><ProjectGuide /></ClientOnly>
          <!-- 1. Start a Project -->
          <NuxtLink to="/projects">Projects</NuxtLink>
          <NuxtLink to="/projects/create">Create Project</NuxtLink>

          <ClientOnly><BotGuide /></ClientOnly>
          <!-- 2. Add Bots -->
          <NuxtLink to="/bots">Bots</NuxtLink>
          <NuxtLink to="/bots/builder">Create Bot</NuxtLink>

          <ClientOnly><ModelGuide /></ClientOnly>
          <!-- 3. Add Models -->
          <NuxtLink to="/models">Models</NuxtLink>
          <NuxtLink to="/models/create">Create Model</NuxtLink>

          <ClientOnly><PipelineGuide /></ClientOnly>
          <!-- 4. Build Pipelines -->
          <NuxtLink to="/pipelines">Pipelines</NuxtLink>
          <NuxtLink to="/pipelines/create">Create Pipeline</NuxtLink>

          <ClientOnly><TrainGuide /></ClientOnly>
          <!-- 5. Train Models/LLMs -->
          <NuxtLink to="/models/train">Train Model</NuxtLink>
          <NuxtLink to="/llm/train">Train LLM</NuxtLink>

          <ClientOnly><DeployGuide /></ClientOnly>
          <!-- 6. Deploy -->
          <NuxtLink to="/models/deploy">Deploy Model</NuxtLink>
          <NuxtLink to="/deploy">Deployments</NuxtLink>

          <ClientOnly><AnalyticsGuide /></ClientOnly>
          <!-- 7. Analytics & Debug -->
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
          <NuxtLink to="/debug">Debug</NuxtLink>
        </nav>
      </header>
      <main class="app-main">
        <slot />
      </main>
      <footer class="app-footer">
        <span>&copy; 2025 Cloudless</span>
      </footer>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'
import BotGuide from '~/components/step-guides/BotGuide.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'
import TrainGuide from '~/components/step-guides/TrainGuide.vue'
import DeployGuide from '~/components/step-guides/DeployGuide.vue'
import AnalyticsGuide from '~/components/step-guides/AnalyticsGuide.vue'
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f7f7fa;
}
.app-header {
  background: #222;
  color: #fff;
  padding: 1rem 2rem;
  text-align: center;
  letter-spacing: 2px;
}
.main-nav {
  margin-top: 1rem;
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}
.main-nav a {
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}
.main-nav .router-link-active {
  color: #64b5f6;
  font-weight: 600;
}
.main-nav a:hover {
  color: #90caf9;
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
}
.app-footer {
  background: #222;
  color: #fff;
  text-align: center;
  padding: 1rem 2rem;
  font-size: 0.95rem;
}
</style>
