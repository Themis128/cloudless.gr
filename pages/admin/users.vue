<template>
  <div class="admin-users-container">
<<<<<<< HEAD
    <div class="header">
      <h1>User Management</h1>
      <p>Manage user accounts, roles, and permissions.</p>
    </div>

    <div class="controls">
      <div class="search-filters">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search users..."
          class="search-input"
        />
        <select v-model="roleFilter" class="filter-select">
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select v-model="sortOption" @change="filterUsers" class="filter-select">
          <option value="name">Sort by Name</option>
          <option value="email">Sort by Email</option>
          <option value="createdAt">Sort by Date</option>
          <option value="role">Sort by Role</option>
        </select>
      </div>
      <button @click="showAddUserModal = true" class="add-user-btn">
        Add New User
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      <p>Loading users...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else class="users-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Projects</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span :class="['role-badge', user.role]">
                {{ user.role }}
              </span>
            </td>
            <td>
              <span :class="['status-badge', user.status]">
                {{ user.status }}
              </span>
            </td>
            <td>{{ user._count?.projects || 0 }}</td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button @click="editUser(user)" class="action-button edit-btn">
                  Edit
                </button>
                <button @click="confirmDelete(user)" class="action-button delete-btn">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit User Modal -->
    <div v-if="showAddUserModal || showEditUserModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditUserModal ? 'Edit User' : 'Add New User' }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <form @submit.prevent="saveUser" class="user-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input
              id="name"
              v-model="userForm.name"
              type="text"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="userForm.email"
              type="email"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="userForm.password"
              type="password"
              :required="!showEditUserModal"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="role">Role</label>
            <select v-model="userForm.role" id="role" class="form-select">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
            </select>
          </div>
          <div v-if="canManageRoles" class="form-group">
            <label>Additional Roles</label>
            <div class="role-checkboxes">
              <label v-for="role in availableRoles" :key="role.id" class="role-checkbox">
                <input 
                  type="checkbox" 
                  :value="role.id" 
                  v-model="userForm.additionalRoles"
                />
                {{ role.name }}
              </label>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="save-btn">
              {{ showEditUserModal ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="showDeleteModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Confirm Delete</h2>
          <button @click="showDeleteModal = false" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete user "{{ userToDelete?.name }}"?</p>
          <p>This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button @click="showDeleteModal = false" class="cancel-btn">
            Cancel
          </button>
          <button @click="deleteUser" class="delete-btn">
=======
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
          <button @click="filterUsers" class="search-button">
            Search
          </button>
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
                <button @click="viewUser(user)" class="action-button view-btn">
                  View
                </button>
                <button @click="editUser(user)" class="action-button edit-btn">
                  Edit
                </button>
                <button 
                  @click="confirmDelete(user)" 
                  class="action-button delete-btn"
                >
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="6" class="no-results">
                No users found matching your criteria
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-controls">
        <button 
          @click="prevPage" 
          :disabled="currentPage === 1" 
          class="pagination-button"
        >
          Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button 
          @click="nextPage" 
          :disabled="currentPage >= totalPages" 
          class="pagination-button"
        >
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
          <button @click="cancelDelete" class="cancel-button">
            Cancel
          </button>
          <button @click="deleteUser" class="confirm-delete-button">
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
            Delete User
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
<<<<<<< HEAD
import { ref, computed, onMounted } from 'vue'
import { useRBAC } from '~/composables/useRBAC'

definePageMeta({
  title: 'User Management',
  layout: 'default',
  middleware: 'admin'
})

// RBAC integration
const { canManageUsers, canManageRoles, isAdmin } = useRBAC()

// Check permissions on mount
onMounted(() => {
  if (!canManageUsers.value) {
    navigateTo('/dashboard')
  }
})

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: {
    projects: number
    bots: number
    models: number
  }
  userRoles?: Array<{
    id: number
    role: {
      id: number
      name: string
      description: string
    }
    assignedAt: string
    expiresAt?: string
    isActive: boolean
  }>
}

interface Role {
  id: number
  name: string
  description: string
}

// Fetch users from API
const users = ref<User[]>([])
const availableRoles = ref<Role[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch users and roles on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    
    // Fetch users
    const response = await $fetch('/api/admin/users') as any
    users.value = response.data || []
    
    // Fetch available roles
    const rolesResponse = await $fetch('/api/admin/roles') as any
    availableRoles.value = rolesResponse.data || []
    
  } catch (err) {
    console.error('Error fetching data:', err)
    error.value = 'Failed to load data'
    // Fallback to sample data for demo
    users.value = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        _count: { projects: 5, bots: 2, models: 1 },
        userRoles: [
          {
            id: 1,
            role: { id: 1, name: 'admin', description: 'Full system administrator' },
            assignedAt: '2024-01-15T10:30:00Z',
            isActive: true
          }
        ]
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'user',
        status: 'active',
        createdAt: '2024-01-20T14:45:00Z',
        updatedAt: '2024-01-20T14:45:00Z',
        _count: { projects: 3, bots: 1, models: 0 },
        userRoles: [
          {
            id: 2,
            role: { id: 2, name: 'user', description: 'Standard user' },
            assignedAt: '2024-01-20T14:45:00Z',
            isActive: true
          }
        ]
      }
    ]
  } finally {
    isLoading.value = false
  }
})

// Filtering and sorting
const searchTerm = ref('')
const roleFilter = ref('')
const sortOption = ref('name')

