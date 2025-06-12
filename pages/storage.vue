<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">📦 My Files</h1>

    <!-- Upload Form -->
    <form @submit.prevent="uploadFile" class="flex gap-2 items-center mb-6">
      <input type="file" ref="fileInput" required />
      <button type="submit" class="btn">Upload</button>
    </form>

    <!-- File List -->
    <div v-if="files.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="file in files" :key="file.name" class="border p-4 rounded shadow-sm text-center">
        <div class="mb-2">
          <img
            v-if="isImage(file.name)"
            :src="getFileUrl(file.name)"
            alt="Preview"
            class="w-full h-32 object-cover rounded"
          />
          <div v-else class="text-sm text-gray-500">📄 {{ file.name }}</div>
        </div>
        <div class="text-sm break-words">{{ file.name }}</div>
        <button @click="deleteFile(file.name)" class="text-red-500 text-xs mt-2">🗑 Delete</button>
      </div>
    </div>

    <div v-else class="text-gray-500">No files found.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '~/composables/useSupabase';

const fileInput = ref<HTMLInputElement | null>(null);
const files = ref<any[]>([]);
const bucket = 'users';

const user = await supabase.auth.getUser().then((r) => r.data.user);

if (!user) {
  throw createError({ statusCode: 401, message: 'Not authenticated' });
}

const folder = `${user.id}/`;

const listFiles = async () => {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) console.error(error);
  files.value = data || [];
};

const uploadFile = async () => {
  if (!fileInput.value?.files?.[0]) return;
  const file = fileInput.value.files[0];
  const filePath = `${folder}${file.name}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    cacheControl: '3600',
  });
  if (error) return alert('Upload failed: ' + error.message);

  await listFiles();
  fileInput.value.value = '';
};

const deleteFile = async (name: string) => {
  const { error } = await supabase.storage.from(bucket).remove([`${folder}${name}`]);
  if (error) return alert('Delete failed: ' + error.message);
  await listFiles();
};

const getFileUrl = (name: string) => {
  return supabase.storage.from(bucket).getPublicUrl(`${folder}${name}`).data.publicUrl;
};

const isImage = (name: string) => {
  return name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
};

onMounted(listFiles);
</script>

<style scoped>
.btn {
  background-color: #2563eb; /* bg-blue-600 */
  color: #fff; /* text-white */
  padding: 0.25rem 1rem; /* px-4 py-1 */
  border-radius: 0.375rem; /* rounded */
  transition: background-color 0.2s;
}
.btn:hover {
  background-color: #1d4ed8; /* hover:bg-blue-700 */
}
</style>
