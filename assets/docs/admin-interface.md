# Admin Interface Documentation

The Admin Interface provides comprehensive management capabilities for administrators to control all aspects of the application including users, projects, contact submissions, and system analytics.

## Overview

The admin system includes:

- **User Management**: Complete user administration and monitoring
- **Project Administration**: Full project lifecycle management
- **Contact Submissions**: Monitor and respond to contact form submissions
- **Dashboard Analytics**: System metrics and performance monitoring
- **Content Management**: Manage application content and settings

## Access & Authentication

### Admin Login

**URL**: `/admin/login`

#### Default Credentials

```
Username: admin
Password: cloudless2025
```

#### Authentication Flow

1. Navigate to `/admin/login`
2. Enter admin credentials
3. System validates and creates admin session
4. Redirect to admin dashboard

#### Security Features

- Session-based authentication with JWT tokens
- CSRF protection for all admin operations
- Rate limiting on login attempts
- Automatic session timeout after inactivity

## Admin Pages Structure

### 1. Admin Dashboard

**Location**: `pages/admin/dashboard.vue`
**URL**: `/admin/dashboard`

Central hub with system overview:

```vue
<template>
  <div class="admin-dashboard">
    <!-- Key Metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Total Users</h3>
        <span class="metric-value">{{ userCount }}</span>
      </div>
      <div class="metric-card">
        <h3>Active Projects</h3>
        <span class="metric-value">{{ projectCount }}</span>
      </div>
      <div class="metric-card">
        <h3>Pending Contacts</h3>
        <span class="metric-value">{{ pendingContacts }}</span>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="recent-activity">
      <h2>Recent Activity</h2>
      <div v-for="activity in recentActivities" :key="activity.id">
        {{ activity.description }}
      </div>
    </div>
  </div>
</template>
```

**Features**:

- System metrics overview
- Recent activity monitoring
- Quick action shortcuts
- Performance indicators

### 2. User Management

**Location**: `pages/admin/users.vue`
**URL**: `/admin/users`

Complete user administration interface:

**Capabilities**:

- View all registered users
- Search and filter users
- User status management (active/inactive/banned)
- View user activity logs
- Delete user accounts
- Export user data

**Example Usage**:

