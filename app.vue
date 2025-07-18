<template>
  <NuxtLayout>
    <NuxtPage />
    <ul>
      <li v-for="todo in todos" :key="todo.id">
        {{ todo.name }}
      </li>
    </ul>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const supabase = useSupabase()
const todos = ref<any[]>([])

async function getTodos() {
  const { data } = await supabase.from('todos' as any).select()
  todos.value = data || []
}

onMounted(() => {
  getTodos()
})
</script>
