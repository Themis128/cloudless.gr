<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-6">Tree View Demo</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <UiTreeView
          title="Basic Tree View"
          :allow-add="true"
          :allow-refresh="true"
          @node-select="onNodeSelect"
          @node-add="onNodeAdd"
          @refresh="onRefresh"
        />
      </v-col>
      
      <v-col cols="12" md="6">
        <UiTreeView
          title="Custom Data Tree"
          :nodes="customTreeData"
          :allow-add="false"
          :multi-select="true"
          @node-select="onCustomNodeSelect"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <UiTreeView
          title="Flat Tree (No Card)"
          :flat="true"
          :show-header="false"
          @node-select="onFlatNodeSelect"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <v-card-title>Tree Events Log</v-card-title>
          <v-card-text>
            <div class="event-log">
              <div v-for="(event, index) in eventLog" :key="index" class="mb-2">
                <v-chip
                  :color="getEventColor(event.type)"
                  size="small"
                  class="me-2"
                >
                  {{ event.type }}
                </v-chip>
                <span class="text-body-2">{{ event.message }}</span>
                <span class="text-caption text-grey ms-2">{{ event.time }}</span>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useTreeView'

definePageMeta({
  title: 'Tree View Demo',
  layout: 'default'
})

interface EventLog {
  type: string
  message: string
  time: string
}

const eventLog = ref<EventLog[]>([])

// Custom tree data for demonstration
const customTreeData = ref<TreeNode[]>([
  {
    id: 'projects',
    text: 'Projects',
    icon: 'folder',
    children: [
      {
        id: 'web-app',
        text: 'Web Application',
        icon: 'folder',
        children: [
          { id: 'src', text: 'src/', icon: 'folder' },
          { id: 'public', text: 'public/', icon: 'folder' },
          { id: 'package', text: 'package.json', icon: 'file' }
        ]
      },
      {
        id: 'mobile-app',
        text: 'Mobile App',
        icon: 'folder',
        children: [
          { id: 'android', text: 'android/', icon: 'folder' },
          { id: 'ios', text: 'ios/', icon: 'folder' }
        ]
      }
    ]
  },
  {
    id: 'documents',
    text: 'Documents',
    icon: 'folder',
    children: [
      { id: 'readme', text: 'README.md', icon: 'file' },
      { id: 'license', text: 'LICENSE', icon: 'file' }
    ]
  }
])

const addEvent = (type: string, message: string) => {
  eventLog.value.unshift({
    type,
    message,
    time: new Date().toLocaleTimeString()
  })
  
  // Keep only last 10 events
  if (eventLog.value.length > 10) {
    eventLog.value = eventLog.value.slice(0, 10)
  }
}

const getEventColor = (type: string) => {
  switch (type) {
    case 'select': return 'primary'
    case 'add': return 'success'
    case 'refresh': return 'info'
    default: return 'grey'
  }
}

const onNodeSelect = (node: TreeNode) => {
  addEvent('select', `Selected: ${node.text} (ID: ${node.id})`)
}

const onCustomNodeSelect = (node: TreeNode) => {
  addEvent('select', `Custom tree selected: ${node.text}`)
}

const onFlatNodeSelect = (node: TreeNode) => {
  addEvent('select', `Flat tree selected: ${node.text}`)
}

const onNodeAdd = (parentId: string | number, text: string) => {
  addEvent('add', `Added "${text}" to parent: ${parentId}`)
}

const onRefresh = () => {
  addEvent('refresh', 'Tree refreshed')
}
</script>

<style scoped>
.event-log {
  max-height: 300px;
  overflow-y: auto;
}
</style>
