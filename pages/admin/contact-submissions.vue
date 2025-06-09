<template>
  <v-container fluid>
    <v-row class="mb-4" align="center">
      <v-col cols="12" md="6">
        <v-select
          v-model="statusFilter"
          :items="statusOptions"
          label="Filter by Status"
          @change="fetchSubmissions"
          variant="outlined"
          class="mb-4"
        />
      </v-col>
    </v-row>
    <v-row v-if="loading" justify="center">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
        <div>Loading submissions...</div>
      </v-col>
    </v-row>
    <v-row v-else-if="submissions.length === 0" justify="center">
      <v-col cols="12" class="text-center">
        <v-alert type="info" variant="tonal">No submissions found.</v-alert>
      </v-col>
    </v-row>
    <v-row v-else>
      <v-col cols="12">
        <v-data-table
          :headers="headers"
          :items="submissions"
          :loading="loading"
          class="elevation-1"
          item-value="id"
        >
          <template #[`item.status`]="{ item }">
            <v-chip :color="statusColor(item.status)" size="small">{{ item.status }}</v-chip>
          </template>
          <template #[`item.actions`]="{ item }">
            <v-btn icon size="small" @click="openDetails(item)">
              <v-icon>mdi-eye</v-icon>
            </v-btn>
            <v-btn icon size="small" @click="confirmDelete(item.id)">
              <v-icon color="red">mdi-delete</v-icon>
            </v-btn>
          </template>
          <template #[`item.createdAt`]="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>
        </v-data-table>

        <!-- Pagination -->
        <v-pagination
          v-if="totalPages > 1"
          v-model="currentPage"
          :length="totalPages"
          @update:model-value="changePage"
          class="mt-4"
        />
      </v-col>
    </v-row>
    <v-dialog v-model="detailsDialog" max-width="600">
      <v-card>
        <v-card-title>Submission Details</v-card-title>
        <v-card-text v-if="selectedSubmission">
          <div>
            <strong>From:</strong> {{ selectedSubmission.name }} ({{ selectedSubmission.email }})
          </div>
          <div><strong>Subject:</strong> {{ selectedSubmission.subject }}</div>
          <div><strong>Message:</strong></div>
          <div class="mb-2">{{ selectedSubmission.message }}</div>
          <div v-if="selectedSubmission.metadata">
            <div v-if="parsedMetadata(selectedSubmission.metadata).ip">
              <strong>IP:</strong> {{ parsedMetadata(selectedSubmission.metadata).ip }}
            </div>
            <div v-if="parsedMetadata(selectedSubmission.metadata).userAgent">
              <strong>Browser:</strong> {{ parsedMetadata(selectedSubmission.metadata).userAgent }}
            </div>
            <div v-if="parsedMetadata(selectedSubmission.metadata).referrer">
              <strong>Referrer:</strong> {{ parsedMetadata(selectedSubmission.metadata).referrer }}
            </div>
            <div v-if="parsedMetadata(selectedSubmission.metadata).submissionTime">
              <strong>Exact Time:</strong>
              {{ formatExactTime(parsedMetadata(selectedSubmission.metadata).submissionTime) }}
            </div>
          </div>
          <v-textarea
            v-model="notesMap[selectedSubmission.id]"
            label="Notes"
            placeholder="Add notes here..."
            @blur="updateNotes(selectedSubmission.id)"
            rows="2"
            variant="outlined"
            class="mt-2"
          />

          <!-- Status Update -->
          <v-select
            :model-value="selectedSubmission.status"
            :items="statusOptions.slice(1)"
            label="Update Status"
            @update:model-value="(value) => updateStatus(selectedSubmission.id, value)"
            variant="outlined"
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="detailsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>Are you sure you want to delete this submission?</v-card-text>
        <v-card-actions>
          <v-btn color="grey" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red" variant="tonal" @click="deleteSubmission">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue';

  const submissions = ref<any[]>([]);
  const loading = ref<boolean>(true);
  const currentPage = ref<number>(1);
  const totalPages = ref<number>(1);
  const totalSubmissions = ref<number>(0);
  const statusFilter = ref<string>('');
  const notesMap = ref<Record<string, string>>({});

  // Dialogs
  const detailsDialog = ref(false);
  const deleteDialog = ref(false);
  const selectedSubmission = ref<any>(null);
  let deleteId: string | null = null;

  // Status options for the filter
  const statusOptions = [
    { title: 'All Statuses', value: '' },
    { title: 'New', value: 'new' },
    { title: 'Read', value: 'read' },
    { title: 'Replied', value: 'replied' },
    { title: 'Archived', value: 'archived' },
  ];

  // Table headers for the data table
  const headers = [
    { title: 'Subject', key: 'subject' },
    { title: 'From', key: 'name' },
    { title: 'Email', key: 'email' },
    { title: 'Status', key: 'status' },
    { title: 'Date', key: 'createdAt' },
    { title: 'Actions', key: 'actions', sortable: false },
  ];

  // Function to parse metadata JSON string
  const parsedMetadata = (metadataString: string): any => {
    if (!metadataString) return {};
    try {
      return JSON.parse(metadataString);
    } catch {
      console.error('Error parsing metadata');
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
    } catch {
      return timeString;
    }
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
    deleteId = id;
    deleteDialog.value = true;
  };

  const deleteSubmission = async (): Promise<void> => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/contact-submissions/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete submission');
      }

      // Remove from local state
      submissions.value = submissions.value.filter((s) => s.id !== deleteId);
    } catch (error) {
      console.error('Error deleting submission:', error);
    } finally {
      deleteDialog.value = false;
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

  // Open details dialog
  const openDetails = (item: any): void => {
    selectedSubmission.value = item;
    detailsDialog.value = true;
  };

  // Get status color for chips
  const statusColor = (status: string): string => {
    switch (status) {
      case 'new':
        return 'blue';
      case 'read':
        return 'grey';
      case 'replied':
        return 'green';
      case 'archived':
        return 'orange';
      default:
        return 'grey';
    }
  };

  // Initial data fetch
  fetchSubmissions();
</script>

<style scoped>
  /* All custom styles for forms, tables, and buttons removed; rely on Vuetify */
</style>
