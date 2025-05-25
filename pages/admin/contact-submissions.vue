<template>
  <div class="admin-container">
    <div class="admin-header">
      <h1>Contact Submissions</h1>
      <div class="filters">
        <select v-model="statusFilter" @change="fetchSubmissions">
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading submissions...</div>

    <div v-else-if="submissions.length === 0" class="no-submissions">No submissions found.</div>

    <div v-else class="submissions-list">
      <div v-for="submission in submissions" :key="submission.id" class="submission-card">
        <div class="submission-header">
          <h3>{{ submission.subject }}</h3>
          <div class="submission-meta">
            <span class="date">{{ formatDate(submission.createdAt) }}</span>
            <span :class="['status', submission.status]">{{ submission.status }}</span>
          </div>
        </div>
        <div class="submission-body">
          <div class="submission-info">
            <p><strong>From:</strong> {{ submission.name }} ({{ submission.email }})</p>
            <p><strong>Message:</strong></p>
            <p class="message">{{ submission.message }}</p>

            <div v-if="submission.metadata" class="submission-metadata">
              <button @click="toggleMetadata(submission.id)" class="toggle-metadata-button">
                {{ isMetadataOpen[submission.id] ? 'Hide Details' : 'Show Submission Details' }}
              </button>
              <div v-if="isMetadataOpen[submission.id]" class="metadata-content">
                <p v-if="parsedMetadata(submission.metadata).ip">
                  <strong>IP:</strong> {{ parsedMetadata(submission.metadata).ip }}
                </p>
                <p v-if="parsedMetadata(submission.metadata).userAgent">
                  <strong>Browser:</strong> {{ parsedMetadata(submission.metadata).userAgent }}
                </p>
                <p v-if="parsedMetadata(submission.metadata).referrer">
                  <strong>Referrer:</strong> {{ parsedMetadata(submission.metadata).referrer }}
                </p>
                <p v-if="parsedMetadata(submission.metadata).submissionTime">
                  <strong>Exact Time:</strong>
                  {{ formatExactTime(parsedMetadata(submission.metadata).submissionTime) }}
                </p>
              </div>
            </div>
          </div>
          <div class="submission-notes">
            <textarea
              v-model="notesMap[submission.id]"
              placeholder="Add notes here..."
              @blur="updateNotes(submission.id)"
            ></textarea>
          </div>
        </div>
        <div class="submission-actions">
          <button
            v-if="submission.status === 'new'"
            @click="updateStatus(submission.id, 'read')"
            class="action-button read"
          >
            Mark as Read
          </button>
          <button
            v-if="submission.status === 'read' || submission.status === 'new'"
            @click="updateStatus(submission.id, 'replied')"
            class="action-button replied"
          >
            Mark as Replied
          </button>
          <button
            v-if="submission.status !== 'archived'"
            @click="updateStatus(submission.id, 'archived')"
            class="action-button archived"
          >
            Archive
          </button>
          <button @click="confirmDelete(submission.id)" class="action-button delete">Delete</button>
        </div>
      </div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
      <button
        :disabled="currentPage === 1"
        @click="changePage(currentPage - 1)"
        class="pagination-button"
      >
        Previous
      </button>
      <span class="pagination-info">Page {{ currentPage }} of {{ totalPages }}</span>
      <button
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
        class="pagination-button"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  layout: 'admin',
};
</script>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  notes?: string;
  metadata?: string;
  createdAt: string;
  updatedAt?: string;
}

interface SubmissionMetadata {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  submissionTime?: string;
  [key: string]: any;
}

interface PaginationInfo {
  page: number;
  pages: number;
  total: number;
}

// State management
const submissions = ref<ContactSubmission[]>([]);
const loading = ref<boolean>(true);
const currentPage = ref<number>(1);
const totalPages = ref<number>(1);
const totalSubmissions = ref<number>(0);
const statusFilter = ref<string>('');
const notesMap = ref<Record<string, string>>({});
const isMetadataOpen = ref<Record<string, boolean>>({});

// Function to parse metadata JSON string
const parsedMetadata = (metadataString: string): SubmissionMetadata => {
  if (!metadataString) return {};
  try {
    return JSON.parse(metadataString);
  } catch (e) {
    console.error('Error parsing metadata:', e);
    return {};
  }
};

