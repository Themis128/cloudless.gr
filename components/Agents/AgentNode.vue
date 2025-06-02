&lt;template> &lt;div class="workflow-node" :class="{ selected: isSelected }"> &lt;v-card>
&lt;v-card-title class="text-subtitle-1">
{{ agent.name }}
&lt;/v-card-title> &lt;v-card-text> &lt;div class="node-ports"> &lt;div class="input-ports"> &lt;div
v-for="port in inputPorts" :key="port.id" class="port input-port" :data-port-id="port.id">
{{ port.name }}
&lt;/div> &lt;/div> &lt;div class="output-ports"> &lt;div v-for="port in outputPorts" :key="port.id"
class="port output-port" :data-port-id="port.id">
{{ port.name }}
&lt;/div> &lt;/div> &lt;/div> &lt;/v-card-text> &lt;/v-card> &lt;/div> &lt;/template> &lt;script
setup lang="ts"> import type { Agent } from '~/types/agents' const props = defineProps<{ agent:
Agent isSelected?: boolean inputPorts?: Array<{ id: string; name: string }> outputPorts?: Array<{
id: string; name: string }> }>() &lt;/script> &lt;style scoped> .workflow-node { min-width: 200px;
border: 2px solid transparent; border-radius: 8px; } .workflow-node.selected { border-color:
var(--v-primary-base); } .node-ports { display: flex; justify-content: space-between; margin-top:
8px; } .port { padding: 4px 8px; margin: 4px 0; background: rgba(0,0,0,0.1); border-radius: 4px;
font-size: 0.875rem; cursor: pointer; } .input-port { margin-right: 8px; } .output-port {
margin-left: 8px; text-align: right; } &lt;/style>
