<template>
  <div class="workflow-node" :class="{ selected: isSelected }">
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ agent.name }}
      </v-card-title>
      <v-card-text>
        <div class="node-ports">
          <div class="input-ports">
            <div 
              v-for="port in inputPorts" 
              :key="port.id" 
              class="port input-port" 
              :data-port-id="port.id"
            >
              {{ port.name }}
            </div>
          </div>
          <div class="output-ports">
            <div 
              v-for="port in outputPorts" 
              :key="port.id" 
              class="port output-port" 
              :data-port-id="port.id"
            >
              {{ port.name }}
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { Agent } from '~/types/agents'

const _props = defineProps<{
  agent: Agent
  isSelected?: boolean
  inputPorts?: Array<{ id: string; name: string }>
  outputPorts?: Array<{ id: string; name: string }>
}>()
</script>

<style scoped>
.workflow-node {
  min-width: 200px;
  border: 2px solid transparent;
  border-radius: 8px;
}

.workflow-node.selected {
  border-color: var(--v-primary-base);
}

.node-ports {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.port {
  padding: 4px 8px;
  margin: 4px 0;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
}

.input-port {
  margin-right: 8px;
}

.output-port {
  margin-left: 8px;
  text-align: right;
}
</style>
