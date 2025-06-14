<template>
  <v-container class="pa-8">
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>Settings</v-card-title>
          <v-card-text>
            <p>This is a placeholder for your settings page.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports';
definePageMeta({ layout: 'user' });
</script>