```vue
<template>
  <div class="users-management">
    <div class="users-header">
      <h1>User Management</h1>
      <div class="user-actions">
        <input v-model="searchQuery" placeholder="Search users..." @input="searchUsers" />
        <select v-model="statusFilter" @change="filterUsers">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="banned">Banned</option>
        </select>
      </div>
    </div>

    <div class="users-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.status }}</td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <button @click="editUser(user)">Edit</button>
              <button @click="deleteUser(user)" class="danger">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

### 3. Project Administration

**Location**: `pages/admin/projects.vue`
**URL**: `/admin/projects`

Full project lifecycle management:

**Capabilities**:

- Create new projects
- Edit existing projects
- Delete projects
- Bulk operations (status updates, deletion)
- Project analytics and metrics
- Featured projects management

**Project Management Features**:

```typescript
// Admin project operations
const adminProjectOperations = {
  async createProject(projectData) {
    try {
      const response = await $fetch('/api/admin/projects', {
        method: 'POST',
        body: projectData,
        headers: {
          'X-CSRF-Token': csrfToken.value,
        },
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  },

  async updateProject(projectId, updates) {
    return await $fetch(`/api/admin/projects/${projectId}`, {
      method: 'PUT',
      body: updates,
    });
  },

  async deleteProject(projectId) {
    return await $fetch(`/api/admin/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  async bulkUpdateStatus(projectIds, newStatus) {
    return await $fetch('/api/admin/projects/bulk-update', {
      method: 'POST',
      body: { projectIds, status: newStatus },
    });
  },
};
```

### 4. Contact Submissions Management

**Location**: `pages/admin/contact-submissions.vue`
**URL**: `/admin/contact-submissions`

Monitor and manage all contact form submissions:

**Features**:

- View all contact submissions
- Filter by status (new, read, replied, archived)
- Mark submissions as read/replied
- Add admin notes to submissions
- Export contact data
- Response templates

**Contact Management Interface**:

```vue
<template>
  <div class="contact-management">
    <div class="submissions-filters">
      <select v-model="statusFilter" @change="filterSubmissions">
        <option value="">All Submissions</option>
        <option value="new">New</option>
        <option value="read">Read</option>
        <option value="replied">Replied</option>
        <option value="archived">Archived</option>
      </select>
    </div>

    <div class="submissions-list">
      <div
        v-for="submission in filteredSubmissions"
        :key="submission.id"
        class="submission-card"
        :class="{ unread: submission.status === 'new' }"
      >
        <div class="submission-header">
          <h3>{{ submission.subject }}</h3>
          <span class="submission-date">
            {{ formatDate(submission.createdAt) }}
          </span>
        </div>

        <div class="submission-details">
          <p><strong>From:</strong> {{ submission.name }} ({{ submission.email }})</p>
          <p class="submission-message">{{ submission.message }}</p>
        </div>

        <div class="submission-actions">
          <select
            :value="submission.status"
            @change="updateSubmissionStatus(submission.id, $event.target.value)"
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
          </select>

          <button @click="addNote(submission)">Add Note</button>
          <button @click="replyToSubmission(submission)">Reply</button>
          <button @click="deleteSubmission(submission.id)" class="danger">Delete</button>
        </div>

        <div v-if="submission.notes" class="admin-notes">
          <h4>Admin Notes:</h4>
          <p>{{ submission.notes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 5. Admin Index

**Location**: `pages/admin/index.vue`
**URL**: `/admin`

Simple landing page that redirects to dashboard:

```vue
<template>
  <div class="admin-index">
    <h1>Admin Portal</h1>
    <p>Redirecting to dashboard...</p>
  </div>
</template>

<script setup>
// Redirect to dashboard
await navigateTo('/admin/dashboard');
</script>
```

## Admin Operations API

### Authentication Endpoints

#### Admin Login

```typescript
// POST /api/auth/admin-login
const adminLogin = async (credentials) => {
  try {
    const response = await $fetch('/api/auth/admin-login', {
      method: 'POST',
      body: {
        username: credentials.username,
        password: credentials.password,
      },
    });

    if (response.success) {
      // Admin authenticated, session created
      return response;
    }
  } catch (error) {
    throw new Error('Admin login failed');
  }
};
```

### User Management API

```typescript
// GET /api/admin/users - Get all users
const getUsers = async (filters = {}) => {
  return await $fetch('/api/admin/users', {
    query: filters,
  });
};

// PUT /api/admin/users/:id - Update user
const updateUser = async (userId, updates) => {
  return await $fetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: updates,
  });
};

// DELETE /api/admin/users/:id - Delete user
const deleteUser = async (userId) => {
  return await $fetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });
};
```

### Analytics & Reporting

```typescript
// Dashboard metrics
const getDashboardMetrics = async () => {
  const metrics = await $fetch('/api/admin/dashboard');

  return {
    userCount: metrics.users.total,
    activeUsers: metrics.users.active,
    projectCount: metrics.projects.total,
    featuredProjects: metrics.projects.featured,
    pendingContacts: metrics.contacts.pending,
    systemHealth: metrics.system.health,
  };
};

// User analytics
const getUserAnalytics = async () => {
  return await $fetch('/api/admin/analytics/users');
};

// Project analytics
const getProjectAnalytics = async () => {
  return await $fetch('/api/admin/analytics/projects');
};
```

## Security Features

### Role-Based Access Control

```typescript
// Admin middleware
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useAuthUser();

  if (!user.value || !user.value.isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
    });
  }
});
```

### CSRF Protection

```typescript
// All admin operations require CSRF token
const csrfToken = ref('');

onMounted(async () => {
  const { csrfToken: token } = await $fetch('/api/csrf-token');
  csrfToken.value = token;
});

