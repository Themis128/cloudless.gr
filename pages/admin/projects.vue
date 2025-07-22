<template>
  <div class="admin-projects-container">
    <div class="header">
      <h1>Project Management</h1>
      <p>Manage and organize your projects with full control over their lifecycle.</p>
    </div>

    <div class="controls">
      <div class="search-filters">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search projects..."
          class="search-input"
        />
        <select v-model="statusFilter" class="filter-select">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
          <option value="featured">Featured</option>
        </select>
        <select v-model="categoryFilter" class="filter-select">
          <option value="">All Categories</option>
          <option value="web-development">Web Development</option>
          <option value="mobile-app">Mobile App</option>
          <option value="design">Design</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button @click="showAddProjectModal = true" class="add-project-btn">
        Add New Project
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      <p>Loading projects...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else class="projects-grid">
      <div 
        v-for="project in filteredProjects" 
        :key="project.id"
        class="project-card"
      >
        <div class="project-header">
          <h3>{{ project.project_name }}</h3>
          <span :class="['status-badge', project.status]">
            {{ project.status }}
          </span>
        </div>
        
        <div class="project-content">
          <p class="project-overview">{{ project.overview }}</p>
          
          <div class="project-meta">
            <div class="meta-item">
              <span class="meta-label">Category:</span>
              <span class="meta-value">{{ project.category }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Created:</span>
              <span class="meta-value">{{ formatDate(project.createdAt) }}</span>
            </div>
            <div v-if="project.featured" class="meta-item">
              <span class="featured-badge">Featured</span>
            </div>
          </div>
        </div>

        <div class="project-actions">
          <button @click="viewProject(project)" class="action-btn view-btn">
            View
          </button>
          <button @click="editProject(project)" class="action-btn edit-btn">
            Edit
          </button>
          <button @click="confirmDelete(project)" class="action-btn delete-btn">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Project Modal -->
    <div v-if="showAddProjectModal || showEditProjectModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditProjectModal ? 'Edit Project' : 'Add New Project' }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <form @submit.prevent="saveProject" class="project-form">
          <div class="form-group">
            <label for="project_name">Project Name</label>
            <input
              id="project_name"
              v-model="projectForm.project_name"
              type="text"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="slug">Slug</label>
            <input
              id="slug"
              v-model="projectForm.slug"
              type="text"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="overview">Overview</label>
            <textarea
              id="overview"
              v-model="projectForm.overview"
              required
              rows="3"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="projectForm.description"
              required
              rows="5"
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="category">Category</label>
              <select v-model="projectForm.category" id="category" class="form-select">
                <option value="web-development">Web Development</option>
                <option value="mobile-app">Mobile App</option>
                <option value="design">Design</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="status">Status</label>
              <select v-model="projectForm.status" id="status" class="form-select">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="live_url">Live URL</label>
              <input
                id="live_url"
                v-model="projectForm.live_url"
                type="url"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="github_url">GitHub URL</label>
              <input
                id="github_url"
                v-model="projectForm.github_url"
                type="url"
                class="form-input"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="projectForm.featured"
                type="checkbox"
                class="form-checkbox"
              />
              Featured Project
            </label>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn">
              Cancel
            </button>
            <button type="submit" class="save-btn">
              {{ showEditProjectModal ? 'Update' : 'Create' }}
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
          <p>Are you sure you want to delete project "{{ projectToDelete?.project_name }}"?</p>
          <p>This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button @click="showDeleteModal = false" class="cancel-btn">
            Cancel
          </button>
          <button @click="deleteProject" class="delete-btn">
            Delete Project
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Nuxt.js composables are auto-imported
definePageMeta({
  title: 'Project Management'
})

interface Project {
  id: number
  project_name: string
  slug: string
  overview: string
  description: string
  status: string
  category: string
  featured: boolean
  live_url?: string
  github_url?: string
  createdAt: string
  updatedAt: string
}

// Fetch projects from API
const projects = ref<Project[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch projects on component mount
onMounted(async () => {
  try {
    isLoading.value = true
    const { projects: projectsData } = await $fetch('/api/projects') as any
    projects.value = projectsData || []
  } catch (err) {
    console.error('Error fetching projects:', err)
    error.value = 'Failed to load projects'
    // Fallback to sample data for demo
    projects.value = [
      {
        id: 1,
        project_name: 'E-commerce Platform',
        slug: 'ecommerce-platform',
        overview: 'A modern e-commerce platform built with Vue.js and Node.js',
        description: 'Full-featured e-commerce solution with payment processing, inventory management, and admin dashboard.',
        status: 'published',
        category: 'web-development',
        featured: true,
        live_url: 'https://example.com',
        github_url: 'https://github.com/example/ecommerce',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      },
      {
        id: 2,
        project_name: 'Mobile Task Manager',
        slug: 'mobile-task-manager',
        overview: 'Cross-platform mobile app for task management',
        description: 'React Native app with offline support, push notifications, and cloud sync.',
        status: 'published',
        category: 'mobile-app',
        featured: false,
        live_url: 'https://example.com/app',
        github_url: 'https://github.com/example/task-manager',
        createdAt: '2024-01-20T14:45:00Z',
        updatedAt: '2024-01-20T14:45:00Z'
      },
      {
        id: 3,
        project_name: 'Design System',
        slug: 'design-system',
        overview: 'Comprehensive design system for web applications',
        description: 'Component library with documentation, design tokens, and accessibility guidelines.',
        status: 'draft',
        category: 'design',
        featured: false,
        createdAt: '2024-01-25T09:15:00Z',
        updatedAt: '2024-01-25T09:15:00Z'
      }
    ]
  } finally {
    isLoading.value = false
  }
})

// Filtering and sorting
const searchTerm = ref('')
const statusFilter = ref('')
const categoryFilter = ref('')

const filteredProjects = computed(() => {
  let filtered = projects.value

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase()
    filtered = filtered.filter(project =>
      project.project_name.toLowerCase().includes(search) ||
      project.overview.toLowerCase().includes(search) ||
      project.description.toLowerCase().includes(search)
    )
  }

  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(project => project.status === statusFilter.value)
  }

  // Apply category filter
  if (categoryFilter.value) {
    filtered = filtered.filter(project => project.category === categoryFilter.value)
  }

  // Sort by creation date (newest first)
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return filtered
})

