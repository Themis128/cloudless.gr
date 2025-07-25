# Components Usage Guide

Comprehensive documentation for all reusable Vue components in the application, including props, events, slots, and usage examples.

## Overview

This guide covers:

- **UI Components**: Basic building blocks and interactive elements
- **Form Components**: Input fields, validators, and form utilities
- **Layout Components**: Page structure and navigation elements
- **Feature Components**: Complex business logic components
- **Utility Components**: Helper components and wrappers

## Component Categories

### UI Components

#### GradientCard

**Location**: `components/ui/GradientCard.vue`

A reusable card component with gradient background and customizable styling.

**Props**:

```typescript
interface GradientCardProps {
  title?: string;
  subtitle?: string;
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
  loading?: boolean;
}
```

**Events**:

- `@click` - Emitted when card is clicked (if clickable)

**Slots**:

- `default` - Main content area
- `header` - Custom header content
- `footer` - Footer actions

**Usage Examples**:

```vue
<template>
  <!-- Basic usage -->
  <GradientCard title="Project Title" subtitle="Description">
    <p>Card content goes here</p>
  </GradientCard>

  <!-- With custom header -->
  <GradientCard variant="primary" size="lg" clickable @click="handleClick">
    <template #header>
      <div class="custom-header">
        <h3>Custom Header</h3>
        <button>Action</button>
      </div>
    </template>

    <p>Main content</p>

    <template #footer>
      <button>Save</button>
      <button>Cancel</button>
    </template>
  </GradientCard>

  <!-- Loading state -->
  <GradientCard :loading="isLoading" title="Loading Card">
    <p>This content is hidden while loading</p>
  </GradientCard>
</template>

<script setup>
const isLoading = ref(false);

const handleClick = () => {
  console.log('Card clicked');
};
</script>
```

#### BackButton

**Location**: `components/ui/BackButton.vue`

A navigation button for going back to previous page.

**Props**:

```typescript
interface BackButtonProps {
  to?: string;
  label?: string;
  variant?: 'text' | 'button' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage Examples**:

```vue
<template>
  <!-- Default back button -->
  <BackButton />

  <!-- Custom destination -->
  <BackButton to="/dashboard" label="Back to Dashboard" />

  <!-- Icon only variant -->
  <BackButton variant="icon" size="sm" />

  <!-- Button style -->
  <BackButton variant="button" label="Go Back" />
</template>
```

#### SvgIcon

**Location**: `components/ui/SvgIcon.vue`

Reusable SVG icon component with customizable styling.

**Props**:

```typescript
interface SvgIconProps {
  name: string;
  size?: number | string;
  color?: string;
  class?: string;
}
```

**Usage Examples**:

```vue
<template>
  <!-- Basic icon -->
  <SvgIcon name="user" />

  <!-- Customized icon -->
  <SvgIcon name="settings" :size="24" color="blue" class="custom-icon" />

  <!-- Dynamic size -->
  <SvgIcon :name="iconName" :size="iconSize" :color="theme.primary" />
</template>

<script setup>
const iconName = ref('home');
const iconSize = ref(20);
const theme = reactive({ primary: '#3b82f6' });
</script>
```

### Layout Components

#### PageStructure

**Location**: `components/layout/PageStructure.vue`

Main page layout wrapper providing consistent structure.

**Props**:

```typescript
interface PageStructureProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showSidebar?: boolean;
  sidebarWidth?: string;
  maxWidth?: string;
}

interface BreadcrumbItem {
  label: string;
  to?: string;
}
```

**Slots**:

- `default` - Main content area
- `sidebar` - Sidebar content (if enabled)
- `header` - Custom header content
- `actions` - Action buttons in header

**Usage Examples**:

```vue
<template>
  <!-- Basic page structure -->
  <PageStructure title="Dashboard" subtitle="Welcome back">
    <div class="dashboard-content">
      <!-- Page content -->
    </div>
  </PageStructure>

  <!-- With breadcrumbs and sidebar -->
  <PageStructure
    title="Project Details"
    :breadcrumbs="breadcrumbs"
    show-sidebar
    sidebar-width="300px"
  >
    <template #sidebar>
      <ProjectNav :project="currentProject" />
    </template>

    <template #actions>
      <button @click="editProject">Edit</button>
      <button @click="deleteProject">Delete</button>
    </template>

    <ProjectDetails :project="currentProject" />
  </PageStructure>
</template>

