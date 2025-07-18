<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>Cloudless LLM Dev Agent</v-app-bar-title>
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
        <v-row class="my-6" align="stretch">
          <v-col cols="12" md="4">
            <v-card class="mb-4">
              <v-card-title class="text-h6 d-flex align-center">
                <SvgIcon name="user" size="32" class="me-2" />
                <span>Welcome{{ user && user.email ? `, ${user.email}` : '' }}!</span>
              </v-card-title>
              <v-card-text>
                <div>Your all-in-one low-code platform for data pipelines, analytics, and AI.</div>
              </v-card-text>
            </v-card>
            <v-card color="primary" dark>
              <v-card-title>Quick Actions</v-card-title>
              <v-card-text>
                <v-btn block class="mb-2" to="/projects/create">Create Project</v-btn>
                <v-btn block class="mb-2" to="/pipelines/create">New Data Pipeline</v-btn>
                <v-btn block class="mb-2" to="/llm/train">Train LLM</v-btn>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="8">
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card class="dashboard-stat" outlined>
                  <v-card-title class="d-flex align-center">
                    <SvgIcon name="bot" size="28" class="me-2" />
                    Bots
                  </v-card-title>
                  <v-card-text class="text-h4">{{ bots.length }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card class="dashboard-stat" outlined>
                  <v-card-title class="d-flex align-center">
                    <SvgIcon name="model" size="28" class="me-2" />
                    Models
                  </v-card-title>
                  <v-card-text class="text-h4">{{ models.length }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card class="dashboard-stat" outlined>
                  <v-card-title class="d-flex align-center">
                    <SvgIcon name="pipeline" size="28" class="me-2" />
                    Pipelines
                  </v-card-title>
                  <v-card-text class="text-h4">{{ pipelineSteps }}</v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card class="dashboard-stat" outlined>
                  <v-card-title class="d-flex align-center">
                    <v-icon class="me-2">mdi-folder</v-icon>
                    Projects
                  </v-card-title>
                  <v-card-text class="text-h4">{{ projectCount }}</v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>Recent Projects</v-card-title>
                  <v-card-text>
                    <project-list-preview />
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card>
                  <v-card-title>Recent Activity</v-card-title>
                  <v-card-text>
                    <activity-feed />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProjectListPreview from '~/components/project-list-preview.vue'
import ActivityFeed from '~/components/activity-feed.vue'
import SvgIcon from '~/components/ui/SvgIcon.vue'
import { useAuth } from '~/composables/useAuth'
import { useBotStore } from '~/stores/botStore'
import { useModelStore } from '~/stores/modelStore'
import { usePipelineStore } from '~/stores/pipelineStore'
import { useProjectStore } from '~/stores/templateStore'
import { useSupabase } from '~/composables/supabase'

const drawer = ref(false)
const { user } = useAuth()
const botStore = useBotStore()
const modelStore = useModelStore()
const pipelineStore = usePipelineStore()
const projectStore = useProjectStore()

const bots = computed(() => botStore.bots || [])
const models = computed(() => modelStore.models || [])
const pipelineSteps = computed(() => pipelineStore.pipelines?.length || 0)
const projectCount = ref(0)

onMounted(async () => {
  await botStore.fetchAll()
  await pipelineStore.fetchAll()  // Add this line to fetch pipelines
  // For models, you may want to fetch from backend if not already loaded
  // For projects, fetch count
  const supabase = useSupabase()
  const { data } = await supabase.from('projects').select('id')
  projectCount.value = data ? data.length : 0
})
</script>
