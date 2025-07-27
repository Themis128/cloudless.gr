<template>
  <v-container class="todos-page">
    <div class="text-center mb-8">
      <h1 class="text-h2 font-weight-bold mb-4">My Todos</h1>
      <p class="text-body-1 text-medium-emphasis">
        Track your tasks and stay organized
      </p>
    </div>

    <v-row>
      <v-col cols="12">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4"> Task List </v-card-title>
          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-6">
              Manage your tasks and track your progress
            </p>

            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="64" />
              <p class="mt-4">Loading todos...</p>
            </div>

            <div v-else-if="error" class="text-center py-8">
              <v-alert type="error" variant="tonal">
                {{ error }}
              </v-alert>
            </div>

            <div v-else>
              <div v-if="todos.length > 0">
                <v-card
                  v-for="todo in todos"
                  :key="todo.id"
                  class="mb-4"
                  variant="outlined"
                >
                  <v-card-text>
                    <div class="d-flex align-center justify-space-between">
                      <v-checkbox
                        v-model="todo.is_complete"
                        :label="todo.title"
                        :class="{
                          'text-decoration-line-through': todo.is_complete,
                        }"
                        @change="() => updateTodo(todo)"
                      />
                      <span class="text-caption text-medium-emphasis">
                        {{ formatDate(todo.created_at) }}
                      </span>
                    </div>
                  </v-card-text>
                </v-card>
              </div>

              <v-alert v-else type="info" variant="tonal" class="text-center">
                No todos found. Start by creating your first task!
              </v-alert>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface Todo {
  id: number
  title: string
  is_complete: boolean
  created_at: string
  updated_at: string
}

const todos = ref<Todo[]>([])
const loading = ref(true)
const error = ref('')

const getTodos = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await $fetch<{
      success: boolean
      data: Todo[]
      message?: string
    }>('/api/prisma/todos')

    if (response.success) {
      todos.value = response.data || []
    } else {
      error.value = response.message || 'Failed to fetch todos'
    }
  } catch (err: any) {
    console.error('Error fetching todos:', err)
    error.value = err.message || 'Failed to load todos'
  } finally {
    loading.value = false
  }
}

const updateTodo = async (todo: Todo) => {
  try {
    const response = await $fetch<{
      success: boolean
      data: Todo
      message?: string
    }>(`/api/prisma/todos/${todo.id}`, {
      method: 'PUT',
      body: { is_complete: todo.is_complete },
    })

    if (response.success) {
      // Update the local todo with the response data
      const index = todos.value.findIndex(t => t.id === todo.id)
      if (index !== -1) {
        todos.value[index] = response.data
      }
    } else {
      console.error('Failed to update todo:', response.message)
    }
  } catch (err: any) {
    console.error('Error updating todo:', err)
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  getTodos()
})
</script>

<style scoped>
.todos-page {
  max-width: 800px;
  margin: 0 auto;
}
</style>
