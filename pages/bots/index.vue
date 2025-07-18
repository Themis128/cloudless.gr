<template>
  <BotGuide />
  <section>
    <v-btn icon class="mb-4" to="/">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>

    <div class="d-flex justify-space-between align-center mb-4">
      <h1>Bots</h1>
      <v-btn color="primary" @click="showWizard = !showWizard">
        <v-icon start>mdi-plus</v-icon>Create Bot
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
        <BotBuilderDialog @created="onBotCreated" @close="showWizard = false" />
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

    <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
    <v-alert v-if="!error && bots.length === 0" type="info" class="mt-4">No bots found.</v-alert>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBotStore } from '~/stores/botStore';
import { storeToRefs } from 'pinia';
import BotGuide from '~/components/step-guides/BotGuide.vue';
import BotDetails from '~/components/bots/BotDetails.vue';
import BotBuilderDialog from '~/components/bots/BotBuilderDialog.vue';

const botStore = useBotStore();
const { bots, error } = storeToRefs(botStore);
const showWizard = ref(false);

function onBotCreated() {
  showWizard.value = false;
  botStore.fetchAll();
}

onMounted(() => {
  botStore.fetchAll();
});
</script>
