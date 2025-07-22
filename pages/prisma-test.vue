<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">Prisma Integration Test</h1>

    <!-- Server Component Example -->
    <div class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Server Component Example</h2>
      <PrismaTest />
    </div>

    <!-- API Test -->
    <div class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">API Test</h2>
      <div class="bg-gray-100 p-4 rounded">
        <button
          @click="testApi"
          :disabled="loading"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {{ loading ? 'Testing...' : 'Test Prisma API' }}
        </button>

        <div v-if="apiResult" class="mt-4">
          <h3 class="font-semibold">API Response:</h3>
          <pre class="bg-white p-4 rounded mt-2 overflow-auto text-sm">{{
            JSON.stringify(apiResult, null, 2)
          }}</pre>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="bg-blue-50 p-6 rounded-lg">
      <h2 class="text-xl font-semibold mb-4">How to Use @prisma/nuxt</h2>

      <div class="space-y-4">
        <div>
          <h3 class="font-semibold">1. In API Routes:</h3>
          <pre class="bg-white p-2 rounded text-sm">
import prisma from '~/server/utils/prisma'
const users = await prisma.user.findMany()</pre
          >
        </div>

        <div>
          <h3 class="font-semibold">2. In Server Components:</h3>
          <pre class="bg-white p-2 rounded text-sm">
const prisma = usePrismaClient()
const data = await prisma.model.findMany()</pre
          >
        </div>

        <div>
          <h3 class="font-semibold">3. Features Available:</h3>
          <ul class="list-disc list-inside space-y-1">
            <li>✅ Auto-imported composable</li>
            <li>✅ Global Prisma client instance</li>
            <li>✅ Prisma Studio integration</li>
            <li>✅ Automatic client generation</li>
            <li>✅ Type safety</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(false);
const apiResult = ref(null);

const testApi = async () => {
  loading.value = true;
  try {
    const response = await $fetch('/api/test-prisma');
    apiResult.value = response;
  } catch (error) {
    apiResult.value = { error: error.message };
  } finally {
    loading.value = false;
  }
};
</script>
