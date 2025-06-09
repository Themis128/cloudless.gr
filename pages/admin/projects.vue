<template>
  <v-container fluid class="admin-projects-container">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h3 font-weight-bold text-primary mb-6">Project Management</h1>
      </v-col>
    </v-row>

    <v-card elevation="4">
      <!-- Header with Add Button -->
      <v-card-title>
        <v-row align="center" class="pa-2">
          <v-col cols="12" class="text-right">
            <v-btn
              @click="showAddModal = true"
              color="primary"
              prepend-icon="mdi-plus"
              size="large"
            >
              Add New Project
            </v-btn>
          </v-col>
        </v-row>
      </v-card-title>

      <!-- Projects Data Table -->
      <v-data-table
        :headers="headers"
        :items="projects"
        :items-per-page="10"
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
          <v-btn
            icon="mdi-eye"
            variant="text"
            size="small"
            color="primary"
            @click="viewProject(item)"
          >
            <v-icon>mdi-eye</v-icon>
            <v-tooltip activator="parent" location="top">View Project</v-tooltip>
          </v-btn>

          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="warning"
            @click="editProject(item)"
          >
            <v-icon>mdi-pencil</v-icon>
            <v-tooltip activator="parent" location="top">Edit Project</v-tooltip>
          </v-btn>

          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="deleteProject(item)"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent" location="top">Delete Project</v-tooltip>
          </v-btn>
        </template>

        <!-- No data state -->
        <template v-slot:[`no-data`]>
          <div class="text-center pa-8">
            <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-folder-off</v-icon>
            <div class="text-h6 text-grey-darken-1">No projects found</div>
            <div class="text-body-2 text-grey">Add your first project to get started</div>
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
          <v-alert type="error" variant="tonal" class="mb-4">
            <v-alert-title>This action is irreversible!</v-alert-title>
            The project will be permanently deleted.
          </v-alert>

          <p class="text-body-1">
            Are you sure you want to delete project "<strong>{{ selectedProject?.title }}</strong
            >"?
          </p>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn @click="cancelDelete" variant="text"> Cancel </v-btn>
          <v-btn @click="deleteProject" color="error" variant="flat"> Delete Project </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add/Edit Project Dialog -->
    <v-dialog v-model="showProjectDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="text-h5 font-weight-bold">
          <v-icon :icon="showEditModal ? 'mdi-pencil' : 'mdi-plus'" class="mr-2"></v-icon>
          {{ showEditModal ? 'Edit Project' : 'Add New Project' }}
        </v-card-title>

        <v-card-text>
          <v-form @submit.prevent="submitProjectForm">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="projectForm.title"
                  label="Project Title"
                  prepend-inner-icon="mdi-format-title"
                  variant="outlined"
                  placeholder="Enter project title"
                  :rules="titleRules"
                  required
                ></v-text-field>
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="projectForm.slug"
                  label="URL Slug"
                  prepend-inner-icon="mdi-link"
                  variant="outlined"
                  placeholder="project-url-slug"
                  hint="Used in URL, e.g., /projects/my-project"
                  persistent-hint
                  :rules="slugRules"
                  required
                ></v-text-field>
              </v-col>

              <v-col cols="12">
                <v-select
                  v-model="projectForm.category"
                  label="Category"
                  prepend-inner-icon="mdi-tag"
                  variant="outlined"
                  :items="categoryOptions"
                  required
                ></v-select>
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="projectForm.description"
                  label="Description"
                  prepend-inner-icon="mdi-text"
                  variant="outlined"
                  placeholder="Enter project description"
                  rows="4"
                  :rules="descriptionRules"
                  required
                ></v-textarea>
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="projectForm.imageUrl"
                  label="Featured Image URL"
                  prepend-inner-icon="mdi-image"
                  variant="outlined"
                  placeholder="https://example.com/image.jpg"
                  hint="Optional: URL to project featured image"
                  persistent-hint
                ></v-text-field>
              </v-col>

              <v-col cols="12">
                <v-select
                  v-model="projectForm.status"
                  label="Status"
                  prepend-inner-icon="mdi-clock"
                  variant="outlined"
                  :items="statusOptions"
                  required
                ></v-select>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn @click="cancelProjectForm" variant="text"> Cancel </v-btn>
          <v-btn @click="submitProjectForm" color="primary" variant="flat">
            {{ showEditModal ? 'Update Project' : 'Add Project' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
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

  // Mock project data - would be fetched from API in a real app
  const projects = ref<Project[]>([
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
  ]);

  // State for modals
  const showDeleteModal = ref(false);
  const showAddModal = ref(false);
  const showEditModal = ref(false);
  const showProjectDialog = ref(false);
  const selectedProject = ref<Project | null>(null);

  // Data table headers
  const headers = [
    { title: 'Title', key: 'title', align: 'start' as const, sortable: true },
    { title: 'Category', key: 'category', align: 'start' as const, sortable: true },
    { title: 'Status', key: 'status', align: 'center' as const, sortable: true },
    { title: 'Created', key: 'createdAt', align: 'start' as const, sortable: true },
    { title: 'Actions', key: 'actions', align: 'center' as const, sortable: false },
  ];

  // Form options
  const categoryOptions = [
    { title: 'Web Development', value: 'web-development' },
    { title: 'Mobile App', value: 'mobile-app' },
    { title: 'Machine Learning', value: 'machine-learning' },
    { title: 'UI/UX Design', value: 'ui-ux-design' },
    { title: 'DevOps', value: 'devops' },
  ];

  const statusOptions = [
    { title: 'Draft', value: 'draft' },
    { title: 'Published', value: 'published' },
    { title: 'Archived', value: 'archived' },
  ];

  // Form data
  const projectForm = reactive<Partial<Project>>({
    title: '',
    slug: '',
    description: '',
    category: '',
    imageUrl: '',
    status: 'draft' as const,
  });

  // Form validation rules
  const titleRules = [
    (v: string) => !!v || 'Title is required',
    (v: string) => v.length >= 3 || 'Title must be at least 3 characters',
  ];

  const slugRules = [
    (v: string) => !!v || 'Slug is required',
    (v: string) =>
      /^[a-z0-9-]+$/.test(v) || 'Slug must contain only lowercase letters, numbers, and hyphens',
  ];

  const descriptionRules = [
    (v: string) => !!v || 'Description is required',
    (v: string) => v.length >= 10 || 'Description must be at least 10 characters',
  ];

  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Project actions
  const viewProject = (project: Project) => {
    // In a real app, this would navigate to the project view page
    console.log('Viewing project:', project);
  };

  const editProject = (project: Project) => {
    selectedProject.value = project;
    projectForm.id = project.id;
    projectForm.title = project.title;
    projectForm.slug = project.slug;
    projectForm.description = project.description;
    projectForm.category = project.category;
    projectForm.imageUrl = project.imageUrl;
    projectForm.status = project.status;
    showProjectDialog.value = true;
    showEditModal.value = true;
  };

  const deleteProject = (project: Project) => {
    selectedProject.value = project;
    showDeleteModal.value = true;
  };

  const confirmDelete = () => {
    if (selectedProject.value) {
      const index = projects.value.findIndex((p) => p.id === selectedProject.value!.id);
      if (index > -1) {
        projects.value.splice(index, 1);
      }
    }
    showDeleteModal.value = false;
    selectedProject.value = null;
  };

  const resetForm = () => {
    projectForm.id = undefined;
    projectForm.title = '';
    projectForm.slug = '';
    projectForm.description = '';
    projectForm.category = '';
    projectForm.imageUrl = '';
    projectForm.status = 'draft';
  };

  // Methods
  const cancelDelete = (): void => {
    showDeleteModal.value = false;
    selectedProject.value = null;
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
      id:
        showEditModal.value && projectForm.id !== undefined
          ? projectForm.id
          : Math.max(0, ...projects.value.map((p) => p.id)) + 1,
      title: projectForm.title || '',
      slug: projectForm.slug || '',
      description: projectForm.description || '',
      category: projectForm.category || '',
      status: (projectForm.status as 'draft' | 'published' | 'archived') || 'draft',
      createdAt: showEditModal.value
        ? selectedProject.value?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      imageUrl: projectForm.imageUrl || '',
    };

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
</style>
