<template>
  <v-container fluid class="admin-users-container">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h3 font-weight-bold text-primary mb-6">User Management</h1>
      </v-col>
    </v-row>

    <v-card elevation="4">
      <!-- Search and Filter Section -->
      <v-card-title>
        <v-row align="center" class="pa-2">
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="searchTerm"
              append-inner-icon="mdi-magnify"
              label="Search users..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @input="filterUsers"
            />
          </v-col>
          <v-col cols="12" sm="3" md="2">
            <v-select
              v-model="filterStatus"
              :items="statusOptions"
              label="Status Filter"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="filterUsers"
            />
          </v-col>
          <v-col cols="12" sm="3" md="2">
            <v-select
              v-model="sortOption"
              :items="sortOptions"
              label="Sort By"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="filterUsers"
            />
          </v-col>
          <v-col cols="12" sm="12" md="4" class="text-right">
            <v-btn color="primary" prepend-icon="mdi-plus"> Add New User </v-btn>
          </v-col>
        </v-row>
      </v-card-title>

      <!-- Data Table -->
      <v-data-table
        :headers="headers"
        :items="paginatedUsers"
        :items-per-page="itemsPerPage"
        :items-length="totalUsers"
        v-model:page="currentPage"
        class="elevation-0"
        item-value="id"
      >
        <!-- Custom status column -->
        <template v-slot:[`item.status`]="{ item }">
          <v-chip :color="getStatusColor(item.status)" variant="flat" size="small" label>
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Custom date column -->
        <template v-slot:[`item.createdAt`]="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <!-- Actions column -->
        <template v-slot:[`item.actions`]="{ item }">
          <v-btn icon="mdi-eye" variant="text" size="small" color="primary" @click="viewUser(item)">
            <v-icon>mdi-eye</v-icon>
            <v-tooltip activator="parent" location="top">View User</v-tooltip>
          </v-btn>

          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="warning"
            @click="editUser(item)"
          >
            <v-icon>mdi-pencil</v-icon>
            <v-tooltip activator="parent" location="top">Edit User</v-tooltip>
          </v-btn>

          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="confirmDelete(item)"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent" location="top">Delete User</v-tooltip>
          </v-btn>
        </template>
        <!-- No data state -->
        <template v-slot:[`no-data`]>
          <div class="text-center pa-8">
            <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-off</v-icon>
            <div class="text-h6 text-grey-darken-1">No users found</div>
            <div class="text-body-2 text-grey">Try adjusting your search or filters</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteModal" max-width="500px" persistent>
      <v-card>
        <v-card-title class="text-h5 font-weight-bold">
          <v-icon icon="mdi-alert-circle" color="error" class="mr-2"></v-icon>
          Confirm Delete
        </v-card-title>

        <v-card-text>
          <p class="text-body-1 mb-2">
            Are you sure you want to delete user <strong>{{ selectedUser?.name }}</strong
            >?
          </p>
          <v-alert type="warning" variant="tonal" class="mb-0">
            This action cannot be undone.
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelDelete"> Cancel </v-btn>
          <v-btn color="error" variant="flat" @click="deleteUser"> Delete User </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';

  interface User {
    id: number;
    name: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    createdAt: string;
  }

  // Mock user data - would be fetched from API in a real app
  const users = ref<User[]>([
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      createdAt: '2024-01-15T08:30:00Z',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      status: 'active',
      createdAt: '2024-02-20T14:15:00Z',
    },
    {
      id: 3,
      name: 'Alex Johnson',
      email: 'alex@example.com',
      status: 'inactive',
      createdAt: '2024-03-10T11:45:00Z',
    },
    {
      id: 4,
      name: 'Maria Garcia',
      email: 'maria@example.com',
      status: 'suspended',
      createdAt: '2024-01-05T09:20:00Z',
    },
    {
      id: 5,
      name: 'Robert Wilson',
      email: 'robert@example.com',
      status: 'active',
      createdAt: '2024-04-01T16:30:00Z',
    },
  ]);

  // Table headers for Vuetify data table
  const headers = ref([
    { title: 'ID', key: 'id', sortable: true, width: '80px' },
    { title: 'Name', key: 'name', sortable: true },
    { title: 'Email', key: 'email', sortable: true },
    { title: 'Joined', key: 'createdAt', sortable: true },
    { title: 'Status', key: 'status', sortable: true },
    { title: 'Actions', key: 'actions', sortable: false, width: '150px' },
  ]);

  // Filter options
  const statusOptions = ref([
    { title: 'All Status', value: 'all' },
    { title: 'Active', value: 'active' },
    { title: 'Inactive', value: 'inactive' },
    { title: 'Suspended', value: 'suspended' },
  ]);

  const sortOptions = ref([
    { title: 'Newest First', value: 'newest' },
    { title: 'Oldest First', value: 'oldest' },
    { title: 'Name A-Z', value: 'name' },
  ]);

  // State
  const searchTerm = ref('');
  const filterStatus = ref('all');
  const sortOption = ref('newest');
  const currentPage = ref(1);
  const itemsPerPage = 10;
  const showDeleteModal = ref(false);
  const selectedUser = ref<User | null>(null);

  // Computed
  const filteredUsers = computed(() => {
    let result = [...users.value];

    // Apply search filter
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase();
      result = result.filter(
        (user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (filterStatus.value !== 'all') {
      result = result.filter((user) => user.status === filterStatus.value);
    }

    // Apply sorting
    if (sortOption.value === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOption.value === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOption.value === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  });

  const totalUsers = computed(() => filteredUsers.value.length);

  const paginatedUsers = computed(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.value.slice(startIndex, endIndex);
  });

  // Methods
  const filterUsers = () => {
    // Reset to first page when filters change
    currentPage.value = 1;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'suspended':
        return 'error';
      default:
        return 'grey';
    }
  };

  const viewUser = (user: User): void => {
    // In a real app, this would navigate to a user detail page
    console.log('View user:', user);
  };

  const editUser = (user: User): void => {
    // In a real app, this would navigate to a user edit page
    console.log('Edit user:', user);
  };

  const confirmDelete = (user: User): void => {
    selectedUser.value = user;
    showDeleteModal.value = true;
  };

  const cancelDelete = (): void => {
    showDeleteModal.value = false;
    selectedUser.value = null;
  };

  const deleteUser = (): void => {
    if (selectedUser.value) {
      // In a real app, this would call an API to delete the user
      users.value = users.value.filter((user) => user.id !== selectedUser.value?.id);
      showDeleteModal.value = false;
      selectedUser.value = null;
    }
  };

  onMounted(() => {
    // In a real app, this would fetch users from an API
    console.log('Admin users component mounted');
  });
</script>

<style scoped>
  .admin-users-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .admin-title {
    font-size: 2rem;
    margin-bottom: 1.5rem;
    color: #1e40af;
    font-weight: 700;
  }

  .admin-panel {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    border: 1px solid rgba(219, 234, 254, 0.6);
  }

  .filters-section {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    justify-content: space-between;
    align-items: center;
  }

  .search-bar {
    display: flex;
    flex: 1;
    min-width: 250px;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px 0 0 4px;
    outline: none;
    font-size: 0.95rem;
  }

  .search-button {
    background-color: #2563eb;
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .search-button:hover {
    background-color: #1d4ed8;
  }

  .filter-options {
    display: flex;
    gap: 0.75rem;
  }

  .filter-select {
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    outline: none;
    background-color: white;
    font-size: 0.95rem;
  }

  .users-table-container {
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .users-table th {
    background-color: #f1f5f9;
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: #334155;
    border-bottom: 2px solid #cbd5e1;
  }

  .users-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }

  .users-table tr:hover td {
    background-color: #f8fafc;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
    display: inline-block;
  }

  .status-active {
    background-color: #dcfce7;
    color: #166534;
  }

  .status-inactive {
    background-color: #f3f4f6;
    color: #4b5563;
  }

  .status-suspended {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  .actions-cell {
    white-space: nowrap;
  }

  .action-button {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    margin-right: 0.25rem;
    cursor: pointer;
  }

  .view-btn {
    background-color: #e0f2fe;
    color: #0369a1;
  }

  .view-btn:hover {
    background-color: #bae6fd;
  }

  .edit-btn {
    background-color: #fef3c7;
    color: #92400e;
  }

  .edit-btn:hover {
    background-color: #fde68a;
  }

  .delete-btn {
    background-color: #fee2e2;
    color: #b91c1c;
  }

  .delete-btn:hover {
    background-color: #fecaca;
  }

  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 1rem;
  }

  .page-info {
    margin: 0 1rem;
    color: #475569;
  }

  .pagination-button {
    padding: 0.5rem 1rem;
    background-color: #e2e8f0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: #334155;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .pagination-button:hover:not(:disabled) {
    background-color: #cbd5e1;
  }

  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .no-results {
    text-align: center;
    padding: 2rem 0;
    color: #64748b;
    font-style: italic;
  }
</style>