const filteredUsers = computed(() => {
  let filtered = users.value

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    )
  }

  // Apply role filter
  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortOption.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'email':
        return a.email.localeCompare(b.email)
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'role':
        return a.role.localeCompare(b.role)
      default:
        return 0
    }
  })

  return filtered
})

const filterUsers = () => {
  // This function is called when sort option changes
  // The filtering is handled by the computed property
}

// Modal states
const showAddUserModal = ref(false)
const showEditUserModal = ref(false)
const showDeleteModal = ref(false)
const userToDelete = ref<User | null>(null)

// Form data
const userForm = ref<{
  id?: number
  name: string
  email: string
  password: string
  role: string
  additionalRoles: number[]
}>({
  name: '',
  email: '',
  password: '',
  role: 'user',
  additionalRoles: []
})

const editUser = (user: User) => {
  userForm.value = {
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    additionalRoles: user.userRoles?.map(ur => ur.role.id) || []
  }
  showEditUserModal.value = true
}

const confirmDelete = (user: User) => {
  userToDelete.value = user
  showDeleteModal.value = true
}

const closeModal = () => {
  showAddUserModal.value = false
  showEditUserModal.value = false
  showDeleteModal.value = false
  userToDelete.value = null
  userForm.value = {
    name: '',
    email: '',
    password: '',
    role: 'user',
    additionalRoles: []
  }
}

const saveUser = async () => {
  try {
    if (showEditUserModal.value) {
      // Update existing user
      await $fetch(`/api/admin/users/${userForm.value.id}`, {
        method: 'PUT',
        body: userForm.value
      })
    } else {
      // Create new user
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: userForm.value
      })
    }
    
    // Refresh users list
    const response = await $fetch('/api/admin/users') as any
    users.value = response.data || []
    
    closeModal()
  } catch (err) {
    console.error('Error saving user:', err)
    alert('Failed to save user')
  }
}

const deleteUser = async () => {
  if (!userToDelete.value) return

  try {
    await $fetch(`/api/admin/users/${userToDelete.value.id}`, {
      method: 'DELETE'
    })
    
    // Remove user from list
    users.value = users.value.filter(user => user.id !== userToDelete.value!.id)
    
    closeModal()
  } catch (err) {
    console.error('Error deleting user:', err)
    alert('Failed to delete user')
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
=======
import { ref, computed, onMounted } from 'vue';

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
    createdAt: '2024-01-15T08:30:00Z'
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'active',
    createdAt: '2024-02-20T14:15:00Z'
  },
  {
    id: 3,
    name: 'Alex Johnson',
    email: 'alex@example.com',
    status: 'inactive',
    createdAt: '2024-03-10T11:45:00Z'
  },
  {
    id: 4,
    name: 'Maria Garcia',
    email: 'maria@example.com',
    status: 'suspended',
    createdAt: '2024-01-05T09:20:00Z'
  },
  {
    id: 5,
    name: 'Robert Wilson',
    email: 'robert@example.com',
    status: 'active',
    createdAt: '2024-04-01T16:30:00Z'
  }
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
    result = result.filter(user => 
      user.name.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    );
  }
  
  // Apply status filter
  if (filterStatus.value !== 'all') {
    result = result.filter(user => user.status === filterStatus.value);
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
    day: 'numeric'
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
    users.value = users.value.filter(user => user.id !== selectedUser.value?.id);
    showDeleteModal.value = false;
    selectedUser.value = null;
  }
};

onMounted(() => {
  // In a real app, this would fetch users from an API
  console.log('Admin users component mounted');
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
</script>

<style scoped>
.admin-users-container {
<<<<<<< HEAD
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

.header p {
  color: #64748b;
  font-size: 1.1rem;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.search-filters {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.search-input,
.filter-select {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
=======
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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
}

.search-input {
  flex: 1;
<<<<<<< HEAD
  max-width: 300px;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.add-user-btn {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-user-btn:hover {
  background: #059669;
}

.loading,
.error {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}

.error {
  color: #ef4444;
}

.users-table {
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.role-badge,
.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.role-badge.admin {
  background: #fef3c7;
  color: #92400e;
}

.role-badge.user {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn {
  background: #3b82f6;
  color: white;
}

.edit-btn:hover {
  background: #2563eb;
}

.delete-btn {
  background: #ef4444;
  color: white;
}

.delete-btn:hover {
  background: #dc2626;
}

/* Modal Styles */
.modal-overlay {
=======
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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
<<<<<<< HEAD
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
=======
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  z-index: 1000;
}

.modal-content {
  background: white;
<<<<<<< HEAD
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  color: #1e40af;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #374151;
}

.user-form {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 1rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.cancel-btn,
.save-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #6b7280;
  color: white;
}

.cancel-btn:hover {
  background: #4b5563;
}

.save-btn {
  background: #10b981;
  color: white;
}

.save-btn:hover {
  background: #059669;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 1rem 0;
  color: #374151;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 2px solid #e5e7eb;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .controls {
=======
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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
    flex-direction: column;
    align-items: stretch;
  }
  
<<<<<<< HEAD
  .search-filters {
    flex-direction: column;
  }
  
  .search-input {
    max-width: none;
  }
  
  .users-table {
    overflow-x: auto;
  }
  
  .action-buttons {
    flex-direction: column;
=======
  .search-bar, .filter-options {
    width: 100%;
  }
  
  .filter-options {
    flex-wrap: wrap;
  }
  
  .filter-select {
    flex: 1;
    min-width: 120px;
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  }
}
</style>
