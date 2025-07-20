<template>
  <div>
    <PageStructure
      title="Bots"
      subtitle="Manage and monitor your AI bots"
      back-button-to="/"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis">
                  Create, test, or manage bots
                </p>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                variant="elevated"
                class="action-btn"
                size="large"
                @click="toggleWizard"
              >
                Create Bot
              </v-btn>
              <v-btn
                to="/bots/test"
                color="info"
                prepend-icon="mdi-play-circle"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Test Bot
              </v-btn>
              <v-btn
                to="/bots/manage"
                color="secondary"
                prepend-icon="mdi-robot"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Manage Bots
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-dialog
          v-model="showWizard"
          max-width="600"
          persistent
          :scrim="false"
          transition="dialog-transition"
        >
          <template #default>
            <BotBuilderDialog @created="onBotCreated" @close="closeWizard" />
          </template>
        </v-dialog>

        <v-row>
          <v-col
            v-for="bot in bots"
            :key="bot.id"
            cols="12"
            md="6"
            lg="4"
          >
            <BotDetails :bot-id="bot.id" />
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
        <v-alert v-if="!error && bots.length === 0" type="info" class="mt-4">
          No bots found.
        </v-alert>
      </template>

      <template #sidebar>
        <BotGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import BotBuilderDialog from '~/components/bots/BotBuilderDialog.vue'
import BotDetails from '~/components/bots/BotDetails.vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import BotGuide from '~/components/step-guides/BotGuide.vue'
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()
const { bots, error } = storeToRefs(botStore)
const showWizard = ref(false)

const toggleWizard = () => {
  showWizard.value = !showWizard.value
}

const closeWizard = () => {
  showWizard.value = false
}

const onBotCreated = () => {
  showWizard.value = false
  botStore.fetchAll()
}

onMounted(() => {
  botStore.fetchAll()
})
</script>

<style scoped>
.quick-actions-header {
  margin-bottom: 1.5rem;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .quick-actions-buttons {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .action-btn {
    width: 100%;
    min-height: 52px;
  }
}
</style>
