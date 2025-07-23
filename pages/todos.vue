<template>
  <div class="todos-page">
    <div class="page-header">
      <h1>My Todos</h1>
      <p class="subtitle">
        Track your tasks and stay organized
      </p>
    </div>

    <div class="content-container">
      <div class="todos-content">
        <div class="todos-section">
          <div class="section-header">
            <h2>Task List</h2>
            <p>Manage your tasks and track your progress</p>
          </div>

          <div class="todos-list">
            <v-card v-for="todo in todos" :key="todo.id" class="bg-white">
              <v-card-text>
                <div class="todo-content">
                  <v-checkbox
                    v-model="todo.is_complete"
                    :label="todo.title"
                    :class="{ completed: todo.is_complete }"
                    @change="() => updateTodo(todo)"
                  />
                </div>
                <div class="todo-meta">
                  <span class="todo-date">{{ formatDate(todo.created_at) }}</span>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <v-alert v-if="todos.length === 0" type="info" class="no-todos">
            No todos found. Start by creating your first task!
          </v-alert>
        </div>
      </div>
    </div>
  </div>
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
    
    const response = await $fetch<{ success: boolean; data: Todo[]; message?: string }>('/api/prisma/todos')
    
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
    const response = await $fetch<{ success: boolean; data: Todo; message?: string }>(`/api/prisma/todos/${todo.id}`, {
      method: 'PUT',
      body: { is_complete: todo.is_complete }
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.content-container {
  background: transparent;
  padding: 0;
}

.todos-content {
  max-width: 800px;
  margin: 0 auto;
}

.todos-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-header {
  text-align: center;
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.section-header p {
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.todos-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}



.todo-content {
  margin-bottom: 0.5rem;
}

.todo-content .v-checkbox {
  margin: 0;
}

.todo-content .v-checkbox :deep(.v-label) {
  font-size: 1rem;
  color: rgba(0, 0, 0, 0.8);
}

.todo-content .completed :deep(.v-label) {
  text-decoration: line-through;
  color: rgba(0, 0, 0, 0.5);
}

.todo-meta {
  display: flex;
  justify-content: flex-end;
}

.todo-date {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
}

.no-todos {
  text-align: center;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .todos-page {
    padding: 1rem;
  }

  .content-container {
    padding: 2rem;
  }
}
</style>
