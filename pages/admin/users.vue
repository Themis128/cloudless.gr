<template>
  <div class="admin-users-container">
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
            Delete User
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.admin-users-container {
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
}

.search-input {
  flex: 1;
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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
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
    flex-direction: column;
    align-items: stretch;
  }
  
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
  }
}
</style>
