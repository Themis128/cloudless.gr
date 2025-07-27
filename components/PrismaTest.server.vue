<template>
  <div class="p-6 bg-white rounded-lg shadow-md">
    <h2 class="text-2xl font-bold mb-4">Prisma Integration Test</h2>

    <div class="space-y-4">
      <div class="bg-blue-50 p-4 rounded">
        <h3 class="font-semibold text-blue-800">Database Status</h3>
        <p class="text-blue-600">Total submissions: {{ totalCount }}</p>
        <p class="text-blue-600">Last updated: {{ timestamp }}</p>
      </div>

      <div v-if="recentSubmissions.length > 0" class="bg-green-50 p-4 rounded">
        <h3 class="font-semibold text-green-800">Recent Submissions</h3>
        <ul class="space-y-2">
          <li v-for="submission in recentSubmissions" :key="submission.id" class="text-green-700">
            <strong>{{ submission.name }}</strong> - {{ submission.subject }}
            <span class="text-sm text-gray-500">({{ formatDate(submission.createdAt) }})</span>
          </li>
        </ul>
      </div>

      <div v-else class="bg-yellow-50 p-4 rounded">
        <p class="text-yellow-800">No submissions found in the database.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePrisma } from '~/composables/usePrisma'
// This is a server component that uses the usePrisma composable
const { prisma } = usePrisma();

// Fetch data on the server side
const totalCount = await prisma.contactSubmission.count();
const recentSubmissions = await prisma.contactSubmission.findMany({
  take: 3,
  orderBy: {
    createdAt: 'desc',
  },
  select: {
    id: true,
    name: true,
    subject: true,
    createdAt: true,
  },
});

const timestamp = new Date().toISOString();

// Helper function to format dates
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};
</script>