// Include in all state-changing requests
const makeAdminRequest = async (url, options = {}) => {
  return await $fetch(url, {
    ...options,
    headers: {
      'X-CSRF-Token': csrfToken.value,
      ...options.headers,
    },
  });
};
```

### Rate Limiting

Admin endpoints have special rate limiting:

- Admin login: 10 attempts per hour per IP
- Admin operations: 500 requests per hour per admin
- Bulk operations: 50 requests per hour per admin

## Advanced Features

### 1. Bulk Operations

```vue
<template>
  <div class="bulk-operations">
    <div class="bulk-header">
      <label>
        <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
        Select All
      </label>

      <div class="bulk-actions" v-if="selectedItems.length > 0">
        <select v-model="bulkAction">
          <option value="">Choose Action...</option>
          <option value="activate">Activate</option>
          <option value="deactivate">Deactivate</option>
          <option value="delete">Delete</option>
        </select>

        <button @click="executeBulkAction" :disabled="!bulkAction">
          Apply to {{ selectedItems.length }} items
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const selectedItems = ref([]);
const bulkAction = ref('');

const executeBulkAction = async () => {
  try {
    switch (bulkAction.value) {
      case 'activate':
        await bulkUpdateStatus(selectedItems.value, 'active');
        break;
      case 'deactivate':
        await bulkUpdateStatus(selectedItems.value, 'inactive');
        break;
      case 'delete':
        await bulkDelete(selectedItems.value);
        break;
    }

    // Refresh data and clear selection
    await refreshData();
    selectedItems.value = [];
    bulkAction.value = '';
  } catch (error) {
    console.error('Bulk operation failed:', error);
  }
};
</script>
```

### 2. Real-time Updates

```typescript
// WebSocket connection for real-time admin updates
const adminSocket = ref(null);

onMounted(() => {
  adminSocket.value = new WebSocket('/ws/admin');

  adminSocket.value.onmessage = (event) => {
    const update = JSON.parse(event.data);

    switch (update.type) {
      case 'new_user':
        userCount.value++;
        break;
      case 'new_contact':
        pendingContacts.value++;
        break;
      case 'project_updated':
        refreshProjects();
        break;
    }
  };
});
```

### 3. Export Functionality

```typescript
// Export data in various formats
const exportData = async (type, format = 'csv') => {
  try {
    const data = await $fetch(`/api/admin/export/${type}`, {
      query: { format },
    });

    // Create download link
    const blob = new Blob([data], {
      type: format === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_export.${format}`;
    a.click();
  } catch (error) {
    console.error('Export failed:', error);
  }
};
```

## Troubleshooting

### Common Issues

1. **Admin Login Failed**
   - Check username/password combination
   - Verify admin account status
   - Check for rate limiting

2. **Permission Denied**
   - Confirm admin role assignment
   - Check session validity
   - Verify CSRF token

3. **Data Not Loading**
   - Check API endpoint availability
   - Verify authentication token
   - Check network connectivity

### Debug Mode

```typescript
// Enable admin debug logging
const DEBUG_ADMIN = process.env.NODE_ENV === 'development';

if (DEBUG_ADMIN) {
  console.log('Admin interface initialized');

  // Log all admin operations
  const originalFetch = window.fetch;
  window.fetch = (...args) => {
    if (args[0].includes('/api/admin')) {
      console.log('Admin API call:', args[0]);
    }
    return originalFetch(...args);
  };
}
```

## Performance Considerations

### 1. Pagination

Large datasets are paginated to improve performance:

```typescript
const pagination = ref({
  currentPage: 1,
  itemsPerPage: 50,
  totalItems: 0,
});

const loadPage = async (page) => {
  const offset = (page - 1) * pagination.value.itemsPerPage;
  const data = await $fetch('/api/admin/users', {
    query: {
      limit: pagination.value.itemsPerPage,
      offset,
    },
  });

  pagination.value.totalItems = data.total;
  return data.items;
};
```

### 2. Lazy Loading

Non-critical data is loaded on demand:

```typescript
const lazyLoadAnalytics = async () => {
  if (!analyticsLoaded.value) {
    analytics.value = await $fetch('/api/admin/analytics');
    analyticsLoaded.value = true;
  }
};
```

## Related Documentation

- [User Authentication System](user-authentication-system.md) - Auth system details
- [Projects Management](projects-management.md) - Project administration
- [API Reference](api-reference.md) - Admin API endpoints
- [CSRF Protection](csrf-protection.md) - Security implementation

---

**Last Updated**: December 2024
