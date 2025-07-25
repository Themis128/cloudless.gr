# Projects Management System

The Projects Management System provides comprehensive functionality for creating, organizing, and showcasing development projects with full administrative capabilities.

## Overview

The system enables:

- **Project Creation & Management**: Full CRUD operations for projects
- **Categorization & Filtering**: Organize projects by category, status, and features
- **Featured Projects**: Highlight important or showcase projects
- **Admin Interface**: Complete administrative control over projects
- **Public Display**: Beautiful project listings and detail pages

## Key Components

### 1. Projects Composable

**Location**: `composables/useProjects.ts`

Central state management for project operations:

```typescript
import { useProjects } from '~/composables/useProjects';

const {
  projects, // All projects
  featuredProjects, // Featured projects only
  recentProjects, // Recently created projects
  isLoading, // Loading state
  error, // Error state
  fetchProjects, // Load projects with filtering
  fetchProjectBySlug, // Get single project
  createProject, // Create new project (admin)
  updateProject, // Update existing project (admin)
  deleteProject, // Delete project (admin)
} = useProjects();
```

### 2. Projects Pages

#### Main Projects Page

**Location**: `pages/projects.vue`

- Grid display of all projects
- Filtering by category and status
- Search functionality
- Featured projects section

#### Project Detail Page

**Location**: `pages/projects/[slug].vue`

- Individual project details
- Technology stack display
- Project content and description
- Related projects suggestions

#### Projects Index

**Location**: `pages/projects/index.vue`

- Overview of all projects
- Category navigation
- Featured projects carousel

### 3. Admin Interface

**Location**: `pages/admin/projects.vue`

Complete project management dashboard for administrators.

## Data Structure

### Project Model

```typescript
interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  content?: string;
  status: ProjectStatus;
  category: ProjectCategory;
  featured: boolean;
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string; // Project owner

  // Optional fields
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  priority?: number;
  tags?: string[];
}
```

### Project Status

```typescript
enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  ON_HOLD = 'on_hold',
}
```

### Project Categories

```typescript
enum ProjectCategory {
  WEB_DEVELOPMENT = 'web-development',
  MOBILE_APP = 'mobile-app',
  API_DEVELOPMENT = 'api-development',
  MACHINE_LEARNING = 'machine-learning',
  DEVOPS = 'devops',
  UI_UX_DESIGN = 'ui-ux-design',
  OTHER = 'other',
}
```

## Usage Examples

### 1. Basic Project Listing

```vue
<template>
  <div class="projects-container">
    <div v-if="isLoading">Loading projects...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div v-for="project in projects" :key="project.id" class="project-card">
        <h3>{{ project.title }}</h3>
        <p>{{ project.description }}</p>
        <div class="technologies">
          <span v-for="tech in project.technologies" :key="tech" class="tech-tag">
            {{ tech }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const { projects, isLoading, error, fetchProjects } = useProjects();

onMounted(() => {
  fetchProjects();
});
</script>
```

### 2. Featured Projects Display

```vue
<template>
  <section class="featured-projects">
    <h2>Featured Projects</h2>
    <div class="projects-grid">
      <NuxtLink
        v-for="project in featuredProjects"
        :key="project.id"
        :to="`/projects/${project.slug}`"
        class="featured-card"
      >
        <div class="project-image">
          <img :src="project.thumbnailUrl" :alt="project.title" />
        </div>
        <div class="project-info">
          <h3>{{ project.title }}</h3>
          <p>{{ project.description }}</p>
          <span class="category">{{ project.category }}</span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
const { featuredProjects } = useProjects();
</script>
```

### 3. Project Filtering

```vue
<template>
  <div class="project-filters">
    <select v-model="selectedCategory" @change="applyFilters">
      <option value="">All Categories</option>
      <option v-for="cat in categories" :key="cat" :value="cat">
        {{ formatCategory(cat) }}
      </option>
    </select>

    <select v-model="selectedStatus" @change="applyFilters">
      <option value="">All Status</option>
      <option v-for="status in statuses" :key="status" :value="status">
        {{ formatStatus(status) }}
      </option>
    </select>

    <label>
      <input type="checkbox" v-model="showFeaturedOnly" @change="applyFilters" />
      Featured Only
    </label>
  </div>
</template>

<script setup>
const { fetchProjects } = useProjects();

const selectedCategory = ref('');
const selectedStatus = ref('');
const showFeaturedOnly = ref(false);

const applyFilters = () => {
  const filters = {
    category: selectedCategory.value,
    status: selectedStatus.value,
    featured: showFeaturedOnly.value || undefined,
  };

  fetchProjects(filters);
};
</script>
```

## Admin Operations

### Creating Projects

```typescript
// Admin project creation
const createNewProject = async () => {
  try {
    const projectData = {
      title: 'New Web Application',
      description: 'A modern web application built with Vue.js',
      category: ProjectCategory.WEB_DEVELOPMENT,
      status: ProjectStatus.ACTIVE,
      featured: false,
      technologies: ['Vue.js', 'Nuxt.js', 'TypeScript'],
      content: 'Detailed project content...',
      githubUrl: 'https://github.com/username/project',
      liveUrl: 'https://project.example.com',
    };

    const newProject = await createProject(projectData);
    console.log('Project created:', newProject);
  } catch (error) {
    console.error('Failed to create project:', error);
  }
};
```