// Function to format exact submission time
const formatExactTime = (timeString: string): string => {
  if (!timeString) return '';
  try {
    const date = new Date(timeString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch (e) {
    return timeString;
  }
};

// Toggle metadata visibility
const toggleMetadata = (id: string): void => {
  isMetadataOpen.value[id] = !isMetadataOpen.value[id];
};

// Get auth token - in a real app, this would be from a proper auth system
const getAuthToken = (): string => {
  if (process.client) {
    return localStorage.getItem('admin_authenticated') === 'true' ? 'admin-token' : '';
  }
  return '';
};

// Fetch submissions from the API
const fetchSubmissions = async (): Promise<void> => {
  loading.value = true;
  try {
    const response = await fetch(
      `/api/contact-submissions?page=${currentPage.value}&limit=10${
        statusFilter.value ? `&status=${statusFilter.value}` : ''
      }`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch submissions');
    }

    const data = await response.json();
    submissions.value = data.submissions;
    totalPages.value = data.pagination.pages;
    totalSubmissions.value = data.pagination.total;

    // Initialize notes map
    submissions.value.forEach((submission) => {
      if (submission.notes && !notesMap.value[submission.id]) {
        notesMap.value[submission.id] = submission.notes;
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
  } finally {
    loading.value = false;
  }
};

// Update submission status
const updateStatus = async (id: string, status: string): Promise<void> => {
  try {
    const response = await fetch(`/api/contact-submissions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update submission status');
    }

    // Update local state
    const index = submissions.value.findIndex((s) => s.id === id);
    if (index !== -1) {
      submissions.value[index].status = status as 'new' | 'read' | 'replied' | 'archived';
    }
  } catch (error) {
    console.error('Error updating submission status:', error);
  }
};

// Update submission notes
const updateNotes = async (id: string): Promise<void> => {
  const notes = notesMap.value[id];
  
  try {
    const response = await fetch(`/api/contact-submissions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error('Failed to update submission notes');
    }

    // Update was successful
    console.log('Notes updated successfully');
  } catch (error) {
    console.error('Error updating submission notes:', error);
  }
};

// Delete submission
const confirmDelete = async (id: string): Promise<void> => {
  if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/contact-submissions/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete submission');
    }

    // Remove from local state
    submissions.value = submissions.value.filter((s) => s.id !== id);
  } catch (error) {
    console.error('Error deleting submission:', error);
  }
};

// Format date for display
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Change page
const changePage = (page: number): void => {
  currentPage.value = page;
  fetchSubmissions();
};

// Initial data fetch
onMounted((): void => {
  fetchSubmissions();
});
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.admin-header h1 {
  font-size: 2rem;
  color: #1e40af;
}

.filters select {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.loading,
.no-submissions {
  text-align: center;
  padding: 3rem 0;
  color: #64748b;
  font-size: 1rem;
}

.submissions-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.submission-card {
  background-color: rgba(15, 23, 42, 0.7);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  color: white;
}

.submission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: rgba(30, 64, 175, 0.8);
}

.submission-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.submission-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.date {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
}

.status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-weight: 500;
  text-transform: uppercase;
}

.status.new {
  background-color: #2563eb;
  color: white;
}

.status.read {
  background-color: #9ca3af;
  color: white;
}

.status.replied {
  background-color: #059669;
  color: white;
}

.status.archived {
  background-color: #475569;
  color: white;
}

.submission-body {
  padding: 1rem;
}

.submission-info {
  margin-bottom: 1rem;
}

.submission-info p {
  margin: 0.5rem 0;
}

.submission-info p.message {
  white-space: pre-wrap;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-top: 0.5rem;
}

.submission-notes textarea {
  width: 100%;
  height: 80px;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.375rem;
  background-color: rgba(0, 0, 0, 0.2);
  color: white;
  resize: vertical;
}

.toggle-metadata-button {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-metadata-button:hover {
  background-color: #f1f5f9;
  color: #475569;
}

.metadata-content {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: #f8fafc;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #64748b;
}

.metadata-content p {
  margin: 0.375rem 0;
}

.submission-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background-color: #f8fafc;
  flex-wrap: wrap;
}

.action-button {
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button.read {
  background-color: #eff6ff;
  border-color: #93c5fd;
  color: #1e40af;
}

.action-button.read:hover {
  background-color: #dbeafe;
}

.action-button.replied {
  background-color: #ecfdf5;
  border-color: #6ee7b7;
  color: #065f46;
}

.action-button.replied:hover {
  background-color: #d1fae5;
}

.action-button.archived {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  color: #334155;
}

.action-button.archived:hover {
  background-color: #e2e8f0;
}

.action-button.delete {
  background-color: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
}

.action-button.delete:hover {
  background-color: #fecaca;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  gap: 1rem;
}

.pagination-button {
  background-color: #1e40af;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.875rem;
}

.pagination-button:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.pagination-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.pagination-info {
  color: #64748b;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .submission-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .submission-actions {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
    text-align: center;
  }
}
</style>
