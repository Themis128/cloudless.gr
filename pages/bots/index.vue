<template>
  <BotGuide />
  <section>
    <v-btn icon class="mb-4" to="/">
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>

    <div class="d-flex justify-space-between align-center mb-4">
      <h1>Bots</h1>
      <v-btn color="primary" to="/bots/builder">
        <v-icon start>mdi-plus</v-icon>Create Bot
      </v-btn>
    </div>

    <v-row>
      <v-col
        v-for="bot in bots"
        :key="bot.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card>
          <v-card-title>
            <v-avatar v-if="bot.avatar_url" size="32" class="me-2">
              <v-img :src="bot.avatar_url" />
            </v-avatar>
            {{ bot.name }}
          </v-card-title>
          <v-card-text class="text-truncate" style="max-height: 60px;">
            {{ bot.prompt }}
          </v-card-text>
          <v-card-actions>
            <v-btn text :to="`/bots/${bot.id}`">View</v-btn>
          </v-card-actions>
        </v-card>
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

const botStore = useBotStore();
const { bots, error } = storeToRefs(botStore);

onMounted(() => {
  botStore.fetchAll();
});
</script>
