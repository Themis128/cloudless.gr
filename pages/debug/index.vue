<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            Debug Console
          </v-card-title>
          <v-card-text>
            <DebugConsole
              :output="logs"
              title="Debug Console"
              @run="handleCommand"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import DebugConsole from '~/components/debug/DebugConsole.vue'
import { useDebugTools } from '~/composables/useDebugTools'

const { logs, handleCommand } = useDebugTools()
</script>