<script setup>
const breadcrumbs = [
  { label: 'Projects', to: '/projects' },
  { label: 'Web App', to: '/projects/web-app' },
  { label: 'Settings' },
];
</script>
```

#### SidebarCard

**Location**: `components/layout/SidebarCard.vue`

Sidebar container with consistent styling and behavior.

**Props**:

```typescript
interface SidebarCardProps {
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  sticky?: boolean;
}
```

**Events**:

- `@toggle` - Emitted when collapsed state changes

**Usage Examples**:

```vue
<template>
  <!-- Basic sidebar card -->
  <SidebarCard title="Navigation">
    <nav>
      <NuxtLink to="/dashboard">Dashboard</NuxtLink>
      <NuxtLink to="/projects">Projects</NuxtLink>
    </nav>
  </SidebarCard>

  <!-- Collapsible sidebar -->
  <SidebarCard title="Filters" collapsible :collapsed="isCollapsed" @toggle="handleToggle">
    <FilterForm @change="applyFilters" />
  </SidebarCard>
</template>
```

### Form Components

#### Contact Form

**Location**: `pages/contact.vue` (integrated form)

While not a standalone component, the contact form provides patterns for form handling.

**Key Patterns**:

```vue
<template>
  <form @submit.prevent="submitForm" class="contact-form">
    <!-- Form fields with validation -->
    <div class="form-group">
      <label for="name">Name *</label>
      <input
        id="name"
        v-model="formData.name"
        :class="{ error: errors.name }"
        type="text"
        required
        data-testid="name-input"
      />
      <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
    </div>

    <!-- Submit button with loading state -->
    <button type="submit" :disabled="isSubmitting || !isValid" data-testid="submit-button">
      {{ isSubmitting ? 'Sending...' : 'Send Message' }}
    </button>
  </form>
</template>

<script setup>
const { formData, errors, isSubmitting, isValid, submitContactForm } = useContactUs();

