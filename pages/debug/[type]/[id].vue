
<template>
  <div>
    <BackButton :to="`/debug/${type}`" />
    <v-card>
      <v-card-title>Debug {{ type }} #{{ id }}</v-card-title>
      <v-card-text>
        <DebugInspector :id="id" :type="type" />
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import BackButton from '~/components/ui/BackButton.vue'
import DebugInspector from '~/components/debug/DebugInspector.vue'

const route = useRoute()
const type = Array.isArray(route.params.type) ? route.params.type[0] : route.params.type
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
</script>
