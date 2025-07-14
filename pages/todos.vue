<template>
  <VApp>
    <VMain>
      <VContainer>
        <VBtn icon class="mb-4" to="/">
          <VIcon>mdi-arrow-left</VIcon>
        </VBtn>
        <h1 class="text-h4 mb-4">My Todos</h1>
        <VList>
          <VListItem
            v-for="todo in todos"
            :key="todo.id"
          >
            <VListItemContent>
              <VListItemTitle>{{ todo.title }}</VListItemTitle>
            </VListItemContent>
          </VListItem>
        </VList>
      </VContainer>
    </VMain>
  </VApp>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'

const todos = ref<any[]>([])
const supabase = useSupabase()

const getTodos = async () => {
  const { data, error } = await supabase.from('todos' as any).select()
  if (error) {
    console.error('Error fetching todos:', error)
  } else {
    todos.value = data || []
  }
}

onMounted(() => {
  getTodos()
  // Subscribe to real-time updates
  const subscription = supabase
    .channel('public:todos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, payload => {
      getTodos()
    })
    .subscribe()
})
</script>