const submitForm = async () => {
  try {
    await submitContactForm();
    // Handle success
  } catch (error) {
    // Handle error
  }
};
</script>
```

### Business Logic Components

#### ProjectCard

**Location**: Component pattern used throughout project listings

A card component for displaying project information with actions.

**Expected Props**:

```typescript
interface Project {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  category: string;
  featured: boolean;
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectCardProps {
  project: Project;
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'list';
}
```

**Events**:

- `@click` - Project card clicked
- `@edit` - Edit action triggered
- `@delete` - Delete action triggered
- `@feature` - Feature toggle triggered

**Usage Pattern**:

```vue
<template>
  <div class="project-grid">
    <ProjectCard
      v-for="project in projects"
      :key="project.id"
      :project="project"
      show-actions
      @click="viewProject"
      @edit="editProject"
      @delete="confirmDelete"
    />
  </div>
</template>

<script setup>
const { projects } = useProjects();

const viewProject = (project) => {
  navigateTo(`/projects/${project.slug}`);
};

const editProject = (project) => {
  // Edit logic
};

const confirmDelete = (project) => {
  // Delete confirmation
};
</script>
```

#### UserCard

**Location**: Admin user management sections

Display user information with admin actions.

**Expected Props**:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: Date;
  status: 'active' | 'inactive' | 'banned';
}

interface UserCardProps {
  user: User;
  showActions?: boolean;
  showStatus?: boolean;
}
```

**Usage Pattern**:

```vue
<template>
  <UserCard
    :user="user"
    show-actions
    show-status
    @edit="editUser"
    @delete="deleteUser"
    @toggle-status="toggleStatus"
  />
</template>
```

### Feature Components

#### CodegenWidget

**Location**: `components/CodegenWidget.vue`

AI code generation interface with LLM integration.

**Props**:

```typescript
interface CodegenWidgetProps {
  defaultPrompt?: string;
  showFileViewer?: boolean;
  llmEndpoint?: string;
  maxTokens?: number;
}
```

**Events**:

- `@response` - LLM response received
- `@error` - Error occurred
- `@complete` - Generation completed

**Usage Examples**:

```vue
<template>
  <!-- Basic code generation -->
  <CodegenWidget @response="handleResponse" @error="handleError" />

  <!-- With file viewer -->
  <CodegenWidget
    show-file-viewer
    default-prompt="Analyze this component"
    @complete="onGenerationComplete"
  />

  <!-- Custom LLM endpoint -->
  <CodegenWidget llm-endpoint="https://api.openai.com/v1/completions" :max-tokens="2048" />
</template>

<script setup>
const handleResponse = (response) => {
  console.log('Generated code:', response);
};

const handleError = (error) => {
  console.error('Generation failed:', error);
};
</script>
```

#### Activity Feed

**Location**: `components/activity-feed.vue`

Display recent activities and updates.

**Props**:

```typescript
interface ActivityItem {
  id: string;
  type: 'project_created' | 'user_registered' | 'contact_received';
  title: string;
  description: string;
  timestamp: Date;
  user?: User;
  metadata?: Record<string, any>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  limit?: number;
  showFilter?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}
```

**Events**:

- `@refresh` - Manual refresh triggered
- `@load-more` - More items requested

**Usage Examples**:

```vue
<template>
  <!-- Basic activity feed -->
  <ActivityFeed :activities="recentActivities" />

  <!-- With filtering and auto-refresh -->
  <ActivityFeed
    :activities="activities"
    :limit="20"
    show-filter
    auto-refresh
    :refresh-interval="30000"
    @refresh="loadActivities"
    @load-more="loadMoreActivities"
  />
</template>

<script setup>
const { activities, recentActivities } = useActivityFeed();
</script>
```

#### Project List Preview

**Location**: `components/project-list-preview.vue`

Preview component for project listings on homepage.

**Props**:

```typescript
interface ProjectListPreviewProps {
  title?: string;
  limit?: number;
  showFeatured?: boolean;
  category?: string;
  showViewAll?: boolean;
}
```

**Usage Examples**:

```vue
<template>
  <!-- Featured projects preview -->
  <ProjectListPreview title="Featured Projects" :limit="6" show-featured show-view-all />

  <!-- Category-specific preview -->
  <ProjectListPreview title="Web Development Projects" category="web-development" :limit="4" />
</template>
```

### Utility Components

#### SvgProgressIcon

**Location**: `components/SvgProgressIcon.vue`

Animated progress indicator with SVG.

**Props**:

```typescript
interface SvgProgressIconProps {
  progress: number; // 0-100
  size?: number;
  color?: string;
  backgroundColor?: string;
  showText?: boolean;
  animated?: boolean;
}
```

**Usage Examples**:

```vue
<template>
  <!-- Basic progress indicator -->
  <SvgProgressIcon :progress="uploadProgress" />

  <!-- Customized progress -->
  <SvgProgressIcon
    :progress="completionRate"
    :size="120"
    color="#10b981"
    background-color="#e5e7eb"
    show-text
    animated
  />
</template>

<script setup>
const uploadProgress = ref(0);
const completionRate = ref(75);
</script>
```

## Component Development Guidelines

### 1. Component Structure

```vue
<template>
  <!-- Always use semantic HTML -->
  <div class="component-name" :class="computedClasses">
    <!-- Use slots for flexibility -->
    <header v-if="$slots.header || title">
      <slot name="header">
        <h2>{{ title }}</h2>
      </slot>
    </header>

    <main>
      <slot />
    </main>

    <footer v-if="$slots.footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
// Define props with TypeScript
interface Props {
  title?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
});

// Define emits
const emit = defineEmits<{
  click: [event: MouseEvent];
  change: [value: string];
}>();

// Computed classes
const computedClasses = computed(() => ({
  [`component-name--${props.variant}`]: true,
  [`component-name--${props.size}`]: true,
}));
</script>

<style scoped>
.component-name {
  /* Component-specific styles */
}

.component-name--primary {
  /* Variant styles */
}

.component-name--sm {
  /* Size styles */
}
</style>
```

### 2. Props Best Practices

```typescript
// Use TypeScript interfaces for complex props
interface User {
  id: string;
  name: string;
  email: string;
}

interface ComponentProps {
  // Required props
  user: User;

  // Optional props with defaults
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';

  // Props that accept multiple types
  id?: string | number;

  // Function props
  onUpdate?: (user: User) => void;
}

// Use withDefaults for default values
const props = withDefaults(defineProps<ComponentProps>(), {
  showActions: true,
  size: 'md',
  onUpdate: () => {},
});
```

### 3. Event Handling

```vue
<script setup>
// Define events with TypeScript
const emit = defineEmits<{
  // Event with payload
  update: [user: User];

  // Event without payload
  close: [];

  // Event with multiple parameters
  change: [field: string, value: any];
}>();

// Emit events with proper typing
const handleUpdate = (user: User) => {
  emit('update', user);
};

const handleClose = () => {
  emit('close');
};
</script>
```

### 4. Slot Patterns

```vue
<template>
  <div class="flexible-component">
    <!-- Named slots with fallback -->
    <header>
      <slot name="header">
        <h2>{{ title }}</h2>
      </slot>
    </header>

    <!-- Scoped slots for data passing -->
    <main>
      <slot :items="items" :loading="loading">
        <!-- Default content -->
        <div v-if="loading">Loading...</div>
        <div v-else-if="items.length === 0">No items found</div>
        <div v-else>{{ items.length }} items</div>
      </slot>
    </main>

    <!-- Conditional slots -->
    <footer v-if="$slots.footer || showFooter">
      <slot name="footer">
        <DefaultFooter />
      </slot>
    </footer>
  </div>
</template>
```

## Component Testing

### 1. Basic Component Test

```typescript
// components/ui/GradientCard.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import GradientCard from '~/components/ui/GradientCard.vue';

describe('GradientCard', () => {
  it('renders title and content', () => {
    const wrapper = mount(GradientCard, {
      props: { title: 'Test Card' },
      slots: { default: '<p>Test content</p>' },
    });

    expect(wrapper.text()).toContain('Test Card');
    expect(wrapper.text()).toContain('Test content');
  });

  it('emits click event when clickable', async () => {
    const wrapper = mount(GradientCard, {
      props: { clickable: true },
    });

    await wrapper.trigger('click');
    expect(wrapper.emitted().click).toBeTruthy();
  });
});
```

### 2. Component with Props Test

```typescript
describe('ProjectCard', () => {
  const mockProject = {
    id: '1',
    title: 'Test Project',
    description: 'Test description',
    status: 'active',
    category: 'web-development',
    featured: false,
    technologies: ['Vue.js'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('displays project information', () => {
    const wrapper = mount(ProjectCard, {
      props: { project: mockProject },
    });

    expect(wrapper.text()).toContain('Test Project');
    expect(wrapper.text()).toContain('Test description');
  });

  it('shows edit button when showActions is true', () => {
    const wrapper = mount(ProjectCard, {
      props: {
        project: mockProject,
        showActions: true,
      },
    });

    expect(wrapper.find('[data-testid="edit-button"]').exists()).toBe(true);
  });
});
```

## Accessibility Guidelines

### 1. Semantic HTML

```vue
<template>
  <!-- Use proper semantic elements -->
  <article class="project-card" role="article">
    <header>
      <h3>{{ project.title }}</h3>
    </header>

    <main>
      <p>{{ project.description }}</p>
    </main>

    <footer>
      <button type="button" :aria-label="`Edit ${project.title}`" @click="$emit('edit', project)">
        Edit
      </button>
    </footer>
  </article>
</template>
```

### 2. ARIA Attributes

```vue
<template>
  <div
    class="collapsible-section"
    :aria-expanded="isExpanded"
    role="button"
    tabindex="0"
    @click="toggle"
    @keydown.enter="toggle"
    @keydown.space.prevent="toggle"
  >
    <h3>{{ title }}</h3>
    <div v-if="isExpanded" role="region" :aria-labelledby="headingId">
      <slot />
    </div>
  </div>
</template>
```

### 3. Focus Management

```vue
<script setup>
import { nextTick } from 'vue';

const isModalOpen = ref(false);
const modalRef = ref(null);

const openModal = async () => {
  isModalOpen.value = true;
  await nextTick();

  // Focus first focusable element in modal
  const firstFocusable = modalRef.value?.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
};
</script>
```

## Performance Considerations

### 1. Lazy Loading Components

```vue
<script setup>
// Lazy load heavy components
const HeavyChart = defineAsyncComponent(() => import('~/components/charts/HeavyChart.vue'));

const showChart = ref(false);
</script>

<template>
  <div>
    <button @click="showChart = true">Show Chart</button>
    <Suspense v-if="showChart">
      <template #default>
        <HeavyChart :data="chartData" />
      </template>
      <template #fallback>
        <div>Loading chart...</div>
      </template>
    </Suspense>
  </div>
</template>
```

### 2. Memoization

```vue
<script setup>
import { computed } from 'vue';

const props = defineProps<{
  items: Array<any>;
  filter: string;
}>();

// Use computed for expensive operations
const filteredItems = computed(() => {
  return props.items.filter(item =>
    item.name.toLowerCase().includes(props.filter.toLowerCase())
  );
});

// Memoize complex calculations
const expensiveComputation = computed(() => {
  return props.items.reduce((acc, item) => {
    // Expensive operation
    return acc + calculateComplexValue(item);
  }, 0);
});
</script>
```

## Related Documentation

- [Development Setup](development-setup.md) - Component development environment
- [Testing Guide](testing-complete.md) - Component testing strategies
- [API Reference](api-reference.md) - Backend integration patterns

---

**Last Updated**: December 2024
