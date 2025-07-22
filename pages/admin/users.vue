<template>
  <div class="admin-users-container">
    <h1 class="admin-title">User Management</h1>

    <div class="admin-panel">
      <div class="filters-section">
        <div class="search-bar">
          <input
            type="text"
            v-model="searchTerm"
            placeholder="Search users..."
            class="search-input"
            @input="filterUsers"
          />
          <button @click="filterUsers" class="search-button">Search</button>
        </div>

        <div class="filter-options">
          <select v-model="filterStatus" @change="filterUsers" class="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>

          <select v-model="sortOption" @change="filterUsers" class="filter-select">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      <div class="users-table-container">
        <table class="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ formatDate(user.createdAt) }}</td>
              <td>
                <span :class="['status-badge', `status-${user.status}`]">
                  {{ user.status }}
                </span>
              </td>
              <td class="actions-cell">
                <button @click="viewUser(user)" class="action-button view-btn">View</button>
                <button @click="editUser(user)" class="action-button edit-btn">Edit</button>
                <button @click="confirmDelete(user)" class="action-button delete-btn">
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="6" class="no-results">No users found matching your criteria</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-controls">
        <button @click="prevPage" :disabled="currentPage === 1" class="pagination-button">
          Previous
        </button>
        <span class="page-info"> Page {{ currentPage }} of {{ totalPages }} </span>
        <button @click="nextPage" :disabled="currentPage >= totalPages" class="pagination-button">
          Next
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-backdrop">
      <div class="modal-content">
        <h3>Confirm Delete</h3>
        <p>Are you sure you want to delete user {{ selectedUser?.name }}?</p>
        <p class="warning-text">This action cannot be undone.</p>

        <div class="modal-actions">
          <button @click="cancelDelete" class="cancel-button">Cancel</button>
          <button @click="deleteUser" class="confirm-delete-button">Delete User</button>
        </div>
      </div>
    </div>
  </div>
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

// Fetch users from API
const users = ref<User[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

// Fetch users on component mount
onMounted(async () => {
  try {
    isLoading.value = true;
    const { data } = await $fetch('/api/admin/users');
    users.value = data || [];
  } catch (err) {
    console.error('Error fetching users:', err);
    error.value = 'Failed to load users';
    // Fallback to sample data for demo
    users.value = [
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
    ];
  } finally {
    isLoading.value = false;
  }
});

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
const totalPages = computed(() => Math.ceil(totalUsers.value / itemsPerPage));

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

const prevPage = (): void => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = (): void => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
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

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-content h3 {
  margin-top: 0;
  color: #1e40af;
}

.warning-text {
  color: #b91c1c;
  font-weight: 500;
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-button {
  padding: 0.5rem 1rem;
  background-color: #f1f5f9;
  color: #334155;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-delete-button {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.confirm-delete-button:hover {
  background-color: #dc2626;
}

@media (max-width: 768px) {
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }

  .search-bar,
  .filter-options {
    width: 100%;
  }

  .filter-options {
    flex-wrap: wrap;
  }

  .filter-select {
    flex: 1;
    min-width: 120px;
  }
}
</style>
