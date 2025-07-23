<template>
  <div class="admin-roles-container">
    <div class="header">
      <h1>Role Management</h1>
      <p>Manage roles, permissions, and role assignments.</p>
    </div>

    <div class="controls">
      <div class="search-filters">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search roles..."
          class="search-input"
        />
        <select v-model="sortOption" @change="filterRoles" class="filter-select">
          <option value="name">Sort by Name</option>
          <option value="description">Sort by Description</option>
          <option value="createdAt">Sort by Date</option>
        </select>
      </div>
      <button @click="showAddRoleModal = true" class="add-role-btn">
        Add New Role
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      <p>Loading roles...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else class="roles-grid">
      <div v-for="role in filteredRoles" :key="role.id" class="role-card">
        <div class="role-header">
          <h3>{{ role.name }}</h3>
          <div class="role-actions">
            <button @click="editRole(role)" class="action-button edit-btn">
              Edit
            </button>
            <button @click="confirmDelete(role)" class="action-button delete-btn">
              Delete
            </button>
          </div>
        </div>
        <p class="role-description">{{ role.description }}</p>
        <div class="permissions-section">
          <h4>Permissions ({{ role.permissions?.length || 0 }})</h4>
          <div class="permissions-list">
            <span 
              v-for="permission in role.permissions" 
              :key="permission.id"
              class="permission-badge"
            >
              {{ permission.name }}
            </span>
          </div>
        </div>
        <div class="role-stats">
          <span class="stat">
            <strong>{{ role.userRoles?.length || 0 }}</strong> users assigned
          </span>
        </div>
      </div>
    </div>

    <!-- Add/Edit Role Modal -->
    <div v-if="showAddRoleModal || showEditRoleModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditRoleModal ? 'Edit Role' : 'Add New Role' }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <form @submit.prevent="saveRole" class="role-form">
          <div class="form-group">
            <label for="name">Role Name</label>
            <input
              id="name"
              v-model="roleForm.name"
              type="text"
              required
              class="form-input"
              placeholder="e.g., moderator, analyst"
            />
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="roleForm.description"
              class="form-textarea"
              placeholder="Describe the role's purpose and responsibilities"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Permissions</label>
            <div class="permissions-grid">
              <div v-for="category in permissionCategories" :key="category.name" class="permission-category">
                <h4>{{ category.label }}</h4>
                <div class="permission-checkboxes">
                  <label v-for="permission in category.permissions" :key="permission.id" class="permission-checkbox">
                    <input 
                      type="checkbox" 
                      :value="permission.id" 
                      v-model="roleForm.permissionIds"
                    />
                    <span class="permission-name">{{ permission.name }}</span>
                    <span class="permission-desc">{{ permission.description }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="save-btn">
              {{ showEditRoleModal ? 'Update' : 'Create' }}
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
          <p>Are you sure you want to delete role "{{ roleToDelete?.name }}"?</p>
          <p>This will remove the role from all users who have it assigned.</p>
        </div>
        <div class="modal-footer">
          <button @click="showDeleteModal = false" class="cancel-btn">
            Cancel
          </button>
          <button @click="deleteRole" class="delete-btn">
            Delete Role
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
  title: 'Role Management',
  layout: 'default',
  middleware: 'admin'
})

// RBAC integration
const { canManageRoles, isAdmin } = useRBAC()

// Check permissions on mount
onMounted(() => {
  if (!canManageRoles.value) {
    navigateTo('/dashboard')
  }
})

interface Permission {
  id: number
  name: string
  description: string
  resource: string
  action: string
}

interface Role {
  id: number
  name: string
  description: string
  permissions: Permission[]
  userRoles?: Array<{
    id: number
    user: {
      id: number
      name: string
      email: string
    }
  }>
}

// Fetch roles from API
const roles = ref<Role[]>([])
const allPermissions = ref<Permission[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch roles and permissions on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    
    // Fetch roles
    const rolesResponse = await $fetch('/api/admin/roles') as any
    roles.value = rolesResponse.data || []
    
    // Fetch all permissions
    const permissionsResponse = await $fetch('/api/admin/permissions') as any
    allPermissions.value = permissionsResponse.data || []
    
  } catch (err) {
    console.error('Error fetching data:', err)
    error.value = 'Failed to load data'
    // Fallback to sample data for demo
    roles.value = [
      {
        id: 1,
        name: 'admin',
        description: 'Full system administrator with all permissions',
        permissions: [
          { id: 1, name: 'admin:all', description: 'Full administrative access', resource: 'admin', action: 'all' }
        ]
      },
      {
        id: 2,
        name: 'user',
        description: 'Standard user with basic permissions',
        permissions: [
          { id: 2, name: 'user:read', description: 'Read user information', resource: 'user', action: 'read' },
          { id: 3, name: 'bot:read', description: 'Read bot information', resource: 'bot', action: 'read' }
        ]
      }
    ]
  } finally {
    isLoading.value = false
  }
})