### Updating Projects

```typescript
// Admin project updates
const updateExistingProject = async (projectId: string) => {
  try {
    const updates = {
      status: ProjectStatus.COMPLETED,
      featured: true,
      priority: 1,
    };

    const updated = await updateProject(projectId, updates);
    console.log('Project updated:', updated);
  } catch (error) {
    console.error('Failed to update project:', error);
  }
};
```

### Bulk Operations

```typescript
// Bulk status updates
const bulkUpdateProjects = async (projectIds: string[], status: ProjectStatus) => {
  try {
    const promises = projectIds.map((id) => updateProject(id, { status }));

    await Promise.all(promises);
    console.log('Bulk update completed');
  } catch (error) {
    console.error('Bulk update failed:', error);
  }
};
```

## Advanced Features

### 1. Project Search

```typescript
const searchProjects = async (query: string) => {
  const filter = {
    search: query,
    limit: 20,
  };

  await fetchProjects(filter);
};
```

### 2. Project Analytics

```typescript
const getProjectStats = () => {
  const stats = {
    total: projects.value.length,
    featured: featuredProjects.value.length,
    byCategory: projects.value.reduce((acc, project) => {
      acc[project.category] = (acc[project.category] || 0) + 1;
      return acc;
    }, {}),
    byStatus: projects.value.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {}),
  };

  return stats;
};
```

### 3. Related Projects

```typescript
const getRelatedProjects = (currentProject: Project, limit = 3) => {
  return projects.value
    .filter(
      (p) =>
        p.id !== currentProject.id &&
        (p.category === currentProject.category ||
          p.technologies.some((tech) => currentProject.technologies.includes(tech)))
    )
    .slice(0, limit);
};
```

## API Integration

### Endpoints Used

- `GET /api/projects` - List projects with filtering
- `GET /api/projects/:slug` - Get project by slug
- `POST /api/projects` - Create project (admin)
- `PUT /api/projects/:id` - Update project (admin)
- `DELETE /api/projects/:id` - Delete project (admin)

### Error Handling

```typescript
const handleProjectError = (error: any) => {
  if (error.status === 404) {
    navigateTo('/404');
  } else if (error.status === 403) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied',
    });
  } else {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load projects',
    });
  }
};
```

## Performance Optimizations

### 1. Lazy Loading

```vue
<script setup>
// Lazy load projects on scroll
const { $observe } = useNuxtApp();

onMounted(() => {
  $observe('.projects-container', (entries) => {
    if (entries[0].isIntersecting) {
      loadMoreProjects();
    }
  });
});
</script>
```

### 2. Caching Strategy

```typescript
// Cache projects in Pinia store
const projectsStore = useProjectsStore();

const fetchProjects = async (filter?) => {
  const cacheKey = JSON.stringify(filter);

  if (projectsStore.hasCache(cacheKey)) {
    projects.value = projectsStore.getCache(cacheKey);
    return;
  }

  const data = await $fetch('/api/projects', { query: filter });
  projectsStore.setCache(cacheKey, data);
  projects.value = data;
};
```

## SEO Optimization

### Meta Tags for Project Pages

```vue
<script setup>
const { data: project } = await useFetch(`/api/projects/${route.params.slug}`);

useSeoMeta({
  title: project.value.title,
  description: project.value.description,
  ogTitle: project.value.title,
  ogDescription: project.value.description,
  ogImage: project.value.imageUrl,
  twitterCard: 'summary_large_image',
});
</script>
```

## Troubleshooting

### Common Issues

1. **Projects Not Loading**
   - Check API endpoint availability
   - Verify authentication tokens
   - Check network connectivity

2. **Filtering Not Working**
   - Ensure filter parameters are correctly formatted
   - Check composable state management
   - Verify API query parameters

3. **Admin Operations Failing**
   - Confirm admin authentication
   - Check CSRF token inclusion
   - Verify request payload format

### Debug Mode

```typescript
// Enable project debug logging
const DEBUG_PROJECTS = process.env.NODE_ENV === 'development';

if (DEBUG_PROJECTS) {
  watch(projects, (newProjects) => {
    console.log('Projects updated:', newProjects);
  });
}
```

## Testing

### Unit Tests

```typescript
describe('useProjects', () => {
  it('should fetch projects successfully', async () => {
    const { fetchProjects, projects } = useProjects();

    await fetchProjects();

    expect(projects.value).toHaveLength(expect.any(Number));
  });

  it('should filter featured projects', () => {
    const { featuredProjects } = useProjects();

    expect(featuredProjects.value.every((p) => p.featured)).toBe(true);
  });
});
```

## Related Documentation

- [Admin Interface Guide](admin-interface.md) - Admin project management
- [API Reference](api-reference.md) - Complete API documentation
- [Components Guide](components-guide.md) - Project display components

---

**Last Updated**: December 2024
