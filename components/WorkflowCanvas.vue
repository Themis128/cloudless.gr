<template>
  <div class="workflow-canvas" ref="canvasContainer">
    <div class="canvas-header">
      <v-row align="center" justify="space-between" class="pa-2">
        <v-col cols="auto">
          <h3 class="text-h6">Workflow Canvas</h3>
        </v-col>
        <v-col cols="auto">
          <v-btn-group variant="outlined" size="small">
            <v-btn @click="zoomIn" icon="mdi-plus" />
            <v-btn @click="zoomOut" icon="mdi-minus" />
            <v-btn @click="resetZoom" icon="mdi-fit-to-screen" />
          </v-btn-group>
        </v-col>
      </v-row>
    </div>

    <div class="canvas-content" :style="canvasStyle">
      <svg
        ref="svgCanvas"
        class="workflow-svg"
        :width="canvasWidth"
        :height="canvasHeight"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseup="onCanvasMouseUp"
        @wheel="onCanvasWheel"
      >
        <!-- Grid pattern -->
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Workflow nodes -->
        <g v-for="node in nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
          <rect
            :width="nodeWidth"
            :height="nodeHeight"
            :fill="getNodeColor(node.type)"
            stroke="#2196F3"
            stroke-width="2"
            rx="8"
            class="workflow-node"
            @click="selectNode(node)"
          />
          <text
            :x="nodeWidth / 2"
            :y="nodeHeight / 2"
            text-anchor="middle"
            dominant-baseline="middle"
            class="node-text"
          >
            {{ node.label }}
          </text>
        </g>

        <!-- Connections between nodes -->
        <g v-for="connection in connections" :key="`${connection.from}-${connection.to}`">
          <path
            :d="getConnectionPath(connection)"
            stroke="#2196F3"
            stroke-width="2"
            fill="none"
            marker-end="url(#arrowhead)"
          />
        </g>

        <!-- Arrow marker definition -->
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#2196F3" />
          </marker>
        </defs>
      </svg>
    </div>

    <!-- Node palette -->
    <div class="node-palette">
      <v-card class="pa-2">
        <v-card-title class="text-subtitle-2 pa-2">Add Nodes</v-card-title>
        <v-btn-group vertical variant="outlined" size="small">
          <v-btn @click="addNode('start')" prepend-icon="mdi-play">Start</v-btn>
          <v-btn @click="addNode('process')" prepend-icon="mdi-cog">Process</v-btn>
          <v-btn @click="addNode('decision')" prepend-icon="mdi-help-rhombus">Decision</v-btn>
          <v-btn @click="addNode('end')" prepend-icon="mdi-stop">End</v-btn>
        </v-btn-group>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from '#imports'

interface WorkflowNode {
  id: string
  type: 'start' | 'process' | 'decision' | 'end'
  label: string
  x: number
  y: number
}

interface NodeConnection {
  from: string
  to: string
}

// Props
interface Props {
  initialNodes?: WorkflowNode[]
  initialConnections?: NodeConnection[]
}

const props = withDefaults(defineProps<Props>(), {
  initialNodes: () => [],
  initialConnections: () => []
})

// Emits
const emit = defineEmits<{
  nodeSelected: [node: WorkflowNode]
  nodeAdded: [node: WorkflowNode]
  connectionAdded: [connection: NodeConnection]
}>()

// Reactive data
const canvasContainer = ref<HTMLElement>()
const svgCanvas = ref<SVGElement>()
const nodes = ref<WorkflowNode[]>(props.initialNodes)
const connections = ref<NodeConnection[]>(props.initialConnections)
const selectedNode = ref<WorkflowNode | null>(null)
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// Constants
const nodeWidth = 120
const nodeHeight = 60
const canvasWidth = ref(1200)
const canvasHeight = ref(800)

// Computed properties
const canvasStyle = computed(() => ({
  transform: `scale(${zoomLevel.value}) translate(${panX.value}px, ${panY.value}px)`,
  transformOrigin: '0 0'
}))

// Methods
const getNodeColor = (type: string): string => {
  const colors = {
    start: '#4CAF50',
    process: '#2196F3',
    decision: '#FF9800',
    end: '#F44336'
  }
  return colors[type as keyof typeof colors] || '#9E9E9E'
}

const selectNode = (node: WorkflowNode) => {
  selectedNode.value = node
  emit('nodeSelected', node)
}

const addNode = (type: WorkflowNode['type']) => {
  const newNode: WorkflowNode = {
    id: `node-${Date.now()}`,
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    x: Math.random() * (canvasWidth.value - nodeWidth),
    y: Math.random() * (canvasHeight.value - nodeHeight)
  }

  nodes.value.push(newNode)
  emit('nodeAdded', newNode)
}

const getConnectionPath = (connection: NodeConnection): string => {
  const fromNode = nodes.value.find(n => n.id === connection.from)
  const toNode = nodes.value.find(n => n.id === connection.to)

  if (!fromNode || !toNode) return ''

  const x1 = fromNode.x + nodeWidth / 2
  const y1 = fromNode.y + nodeHeight
  const x2 = toNode.x + nodeWidth / 2
  const y2 = toNode.y

  return `M ${x1} ${y1} L ${x2} ${y2}`
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.3)
}

const resetZoom = () => {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

const onCanvasMouseDown = (event: MouseEvent) => {
  isDragging.value = true
  dragStart.value = { x: event.clientX - panX.value, y: event.clientY - panY.value }
}

const onCanvasMouseMove = (event: MouseEvent) => {
  if (isDragging.value) {
    panX.value = event.clientX - dragStart.value.x
    panY.value = event.clientY - dragStart.value.y
  }
}

const onCanvasMouseUp = () => {
  isDragging.value = false
}

const onCanvasWheel = (event: WheelEvent) => {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  zoomLevel.value = Math.max(0.3, Math.min(3, zoomLevel.value * delta))
}

// Lifecycle
onMounted(() => {
  if (canvasContainer.value) {
    canvasWidth.value = canvasContainer.value.clientWidth
    canvasHeight.value = canvasContainer.value.clientHeight
  }
})

onUnmounted(() => {
  // Cleanup if needed
})

// Expose methods for parent components
defineExpose({
  addNode,
  selectNode,
  zoomIn,
  zoomOut,
  resetZoom,
  nodes: readonly(nodes),
  connections: readonly(connections)
})
</script>

<style scoped>
.workflow-canvas {
  position: relative;
  width: 100%;
  height: 600px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}

.canvas-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  z-index: 10;
}

.canvas-content {
  position: relative;
  width: 100%;
  height: calc(100% - 60px);
  overflow: hidden;
  cursor: grab;
}

.canvas-content:active {
  cursor: grabbing;
}

.workflow-svg {
  display: block;
}

.workflow-node {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.workflow-node:hover {
  opacity: 0.8;
}

.node-text {
  font-size: 12px;
  font-weight: 500;
  fill: white;
  user-select: none;
  pointer-events: none;
}

.node-palette {
  position: absolute;
  top: 80px;
  right: 16px;
  z-index: 20;
}

@media (max-width: 768px) {
  .workflow-canvas {
    height: 400px;
  }

  .node-palette {
    top: 70px;
    right: 8px;
  }
}
</style>