// Modal states
const showAddProjectModal = ref(false)
const showEditProjectModal = ref(false)
const showDeleteModal = ref(false)
const projectToDelete = ref<Project | null>(null)

// Form data
const projectForm = ref<{
  id?: number
  project_name: string
  slug: string
  overview: string
  description: string
  status: string
  category: string
  featured: boolean
  live_url: string
  github_url: string
}>({
  project_name: '',
  slug: '',
  overview: '',
  description: '',
  status: 'draft',
  category: 'web-development',
  featured: false,
  live_url: '',
  github_url: ''
})

const viewProject = (project: Project) => {
  // Navigate to project detail page
  navigateTo(`/projects/${project.slug}`)
}

const editProject = (project: Project) => {
  projectForm.value = {
    id: project.id,
    project_name: project.project_name,
    slug: project.slug,
    overview: project.overview,
    description: project.description,
    status: project.status,
    category: project.category,
    featured: project.featured,
    live_url: project.live_url || '',
    github_url: project.github_url || ''
  }
  showEditProjectModal.value = true
}

const confirmDelete = (project: Project) => {
  projectToDelete.value = project
  showDeleteModal.value = true
}

const closeModal = () => {
  showAddProjectModal.value = false
  showEditProjectModal.value = false
  showDeleteModal.value = false
  projectToDelete.value = null
  projectForm.value = {
    project_name: '',
    slug: '',
    overview: '',
    description: '',
    status: 'draft',
    category: 'web-development',
    featured: false,
    live_url: '',
    github_url: ''
  }
}

const saveProject = async () => {
  try {
    if (showEditProjectModal.value) {
      // Update existing project
      await $fetch(`/api/projects/${projectForm.value.id}`, {
        method: 'PUT',
        body: projectForm.value
      })
    } else {
      // Create new project
      await $fetch('/api/projects', {
        method: 'POST',
        body: projectForm.value
      })
    }
    
    // Refresh projects list
    const { projects: projectsData } = await $fetch('/api/projects') as any
    projects.value = projectsData || []
    
    closeModal()
  } catch (err) {
    console.error('Error saving project:', err)
    alert('Failed to save project')
  }
}

const deleteProject = async () => {
  if (!projectToDelete.value) return

  try {
    await $fetch(`/api/projects?id=${projectToDelete.value.id}`, {
      method: 'DELETE'
    })
    
    // Remove project from list
    projects.value = projects.value.filter(project => project.id !== projectToDelete.value!.id)
    
    closeModal()
  } catch (err) {
    console.error('Error deleting project:', err)
    alert('Failed to delete project')
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
.admin-projects-container {
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

.add-project-btn {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-project-btn:hover {
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: #1e40af;
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.1);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.project-header h3 {
  margin: 0;
  color: #1e40af;
  font-size: 1.25rem;
  flex: 1;
  margin-right: 1rem;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-badge.draft {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.published {
  background: #dcfce7;
  color: #166534;
}

.status-badge.archived {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.featured {
  background: #fef3c7;
  color: #92400e;
}

.project-content {
  margin-bottom: 1.5rem;
}

.project-overview {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.project-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.meta-value {
  color: #64748b;
  font-size: 0.875rem;
}

.featured-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.project-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.view-btn {
  background: #3b82f6;
  color: white;
}

.view-btn:hover {
  background: #2563eb;
}

.edit-btn {
  background: #f59e0b;
  color: white;
}

.edit-btn:hover {
  background: #d97706;
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
  max-width: 600px;
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

.project-form {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
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

.delete-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background: #dc2626;
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
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .project-actions {
    flex-direction: column;
  }
}
</style>

