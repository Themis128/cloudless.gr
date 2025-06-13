<template>
  <v-container fluid class="pa-6">
    <v-row>
      <v-col cols="12">
        <v-sheet class="pa-4">
          <h1 class="text-h4">
            📦 Welcome,
            {{ displayName }}
          </h1>
        </v-sheet>
      </v-col>

      <v-col cols="12">
        <v-form @submit.prevent="uploadFile" class="d-flex flex-column align-start gap-2">
          <v-file-input
            v-model="selectedFile"
            ref="fileInput"
            density="comfortable"
            hide-details
            required
            class="mb-2"
          ></v-file-input>
          <v-btn color="primary" type="submit" size="large" elevation="4" class="upload-btn" rounded block>
            <v-icon start>mdi-cloud-upload</v-icon>
            Upload
          </v-btn>
        </v-form>
      </v-col>

      <v-col cols="12" v-if="uploading" class="d-flex align-center">
        <v-progress-circular indeterminate color="primary" class="me-2"></v-progress-circular>
        <span>Uploading...</span>
      </v-col>

      <v-col cols="12" v-if="successMessage">
        <v-alert type="success">{{ successMessage }}</v-alert>
      </v-col>

      <v-col 
        v-if="files.length"
        cols="12"
        md="4"
        lg="3"
        v-for="file in files"
        :key="file.name"
      >
        <v-card>
          <v-img v-if="isImage(file.name)" :src="fileUrls[file.name]" height="200px"></v-img>
          <v-card-text v-else class="text-center text--on-surface">
            📄 {{ file.name }}
          </v-card-text>
          <v-card-actions class="justify-space-between">
            <span class="text--on-surface ellipsis">{{ file.name }}</span>
            <v-btn icon @click="deleteFile(file.name)">
              <v-icon color="error">mdi-delete</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" v-else>
        <v-alert type="info">No files found.</v-alert>
      </v-col>

      <v-col cols="12" v-if="files.length">
        <v-table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.name">
              <td>{{ file.name }}</td>
              <td>{{ formatSize(file.metadata?.size) }}</td>
              <td>{{ formatDate(file.updated_at || file.created_at) }}</td>
              <td>
                <v-btn variant="text" :href="fileUrls[file.name]" target="_blank">View</v-btn>
                <v-btn icon @click="deleteFile(file.name)">
                  <v-icon color="error">mdi-delete</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSupabase } from '~/composables/useSupabase';
import { definePageMeta } from '#imports';

definePageMeta({ layout: 'user' });

const supabase = useSupabase();

const fileInput = ref<any>(null);
const selectedFile = ref<File | null>(null);
const files = ref<any[]>([]);
const fileUrls = ref<Record<string, string>>({});
const bucket = 'users';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 20;

const userProfile = ref<any>(null);
const folder = ref('');

const uploading = ref(false);
const successMessage = ref('');

const displayName = computed(() => {
  if (userProfile.value?.first_name && userProfile.value?.last_name) {
    return `${userProfile.value.first_name} ${userProfile.value.last_name}`;
  }
  return userProfile.value?.email || 'guest';
});

const fetchUserProfile = async () => {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    throw createError({ statusCode: 401, message: 'Not authenticated' });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', authUser.id)
    .single();
  userProfile.value = {
    ...authUser,
    ...profile
  };
  folder.value = `${authUser.id}/`;
};

const listFiles = async () => {
  if (!folder.value) return;
  const { data, error } = await supabase.storage.from(bucket).list(folder.value, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) console.error(error);
  files.value = data || [];
  fileUrls.value = {};
  for (const file of files.value) {
    fileUrls.value[file.name] = await getFileUrl(file.name);
  }
};

const uploadFile = async () => {
  if (!selectedFile.value) return;
  let file = selectedFile.value;
  const safeName = file.name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  if (safeName !== file.name) {
    file = new File([file], safeName, { type: file.type });
  }

  if (file.size > MAX_FILE_SIZE) {
    alert('File too large. Max size is 10MB.');
    return;
  }

  if (files.value.length >= MAX_FILES) {
    alert('Upload limit reached. Max 20 files allowed.');
    return;
  }

  const filePath = `${folder.value}${file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
  uploading.value = true;
  successMessage.value = '';

  try {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      upsert: true,
      cacheControl: '3600',
    });
    if (error) {
      uploading.value = false;
      return alert('Upload failed: ' + error.message);
    }
    await listFiles();
    if (fileInput.value) fileInput.value.reset();
    selectedFile.value = null;
    successMessage.value = 'Upload successful!';
    setTimeout(() => successMessage.value = '', 2500);
  } catch (e) {
    alert('Upload failed: ' + (e as Error).message);
  } finally {
    uploading.value = false;
  }
};

const deleteFile = async (name: string) => {
  const { error } = await supabase.storage.from(bucket).remove([`${folder.value}${name}`]);
  if (error) return alert('Delete failed: ' + error.message);
  await listFiles();
};

const getFileUrl = async (name: string) => {
  const filePath = `${folder.value}${name}`;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
  if (publicUrl && !publicUrl.includes('404')) return publicUrl;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60);
  if (data?.signedUrl) return data.signedUrl;
  return '';
};

const isImage = (name: string) => {
  return name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
};

function formatSize(size: number | undefined) {
  if (!size) return '-';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

onMounted(async () => {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    // Not authenticated, redirect to login
    window.location.href = '/auth/login';
    return;
  }
  await fetchUserProfile();
  await listFiles();
});
</script>