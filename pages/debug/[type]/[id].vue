
<template>
  <div>
    <BackButton to="/debug" />
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
import DebugInspector from '~/components/debug/DebugInspector.vue'
import BackButton from '~/components/ui/BackButton.vue'

const route = useRoute()
const type = Array.isArray(route.params.type) ? route.params.type[0] : route.params.type
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
</script>
