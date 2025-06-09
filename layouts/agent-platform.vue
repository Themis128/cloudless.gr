<template>
  <v-app>
    <!-- Vanta.js Clouds2 Background -->
    <VantaClouds2Background />

    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon v-if="is_mobile" @click="drawer = !drawer" />
      <v-toolbar-title>{{ activeAgent?.name || 'AI Agent Platform' }}</v-toolbar-title>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      :permanent="!is_mobile"
      :temporary="is_mobile"
      :rail="rail && !is_mobile"
      class="transparent-overlay"
      @click="rail = false"
      app
    >
      <v-list-item
        prepend-avatar="/images/agent-avatar.png"
        :title="activeAgent?.name || 'AI Agent Platform'"
        nav
      >
        <template #append>
          <v-btn
            v-if="!is_mobile"
            variant="text"
            icon="mdi-chevron-left"
            @click.stop="rail = !rail"
          ></v-btn>
        </template>
      </v-list-item>
      <v-divider></v-divider>
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          value="dashboard"
          to="/dashboard"
        />
        <v-list-item prepend-icon="mdi-robot" title="Agents" value="agents" to="/agents" />
        <v-list-item
          prepend-icon="mdi-sitemap"
          title="Workflows"
          value="workflows"
          to="/workflows"
        />
        <v-list-item prepend-icon="mdi-database" title="Memory" value="memory" to="/memory" />
        <v-list-item prepend-icon="mdi-cog" title="Settings" value="settings" to="/settings" />
      </v-list>
    </v-navigation-drawer>

    <v-main class="content-container">
      <v-container fluid>
        <slot></slot>
      </v-container>
    </v-main>
    <v-bottom-navigation v-if="is_mobile" grow app class="transparent-overlay">
      <v-btn to="/dashboard" icon
        ><v-icon>mdi-view-dashboard</v-icon
        ><v-tooltip activator="parent" location="top"><span>Dashboard</span></v-tooltip></v-btn
      >
      <v-btn to="/builder" icon
        ><v-icon>mdi-cube-outline</v-icon
        ><v-tooltip activator="parent" location="top"><span>Builder</span></v-tooltip></v-btn
      >
      <v-btn to="/agents" icon
        ><v-icon>mdi-robot</v-icon
        ><v-tooltip activator="parent" location="top"><span>Agents</span></v-tooltip></v-btn
      >
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, useRoute, watch } from '#imports';
  import VantaClouds2Background from '@/components/VantaClouds2Background.vue';
  import { useDisplay } from 'vuetify';
  import { useAgentStore } from '~/stores/useAgentStore';

  const drawer = ref(false);
  const rail = ref(true);

  const { smAndDown } = useDisplay();
  const is_mobile = computed(() => smAndDown.value);

  const agentStore = useAgentStore();
  const activeAgent = computed(() => agentStore.active_agent);
  const route = useRoute();

  onMounted(async () => {
    await agentStore.loadAgents();
  });

  watch(
    () => route.path,
    () => {
      if (is_mobile.value) drawer.value = false;
    }
  );
</script>

<style scoped>
  .transparent-overlay {
    background-color: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(10px);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
  }

  .content-container {
    position: relative;
    z-index: 1;
  }

  .v-navigation-drawer {
    transition: width 0.2s ease-out;
  }

  html,
  body {
    touch-action: manipulation;
    overscroll-behavior: contain;
  }

  .v-main {
    background-color: transparent !important;
  }
</style>
