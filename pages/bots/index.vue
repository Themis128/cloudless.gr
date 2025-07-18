<template>
  <div>
    <BotGuide />
    <section>
      <v-btn icon class="mb-4" to="/">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>

      <div class="d-flex justify-space-between align-center mb-4">
        <h1>Bots</h1>
        <v-btn color="primary" @click="toggleWizard">
          <v-icon start>
            mdi-plus
          </v-icon>Create Bot
        </v-btn>
      </div>

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
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import BotBuilderDialog from '~/components/bots/BotBuilderDialog.vue'
import BotDetails from '~/components/bots/BotDetails.vue'
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