// Filtering and sorting
const searchTerm = ref('')
const sortOption = ref('name')

const filteredRoles = computed(() => {
  let filtered = roles.value

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase()
    filtered = filtered.filter(role =>
      role.name.toLowerCase().includes(search) ||
      role.description.toLowerCase().includes(search)
    )
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortOption.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'description':
        return a.description.localeCompare(b.description)
      case 'createdAt':
        return 0 // Add createdAt field if needed
      default:
        return 0
    }
  })

  return filtered
})

const filterRoles = () => {
  // This function is called when sort option changes
}

// Permission categories for better organization
const permissionCategories = computed(() => {
  const categories = [
    { name: 'user', label: 'User Management' },
    { name: 'bot', label: 'Bot Management' },
    { name: 'model', label: 'Model Management' },
    { name: 'pipeline', label: 'Pipeline Management' },
    { name: 'admin', label: 'Administrative' }
  ]

  return categories.map(category => ({
    ...category,
    permissions: allPermissions.value.filter(p => p.resource === category.name)
  }))
})

// Modal states
const showAddRoleModal = ref(false)
const showEditRoleModal = ref(false)
const showDeleteModal = ref(false)
const roleToDelete = ref<Role | null>(null)

// Form data
const roleForm = ref<{
  id?: number
  name: string
  description: string
  permissionIds: number[]
}>({
  name: '',
  description: '',
  permissionIds: []
})

const editRole = (role: Role) => {
  roleForm.value = {
    id: role.id,
    name: role.name,
    description: role.description,
    permissionIds: role.permissions.map(p => p.id)
  }
  showEditRoleModal.value = true
}

const confirmDelete = (role: Role) => {
  roleToDelete.value = role
  showDeleteModal.value = true
}

const closeModal = () => {
  showAddRoleModal.value = false
  showEditRoleModal.value = false
  showDeleteModal.value = false
  roleToDelete.value = null
  roleForm.value = {
    name: '',
    description: '',
    permissionIds: []
  }
}

const saveRole = async () => {
  try {
    if (showEditRoleModal.value) {
      // Update existing role
      await $fetch(`/api/admin/roles/${roleForm.value.id}`, {
        method: 'PUT',
        body: roleForm.value
      })
    } else {
      // Create new role
      await $fetch('/api/admin/roles', {
        method: 'POST',
        body: roleForm.value
      })
    }
    
    // Refresh roles list
    const response = await $fetch('/api/admin/roles') as any
    roles.value = response.data || []
    
    closeModal()
  } catch (err) {
    console.error('Error saving role:', err)
    alert('Failed to save role')
  }
}

const deleteRole = async () => {
  if (!roleToDelete.value) return

  try {
    await $fetch(`/api/admin/roles/${roleToDelete.value.id}`, {
      method: 'DELETE'
    })
    
    // Remove role from list
    roles.value = roles.value.filter(role => role.id !== roleToDelete.value!.id)
    
    closeModal()
  } catch (err) {
    console.error('Error deleting role:', err)
    alert('Failed to delete role')
  }
}
</script>

<style scoped>
.admin-roles-container {
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

.add-role-btn {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-role-btn:hover {
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

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.role-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.role-header h3 {
  margin: 0;
  color: #1e40af;
  font-size: 1.25rem;
  font-weight: 600;
}

.role-actions {
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

.role-description {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.permissions-section {
  margin-bottom: 1rem;
}

.permissions-section h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.permission-badge {
  background: #f3f4f6;
  color: #374151;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-stats {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.stat {
  color: #64748b;
  font-size: 0.875rem;
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
  max-width: 800px;
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

.role-form {
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
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 1rem;
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.permissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 1rem;
}

.permission-category h4 {
  margin: 0 0 0.5rem 0;
  color: #1e40af;
  font-size: 0.875rem;
  font-weight: 600;
}

.permission-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.permission-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.permission-checkbox:hover {
  background: #f9fafb;
}

.permission-checkbox input[type="checkbox"] {
  margin-top: 0.125rem;
}

.permission-name {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.permission-desc {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 0.125rem;
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
  
  .roles-grid {
    grid-template-columns: 1fr;
  }
  
  .permissions-grid {
    grid-template-columns: 1fr;
  }
}
</style> 