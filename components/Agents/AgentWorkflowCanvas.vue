<template>
  <div class="workflow-canvas" ref="canvasRef">
    <vue-flow
      v-model="elements"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      @nodesDragged="onNodesDragged"
      @connect="onConnect"
      @paneClick="onPaneClick"
    >
      <template #node-agent="nodeProps">
        <AgentNode
          :agent="nodeProps.data.agent"
          :is-selected="selectedNode?.id === nodeProps.id"
          :input-ports="nodeProps.data.inputPorts"
          :output-ports="nodeProps.data.outputPorts"
        />
      </template>      <Panel position="top-right">
        <v-btn-group>
          <v-btn icon="mdi-plus" @click="zoomIn">
            <v-tooltip activator="parent" location="top">Zoom In</v-tooltip>
          </v-btn>
          <v-btn icon="mdi-minus" @click="zoomOut">
            <v-tooltip activator="parent" location="top">Zoom Out</v-tooltip>
          </v-btn>
          <v-btn icon="mdi-fit-to-screen" @click="fitView">
            <v-tooltip activator="parent" location="top">Fit View</v-tooltip>
          </v-btn>
        </v-btn-group>
      </Panel>      <Controls />
      <Background variant="dots" gap="24" size="1" /></vue-flow>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from '#imports'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { Background } from '@vue-flow/background'
import type { Node, Edge, Connection } from '@vue-flow/core'
import type { Agent } from '~/types/agents'

// Import styles for controls and background
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'

const props = defineProps<{
  agents: Agent[]
}>()

const emit = defineEmits<{
  (e: 'update:workflow', nodes: Node[], edges: Edge[]): void
  (e: 'nodeSelect', nodeId: string | null): void
}>()

const elements = ref<Array<Node | Edge>>([])
const selectedNode = ref<Node | null>(null)
const canvasRef = ref<HTMLDivElement>()

const { zoomIn, zoomOut, fitView } = useVueFlow()

onMounted(() => {
  // Initialize nodes from agents
  elements.value = props.agents.map((agent: Agent, index: number) => ({
    id: agent.id,
    type: 'agent',
    position: { x: index * 250, y: 100 },
    data: {
      agent,
      inputPorts: [
        { id: `${agent.id}-in-1`, name: 'Input' }
      ],
      outputPorts: [
        { id: `${agent.id}-out-1`, name: 'Output' }
      ]
    }
  }))
})

const onNodesDragged = (nodes: Node[]) => {
  emit('update:workflow', nodes, elements.value.filter((el: Node | Edge) => 'source' in el) as Edge[])
}

const onConnect = (connection: Connection) => {
  const newEdge: Edge = {
    id: `${connection.source}-${connection.target}`,
    source: connection.source!,
    target: connection.target!,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle
  }
  elements.value = [...elements.value, newEdge]
  emit('update:workflow',
    elements.value.filter((el: Node | Edge) => !('source' in el)) as Node[],
    elements.value.filter((el: Node | Edge) => 'source' in el) as Edge[]
  )
}

const onPaneClick = () => {
  selectedNode.value = null
  emit('nodeSelect', null)
}

const onNodeClick = (event: MouseEvent, node: Node) => {
  selectedNode.value = node
  emit('nodeSelect', node.id)
}
</script>

<style>
.workflow-canvas {
  width: 100%;
  height: 100%;
  background: var(--v-background-base);
}

.vue-flow {
  background: transparent;
}
</style>
