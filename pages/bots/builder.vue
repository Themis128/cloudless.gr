<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title>Create a New Bot</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <div>Follow the template below to create a bot. Fill in the required fields and click 'Create Bot'.</div>
              <v-code>
{
  "name": "MyBotName"
}
              </v-code>
            </div>
            <v-form @submit.prevent="createBot" ref="formRef">
              <v-text-field
                v-model="name"
                label="Name"
                placeholder="e.g. MyBotName"
                required
                class="mb-3"
              />
              <v-btn type="submit" color="primary" :loading="loading">Create Bot</v-btn>
            </v-form>
            <v-alert v-if="success" type="success" class="mt-3">Bot created!</v-alert>
            <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBotStore } from '~/stores/botStore'
import { storeToRefs } from 'pinia'

const formRef = ref()
const botStore = useBotStore()
const { name, loading, success, error } = storeToRefs(botStore)

function createBot() {
  botStore.create({ name: name.value })
}
</script>
