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
        <select
          v-model="sortOption"
          @change="filterUsers"
          class="filter-select"
        >
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
                <button
                  @click="confirmDelete(user)"
                  class="action-button delete-btn"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit User Modal -->
    <div
      v-if="showAddUserModal || showEditUserModal"
      class="modal-overlay"
      @click="closeModal"
    >
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditUserModal ? 'Edit User' : 'Add New User' }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveUser">
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
              <label for="role">Role</label>
              <select id="role" v-model="userForm.role" class="form-select">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" v-model="userForm.status" class="form-select">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div class="modal-footer">
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
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Confirm Delete</h2>
          <button @click="cancelDelete" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>
            Are you sure you want to delete user "{{ userToDelete?.name }}"?
          </p>
          <p class="warning">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button @click="cancelDelete" class="cancel-btn">Cancel</button>
          <button @click="deleteUser" class="delete-btn">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

definePageMeta({
  middleware: 'admin',
})

// Reactive state
const users = ref([])
const filteredUsers = ref([])
const isLoading = ref(false)
const error = ref(null)
const searchTerm = ref('')
const roleFilter = ref('')
const sortOption = ref('name')
const showAddUserModal = ref(false)
const showEditUserModal = ref(false)
const showDeleteModal = ref(false)
const userForm = ref({
  name: '',
  email: '',
  role: 'user',
  status: 'active',
})
const userToDelete = ref(null)

// Fetch users
const fetchUsers = async () => {
  try {
    isLoading.value = true
    error.value = null
    const response = await $fetch('/api/admin/users')
    if (response.success) {
      users.value = response.users
      filterUsers()
    } else {
      error.value = response.message || 'Failed to fetch users'
    }
  } catch (err) {
    console.error('Error fetching users:', err)
    error.value = 'Failed to fetch users'
  } finally {
    isLoading.value = false
  }
}

// Filter and sort users
const filterUsers = () => {
  let filtered = [...users.value]

  // Search filter
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    filtered = filtered.filter(
      user =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    )
  }

  // Role filter
  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role === roleFilter.value)
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sortOption.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'email':
        return a.email.localeCompare(b.email)
      case 'createdAt':
        return new Date(b.createdAt) - new Date(a.createdAt)
      case 'role':
        return a.role.localeCompare(b.role)
      default:
        return 0
    }
  })

  filteredUsers.value = filtered
}

// Format date
const formatDate = dateString => {
  return new Date(dateString).toLocaleDateString()
}

// Modal functions
const closeModal = () => {
  showAddUserModal.value = false
  showEditUserModal.value = false
  resetUserForm()
}

const resetUserForm = () => {
  userForm.value = {
    name: '',
    email: '',
    role: 'user',
    status: 'active',
  }
}

const editUser = user => {
  userForm.value = { ...user }
  showEditUserModal.value = true
}

const saveUser = async () => {
  try {
    if (showEditUserModal.value) {
      await $fetch(`/api/admin/users/${userForm.value.id}`, {
        method: 'PUT',
        body: userForm.value,
      })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: userForm.value,
      })
    }
    await fetchUsers()
    closeModal()
  } catch (err) {
    console.error('Error saving user:', err)
    error.value = 'Failed to save user'
  }
}

const confirmDelete = user => {
  userToDelete.value = user
  showDeleteModal.value = true
}

const cancelDelete = () => {
  userToDelete.value = null
  showDeleteModal.value = false
}

const deleteUser = async () => {
  try {
    await $fetch(`/api/admin/users/${userToDelete.value.id}`, {
      method: 'DELETE',
    })
    await fetchUsers()
    cancelDelete()
  } catch (err) {
    console.error('Error deleting user:', err)
    error.value = 'Failed to delete user'
  }
}

// Initialize
onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.admin-users-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

.header p {
  color: #6b7280;
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
  align-items: center;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  min-width: 200px;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
}

.add-user-btn {
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
}

.add-user-btn:hover {
  background-color: #059669;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.error {
  color: #ef4444;
}

.users-table {
  background-color: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.users-table table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.users-table th {
  background-color: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.role-badge,
.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.role-badge.admin {
  background-color: #fef3c7;
  color: #92400e;
}

.role-badge.user {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-badge.active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background-color: #f3f4f6;
  color: #6b7280;
}

.status-badge.suspended {
  background-color: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.edit-btn {
  background-color: #3b82f6;
  color: white;
}

.edit-btn:hover {
  background-color: #2563eb;
}

.delete-btn {
  background-color: #ef4444;
  color: white;
}

.delete-btn:hover {
  background-color: #dc2626;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.close-btn:hover {
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background-color: #e5e7eb;
}

.save-btn {
  padding: 0.5rem 1rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.save-btn:hover {
  background-color: #059669;
}

.delete-btn {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.delete-btn:hover {
  background-color: #dc2626;
}

.warning {
  color: #ef4444;
  font-weight: 500;
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
    min-width: auto;
  }

  .users-table {
    overflow-x: auto;
  }

  .action-buttons {
    flex-direction: column;
  }
}
</style>
