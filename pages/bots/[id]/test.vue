
<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <BotTest :bot-id="botId" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import BotTest from '~/components/bots/BotTest.vue'

const route = useRoute()
const botId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
</script>
