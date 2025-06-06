<template>
  <v-container class="py-6">
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h4 pa-6">
            <v-icon icon="mdi-email-multiple" class="me-3"></v-icon>
            Contact Submissions
          </v-card-title>

          <v-card-text>
            <!-- Filters and Actions -->
            <v-row class="mb-4">
              <v-col cols="12" md="4">
                <v-select
                  v-model="statusFilter"
                  :items="statusOptions"
                  label="Filter by Status"
                  variant="outlined"
                  density="comfortable"
                  @update:model-value="loadSubmissions"
                />
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="searchQuery"
                  label="Search submissions..."
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  @update:model-value="debouncedSearch"
                />
              </v-col>

              <v-col cols="12" md="4" class="d-flex align-center">
                <v-btn
                  color="primary"
                  variant="outlined"
                  @click="loadSubmissions"
                  :loading="loading"
                >
                  <v-icon icon="mdi-refresh" class="me-2"></v-icon>
                  Refresh
                </v-btn>
              </v-col>
            </v-row>

            <!-- Data Table -->
            <v-data-table
              v-model:items-per-page="itemsPerPage"
              v-model:page="page"
              :headers="headers"
              :items="submissions"
              :loading="loading"
              :server-items-length="totalSubmissions"
              class="elevation-1"
              @update:options="loadSubmissions"
            >              <template v-slot:[`item.status`]="{ item }">
                <v-chip :color="getStatusColor(item.status)" size="small">
                  {{ item.status }}
                </v-chip>
              </template>

              <template v-slot:[`item.createdAt`]="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>

              <template v-slot:[`item.actions`]="{ item }">
                <v-btn icon="mdi-eye" variant="text" size="small" @click="viewSubmission(item)" />
                <v-btn icon="mdi-pencil" variant="text" size="small" @click="editSubmission(item)" />
                <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="deleteSubmission(item)" />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- View Dialog -->
    <v-dialog v-model="viewDialog" max-width="800px">
      <v-card v-if="selectedSubmission">
        <v-card-title class="text-h5">Contact Submission Details</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field label="Name" :model-value="selectedSubmission.name" readonly variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field label="Email" :model-value="selectedSubmission.email" readonly variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-text-field label="Subject" :model-value="selectedSubmission.subject" readonly variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-textarea label="Message" :model-value="selectedSubmission.message" readonly variant="outlined" rows="6" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="selectedSubmission.status" :items="statusOptions" label="Status" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field label="Created At" :model-value="formatDate(selectedSubmission.createdAt)" readonly variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="selectedSubmission.notes" label="Admin Notes" variant="outlined" rows="3" placeholder="Add internal notes about this submission..." />
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn color="grey-darken-1" variant="text" @click="viewDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="text" @click="updateSubmission" :loading="updating">Update</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete this contact submission? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="grey-darken-1" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="text" @click="confirmDelete" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  requiresAdmin: true,
  layout: 'admin',
});

const { $fetch } = useNuxtApp();

const loading = ref(false);
const updating = ref(false);
const deleting = ref(false);

const submissions = ref([]);
const totalSubmissions = ref(0);
const page = ref(1);
const itemsPerPage = ref(10);

const statusFilter = ref('all');
const searchQuery = ref('');

const viewDialog = ref(false);
const deleteDialog = ref(false);
const selectedSubmission = ref<any>(null);
const submissionToDelete = ref<any>(null);

const statusOptions = [
  { title: 'All Statuses', value: 'all' },
  { title: 'New', value: 'new' },
  { title: 'Read', value: 'read' },
  { title: 'Replied', value: 'replied' },
  { title: 'Archived', value: 'archived' },
];

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Subject', key: 'subject', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Created', key: 'createdAt', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false },
];

const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'new':
      return 'primary';
    case 'read':
      return 'info';
    case 'replied':
      return 'success';
    case 'archived':
      return 'grey';
    default:
      return 'primary';
  }
};

const loadSubmissions = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: itemsPerPage.value.toString(),
    });

    if (statusFilter.value !== 'all') {
      params.append('status', statusFilter.value);
    }

    if (searchQuery.value) {
      params.append('search', searchQuery.value);
    }    const response = await ($fetch as any)(`/api/contact-submissions?${params}`);
    submissions.value = response.submissions || [];
    totalSubmissions.value = response.total || 0;
  } catch (err) {
    console.error('Error loading submissions:', err);
  } finally {
    loading.value = false;
  }
};

const viewSubmission = (submission: any) => {
  selectedSubmission.value = { ...submission };
  viewDialog.value = true;

  if (submission.status === 'new') {
    selectedSubmission.value.status = 'read';
  }
};

const editSubmission = (submission: any) => viewSubmission(submission);

const deleteSubmission = (submission: any) => {
  submissionToDelete.value = submission;
  deleteDialog.value = true;
};

const confirmDelete = async () => {
  if (!submissionToDelete.value) return;
  deleting.value = true;
  try {    await ($fetch as any)(`/api/contact-submissions/${submissionToDelete.value.id}`, {
      method: 'DELETE',
    });
    submissions.value = submissions.value.filter(
      (s: any) => s.id !== submissionToDelete.value.id
    );
    totalSubmissions.value--;
    deleteDialog.value = false;
    submissionToDelete.value = null;
  } catch (err) {
    console.error('Error deleting submission:', err);
  } finally {
    deleting.value = false;
  }
};

const updateSubmission = async () => {
  if (!selectedSubmission.value) return;
  updating.value = true;
  try {    await ($fetch as any)(`/api/contact-submissions/${selectedSubmission.value.id}`, {
      method: 'PUT',
      body: {
        status: selectedSubmission.value.status,
        notes: selectedSubmission.value.notes,
      },
    });
    const index = submissions.value.findIndex(
      (s: any) => s.id === selectedSubmission.value.id
    );
    if (index !== -1) {
      submissions.value[index] = { ...selectedSubmission.value };
    }
    viewDialog.value = false;
  } catch (err) {
    console.error('Error updating submission:', err);
  } finally {
    updating.value = false;
  }
};

const debouncedSearch = useDebounceFn(() => {
  page.value = 1;
  loadSubmissions();
}, 500);

onMounted(() => {
  loadSubmissions();
});
</script>
