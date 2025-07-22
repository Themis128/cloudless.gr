<template>
  <div class="admin-projects-container">
    <h1 class="admin-title">Project Management</h1>

    <div class="admin-panel">
      <div class="panel-actions">
        <button @click="showAddModal = true" class="add-project-button">Add New Project</button>
      </div>

      <div class="projects-table-container">
        <table class="projects-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in projects" :key="project.id">
              <td>{{ project.id }}</td>
              <td>{{ project.title }}</td>
              <td>{{ project.category }}</td>
              <td>
                <span :class="['status-badge', `status-${project.status}`]">
                  {{ project.status }}
                </span>
              </td>
              <td>{{ formatDate(project.createdAt) }}</td>
              <td class="actions-cell">
                <button @click="viewProject(project)" class="action-button view-btn">View</button>
                <button @click="editProject(project)" class="action-button edit-btn">Edit</button>
                <button @click="confirmDelete(project)" class="action-button delete-btn">
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="projects.length === 0">
              <td colspan="6" class="no-results">No projects found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-backdrop">
      <div class="modal-content">
        <h3>Confirm Delete</h3>
        <p>Are you sure you want to delete project "{{ selectedProject?.title }}"?</p>
        <p class="warning-text">This action cannot be undone.</p>

        <div class="modal-actions">
          <button @click="cancelDelete" class="cancel-button">Cancel</button>
          <button @click="deleteProject" class="confirm-delete-button">Delete Project</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Project Modal -->
    <div v-if="showAddModal || showEditModal" class="modal-backdrop">
      <div class="modal-content project-form-modal">
        <h3>{{ showEditModal ? 'Edit Project' : 'Add New Project' }}</h3>

        <form @submit.prevent="submitProjectForm" class="project-form">
          <div class="form-group">
            <label for="project-title">Title</label>
            <input
              type="text"
              id="project-title"
              v-model="projectForm.title"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="project-slug">Slug</label>
            <input
              type="text"
              id="project-slug"
              v-model="projectForm.slug"
              required
              class="form-input"
            />
            <small class="form-help">Used in URL, e.g., /projects/my-project</small>
          </div>

          <div class="form-group">
            <label for="project-category">Category</label>
            <select
              id="project-category"
              v-model="projectForm.category"
              required
              class="form-select"
            >
              <option value="web-development">Web Development</option>
              <option value="mobile-app">Mobile App</option>
              <option value="design">Design</option>
              <option value="machine-learning">Machine Learning</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="project-description">Description</label>
            <textarea
              id="project-description"
              v-model="projectForm.description"
              required
              class="form-textarea"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="project-image">Featured Image URL</label>
            <input
              type="text"
              id="project-image"
              v-model="projectForm.imageUrl"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="project-status">Status</label>
            <select id="project-status" v-model="projectForm.status" required class="form-select">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" @click="cancelProjectForm" class="cancel-button">Cancel</button>
            <button type="submit" class="submit-button">
              {{ showEditModal ? 'Update Project' : 'Add Project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';

interface Project {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  imageUrl?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
}

// Fetch projects from API
const projects = ref<Project[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

// Fetch projects on component mount
onMounted(async () => {
  try {
    isLoading.value = true;
    const response = (await $fetch('/api/projects')) as any;
    projects.value = response?.projects || [];
  } catch (err) {
    console.error('Error fetching projects:', err);
    error.value = 'Failed to load projects';
    // Fallback to sample data for demo
    projects.value = [
      {
        id: 1,
        title: 'E-commerce Website',
        slug: 'e-commerce-website',
        description: 'A full-featured e-commerce platform with product management and checkout.',
        category: 'web-development',
        imageUrl: '/images/projects/e-commerce.jpg',
        status: 'published',
        createdAt: '2024-01-15T08:30:00Z',
      },
      {
        id: 2,
        title: 'Mobile Fitness App',
        slug: 'mobile-fitness-app',
        description: 'A fitness tracking application for iOS and Android.',
        category: 'mobile-app',
        imageUrl: '/images/projects/fitness-app.jpg',
        status: 'published',
        createdAt: '2024-02-20T14:15:00Z',
      },
      {
        id: 3,
        title: 'AI Content Generator',
        slug: 'ai-content-generator',
        description: 'An AI-powered application that generates various types of content.',
        category: 'machine-learning',
        status: 'draft',
        createdAt: '2024-03-10T11:45:00Z',
      },
    ];
  } finally {
    isLoading.value = false;
  }
});

// State for modals
const showDeleteModal = ref(false);
const showAddModal = ref(false);
const showEditModal = ref(false);
const selectedProject = ref<Project | null>(null);

// Form state
const projectForm = reactive({
  id: 0,
  title: '',
  slug: '',
  description: '',
  category: 'web-development',
  imageUrl: '',
  status: 'draft' as 'draft' | 'published' | 'archived',
});

// Methods
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const viewProject = (project: Project): void => {
  // In a real app, this might navigate to the public view of the project
  window.open(`/projects/${project.slug}`, '_blank');
};

const editProject = (project: Project): void => {
  selectedProject.value = project;

  // Populate the form
  projectForm.id = project.id;
  projectForm.title = project.title;
  projectForm.slug = project.slug;
  projectForm.description = project.description;
  projectForm.category = project.category;
  projectForm.imageUrl = project.imageUrl || '';
  projectForm.status = project.status;

  showEditModal.value = true;
};

const confirmDelete = (project: Project): void => {
  selectedProject.value = project;
  showDeleteModal.value = true;
};

const cancelDelete = (): void => {
  showDeleteModal.value = false;
  selectedProject.value = null;
};

const deleteProject = (): void => {
  if (selectedProject.value) {
    // In a real app, this would call an API to delete the project
    projects.value = projects.value.filter((project) => project.id !== selectedProject.value?.id);
    showDeleteModal.value = false;
    selectedProject.value = null;
  }
};

const cancelProjectForm = (): void => {
  showAddModal.value = false;
  showEditModal.value = false;
  selectedProject.value = null;

  // Reset form
  projectForm.id = 0;
  projectForm.title = '';
  projectForm.slug = '';
  projectForm.description = '';
  projectForm.category = 'web-development';
  projectForm.imageUrl = '';
  projectForm.status = 'draft';
};

const submitProjectForm = (): void => {
  // Create new project object
  const projectData: Project = {
    id: showEditModal.value ? projectForm.id : Math.max(...projects.value.map((p) => p.id)) + 1,
    title: projectForm.title,
    slug: projectForm.slug,
    description: projectForm.description,
    category: projectForm.category,
    status: projectForm.status,
    createdAt: showEditModal.value
      ? selectedProject.value?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  };

  if (projectForm.imageUrl) {
    projectData.imageUrl = projectForm.imageUrl;
  }

  if (showEditModal.value) {
    // Update existing project
    const index = projects.value.findIndex((p) => p.id === projectForm.id);
    if (index !== -1) {
      projects.value[index] = projectData;
    }
  } else {
    // Add new project
    projects.value.push(projectData);
  }

  // Close modal and reset
  cancelProjectForm();
};
</script>

<style scoped>
.admin-projects-container {
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

.panel-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.add-project-button {
  background-color: #2563eb;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-project-button:hover {
  background-color: #1d4ed8;
}

.projects-table-container {
  overflow-x: auto;
}

.projects-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.projects-table th {
  background-color: #f1f5f9;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #334155;
  border-bottom: 2px solid #cbd5e1;
}

.projects-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
}

.projects-table tr:hover td {
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

.status-published {
  background-color: #dcfce7;
  color: #166534;
}

.status-draft {
  background-color: #f3f4f6;
  color: #4b5563;
}

.status-archived {
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

.project-form-modal {
  max-width: 600px;
}

.modal-content h3 {
  margin-top: 0;
  color: #1e40af;
  margin-bottom: 1.5rem;
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
  margin-top: 1.5rem;
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

.submit-button {
  padding: 0.5rem 1rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover {
  background-color: #1d4ed8;
}

/* Form Styles */
.project-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #334155;
}

.form-input,
.form-select,
.form-textarea {
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 0.95rem;
}

.form-help {
  font-size: 0.75rem;
  color: #64748b;
}

@media (max-width: 768px) {
  .project-form-modal {
    max-width: 90%;
  }
}
</style>
