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

<script>
export default {
  layout: 'admin',
};
</script>

<script setup>
import { onMounted, ref } from 'vue';

// State management
const submissions = ref([]);
const loading = ref(true);
const currentPage = ref(1);
const totalPages = ref(1);
const totalSubmissions = ref(0);
const statusFilter = ref('');
const notesMap = ref({});
const isMetadataOpen = ref({});

// Function to parse metadata JSON string
const parsedMetadata = (metadataString) => {
  if (!metadataString) return {};
  try {
    return JSON.parse(metadataString);
  } catch (e) {
    console.error('Error parsing metadata:', e);
    return {};
  }
};

// Function to format exact submission time
const formatExactTime = (timeString) => {
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
const toggleMetadata = (id) => {
  isMetadataOpen.value[id] = !isMetadataOpen.value[id];
};

// Get auth token - in a real app, this would be from a proper auth system
const getAuthToken = () => {
  if (process.client) {
    return localStorage.getItem('admin_authenticated') === 'true' ? 'admin-token' : '';
  }
  return '';
};

// Fetch submissions from the API
const fetchSubmissions = async () => {
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
    data.submissions.forEach((submission) => {
      notesMap.value[submission.id] = submission.notes || '';
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
  } finally {
    loading.value = false;
  }
};

// Update submission status
const updateStatus = async (id, status) => {
  try {
    const response = await fetch('/api/contact-submissions', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ id, status }),
    });

    if (response.ok) {
      // Update the status in the local state
      const index = submissions.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        submissions.value[index].status = status;
      }
    } else {
      throw new Error('Failed to update status');
    }
  } catch (error) {
    console.error('Error updating status:', error);
    alert('Failed to update status. Please check your connection and try again.');
  }
};

// Update submission notes
const updateNotes = async (id) => {
  try {
    const notes = notesMap.value[id];
    const response = await fetch('/api/contact-submissions', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ id, notes }),
    });

    if (response.ok) {
      // Update the notes in the local state
      const index = submissions.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        submissions.value[index].notes = notes;
      }
    } else {
      throw new Error('Failed to update notes');
    }
  } catch (error) {
    console.error('Error updating notes:', error);
    alert('Failed to update notes. Please check your connection and try again.');
  }
};

// Delete a submission
const confirmDelete = async (id) => {
  if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
    try {
      const response = await fetch('/api/contact-submissions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        // Remove the submission from the local state
        submissions.value = submissions.value.filter((s) => s.id !== id);
        // If the current page is now empty and not the first page, go to the previous page
        if (submissions.value.length === 0 && currentPage.value > 1) {
          changePage(currentPage.value - 1);
        } else {
          // Otherwise, just refresh the current page
          fetchSubmissions();
        }
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  }
};

// Format date with Intl.DateTimeFormat
const formatDate = (dateString) => {
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
const changePage = (page) => {
  currentPage.value = page;
  fetchSubmissions();
};

// Initial data fetch
onMounted(() => {
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
  padding: 3rem;
  color: #64748b;
  font-size: 1.1rem;
}

.submissions-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.submission-card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}

.submission-card:hover {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.submission-header {
  padding: 1rem;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.submission-header h3 {
  font-size: 1.1rem;
  color: #1e293b;
  margin: 0;
}

.submission-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.date {
  color: #64748b;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.status.new {
  background-color: #eff6ff;
  color: #2563eb;
}

.status.read {
  background-color: #ecfdf5;
  color: #059669;
}

.status.replied {
  background-color: #f0fdfa;
  color: #0d9488;
}

.status.archived {
  background-color: #f1f5f9;
  color: #64748b;
}

.submission-body {
  padding: 1rem;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 1rem;
}

.submission-info p {
  margin: 0.5rem 0;
}

.message {
  background-color: #f8fafc;
  padding: 0.75rem;
  border-radius: 0.375rem;
  white-space: pre-wrap;
  color: #334155;
}

.submission-notes textarea {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  resize: vertical;
  font-family: inherit;
  color: #334155;
}

.submission-metadata {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed #e2e8f0;
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
  border-top: 1px solid #e2e8f0;
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.action-button.read {
  background-color: #eff6ff;
  color: #2563eb;
}

.action-button.read:hover {
  background-color: #dbeafe;
}

.action-button.replied {
  background-color: #ecfdf5;
  color: #059669;
}

.action-button.replied:hover {
  background-color: #d1fae5;
}

.action-button.archived {
  background-color: #f1f5f9;
  color: #64748b;
}

.action-button.archived:hover {
  background-color: #e2e8f0;
}

.action-button.delete {
  background-color: #fef2f2;
  color: #dc2626;
}

.action-button.delete:hover {
  background-color: #fee2e2;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  gap: 1rem;
}

.pagination-button {
  padding: 0.5rem 1rem;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.pagination-button:hover:not(:disabled) {
  background-color: #f1f5f9;
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: #64748b;
}

@media (max-width: 768px) {
  .submission-body {
    grid-template-columns: 1fr;
  }

  .submission-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .submission-meta {
    width: 100%;
    justify-content: space-between;
  }

  .submission-actions {
    flex-wrap: wrap;
  }

  .action-button {
    flex: 1;
    min-width: calc(50% - 0.25rem);
    text-align: center;
  }
}
</style>
