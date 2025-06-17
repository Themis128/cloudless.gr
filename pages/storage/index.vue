<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">My Storage</h1>
    <v-form @submit.prevent>
      <v-file-input
        label="Upload File"
        prepend-icon="mdi-upload"
        show-size
        :loading="loading"
        @change="handleUpload"
      />
    </v-form>
    <v-alert v-if="error" type="error" class="my-4">{{ error }}</v-alert>
    <v-table v-if="files.length" class="mt-6">
      <thead>
        <tr>
          <th>File Name</th>
          <th>URL</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in files" :key="file.name">
          <td>{{ file.name }}</td>
          <td>
            <a
              v-if="file.url"
              :href="file.url"
              target="_blank"
              rel="noopener"
              :aria-label="`Open file ${file.name}`"
            >View</a>
            <v-progress-circular v-else indeterminate size="20" />
          </td>
        </tr>
      </tbody>
    </v-table>
    <div v-else class="text-grey">No files found.</div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useStorage } from '~/composables/useStorage'
import { useUserStore } from '~/stores/userStore'
definePageMeta({ layout: 'user' })

const { listFiles, uploadFile, getPublicUrl, loading, error } = useStorage()
const files = ref<any[]>([])
const userStore = useUserStore()
const userEmail = userStore.user?.email || ''

async function fetchFiles() {
  if (!userEmail) return
  const fileList = await listFiles('users', `${userEmail}/`)
  // Resolve public URLs for each file
  files.value = await Promise.all(
    fileList.map(async (file: any) => {
      const url = await getPublicUrl('users', `${userEmail}/${file.name}`)
      return { ...file, url }
    })
  )
}

async function handleUpload(fileList: FileList) {
  const file = fileList?.[0]
  if (file && userEmail) {
    await uploadFile('users', `${userEmail}/${file.name}`, file)
    await fetchFiles()
  }
}

// Refetch files when userEmail changes (e.g., after login)
watch(() => userStore.user?.email, (newEmail) => {
  if (newEmail) fetchFiles()
})

onMounted(fetchFiles)
</script>
