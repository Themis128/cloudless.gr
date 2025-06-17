<template>
  <v-container class="pa-8">
    <v-row>
      <v-col cols="12" md="8" class="mx-auto">
        <v-card>
          <v-card-title class="text-h5 font-weight-bold">Settings</v-card-title>
          <v-card-text>
            <v-form>
              <v-switch v-model="darkMode" label="Enable Dark Mode" />
              <v-text-field v-model="displayName" label="Display Name" />
              <v-btn color="primary" class="mt-4">Save</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'user' })
import { ref } from 'vue'

const darkMode = ref(false)
const displayName = ref('')
</script>
