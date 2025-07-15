<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Cloudless LLM Dev Agent</v-toolbar-title>
    </v-app-bar>
    <ClientOnly>
      <v-navigation-drawer v-model="drawer" app>
        <v-list>
          <v-list-item to="/" title="Home" prepend-icon="mdi-home" />
          <v-list-item to="/bots" title="Bots" prepend-icon="mdi-robot" />
          <v-list-item to="/models" title="Models" prepend-icon="mdi-brain" />
          <v-list-item to="/pipelines" title="Pipelines" prepend-icon="mdi-timeline" />
          <v-list-item to="/projects/create" title="Create Project" prepend-icon="mdi-plus-box" />
          <v-list-item to="/llm/train" title="Train LLM" prepend-icon="mdi-rocket-launch" />
          <v-list-item to="/debug" title="Debug" prepend-icon="mdi-bug" />
        </v-list>
      </v-navigation-drawer>
    </ClientOnly>
    <v-main>
      <v-container fluid>
        <v-row class="my-6">
          <v-col cols="12" md="8">
            <v-card>
              <v-card-title class="text-h5">Welcome to Cloudless</v-card-title>
              <v-card-text>
                Your all-in-one low-code platform for data pipelines, analytics, and AI.
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card color="primary" dark>
              <v-card-title>Quick Actions</v-card-title>
              <v-card-text>
                <v-btn block class="mb-2" to="/projects/create">Create Project</v-btn>
                <v-btn block class="mb-2" to="/pipelines/create">New Data Pipeline</v-btn>
                <v-btn block class="mb-2" to="/llm/train">Train LLM</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>Recent Projects</v-card-title>
              <v-card-text>
                <!-- Placeholder for recent project list -->
                <project-list-preview />
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title>Recent Activity</v-card-title>
              <v-card-text>
                <!-- Placeholder for logs, events, or activity -->
                <activity-feed />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProjectListPreview from '~/components/project-list-preview.vue'
import ActivityFeed from '~/components/activity-feed.vue'
const drawer = ref(false)
</script>
