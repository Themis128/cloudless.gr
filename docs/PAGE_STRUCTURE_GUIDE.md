# Cloudless Wizard Page Structure Guide

This guide explains how to implement the consistent Cloudless Wizard page structure across all your application pages.

## Overview

The Cloudless Wizard interface uses a consistent page structure with:

- **Page Header**: Title, subtitle, and back button
- **Main Content**: Primary content area with form/cards
- **Sidebar**: Optional sidebar with tips, guides, and additional information
- **Responsive Design**: Mobile-first responsive layout

## Components

### 1. PageStructure Component

The main wrapper component that provides the consistent page layout.

```vue
<template>
  <PageStructure
    title="Page Title"
    subtitle="Page description or subtitle"
    :back-button-to="'/previous-page'"
    :has-sidebar="true"
  >
    <template #main>
      <!-- Main content goes here -->
    </template>

    <template #sidebar>
      <!-- Sidebar content goes here -->
    </template>
  </PageStructure>
</template>
```

**Props:**

- `title` (required): Page title
- `subtitle` (optional): Page subtitle/description
- `showBackButton` (optional): Show/hide back button (default: true)
- `backButtonTo` (optional): Back button destination (default: '/')
- `hasSidebar` (optional): Enable sidebar layout (default: false)

### 2. SidebarCard Component

Reusable card component for sidebar content.

```vue
<SidebarCard title="Card Title" icon="mdi-icon-name" icon-color="primary">
  <!-- Card content -->
</SidebarCard>
```

**Props:**

- `title` (required): Card title
- `icon` (optional): Material Design icon name
- `iconColor` (optional): Icon color (default: 'primary')

## Implementation Examples

### 1. Simple Page (No Sidebar)

```vue
<template>
  <div>
    <PageStructure
      title="Simple Page"
      subtitle="A page without sidebar"
      back-button-to="/dashboard"
    >
      <template #main>
        <v-card class="form-card">
          <v-card-title>Content Title</v-card-title>
          <v-card-text>
            <!-- Your content here -->
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>
  </div>
</template>

<script setup>
import PageStructure from '~/components/layout/PageStructure.vue'
</script>
```

### 2. Page with Sidebar

```vue
<template>
  <div>
    <PageStructure
      title="Page with Sidebar"
      subtitle="A page with helpful sidebar content"
      back-button-to="/dashboard"
      :has-sidebar="true"
    >
      <template #main>
        <v-card class="form-card">
          <v-card-title>Main Content</v-card-title>
          <v-card-text>
            <!-- Your main content here -->
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <SidebarCard title="Tips" icon="mdi-lightbulb" icon-color="info">
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-icon color="success" size="small">mdi-check</v-icon>
              </template>
              <v-list-item-title>Helpful tip</v-list-item-title>
            </v-list-item>
          </v-list>
        </SidebarCard>

        <SidebarCard title="Guide" icon="mdi-book-open" icon-color="warning">
          <!-- Guide content -->
        </SidebarCard>
      </template>
    </PageStructure>
  </div>
</template>

<script setup>
import PageStructure from '~/components/layout/PageStructure.vue'
import SidebarCard from '~/components/layout/SidebarCard.vue'
</script>
```

### 3. Form Page

```vue
<template>
  <div>
    <PageStructure
      title="Create New Item"
      subtitle="Fill out the form below to create a new item"
      back-button-to="/items"
      :has-sidebar="true"
    >
      <template #main>
        <v-card class="form-card">
          <v-card-title class="form-card-title">
            <v-icon start color="primary">mdi-plus</v-icon>
            Item Details
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-form ref="formRef" @submit.prevent="submitForm">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="form.name"
                    label="Name"
                    :rules="[rules.required]"
                    required
                  />
                </v-col>
                <!-- More form fields -->
              </v-row>

              <v-card-actions class="px-0 pt-6">
                <v-spacer />
                <v-btn variant="outlined" @click="cancel">Cancel</v-btn>
                <v-btn type="submit" color="primary">Create Item</v-btn>
              </v-card-actions>
            </v-form>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <SidebarCard title="Form Tips" icon="mdi-lightbulb" icon-color="info">
          <v-list density="compact">
            <v-list-item>
              <template #prepend>
                <v-icon color="success" size="small">mdi-check</v-icon>
              </template>
              <v-list-item-title>All fields are required</v-list-item-title>
            </v-list-item>
          </v-list>
        </SidebarCard>
      </template>
    </PageStructure>
  </div>
</template>
```

## Styling Guidelines

### Form Cards

Use the `form-card` class for main content cards:

```vue
<v-card class="form-card">
  <v-card-title class="form-card-title">
    <v-icon start color="primary">mdi-icon</v-icon>
    Card Title
  </v-card-title>
  <v-divider />
  <v-card-text>
    <!-- Content -->
  </v-card-text>
</v-card>
```

### CSS Classes

The following CSS classes are available for consistent styling:

- `.form-card`: Main content card styling
- `.form-card-title`: Card title styling
- `.sidebar-card`: Sidebar card styling (handled by SidebarCard component)

## Responsive Behavior

The layout automatically adapts to different screen sizes:

- **Desktop (>1024px)**: Sidebar appears on the right
- **Tablet (768px-1024px)**: Sidebar moves above main content
- **Mobile (<768px)**: Single column layout with stacked content

## Best Practices

1. **Always wrap in a single root element**: Vue requires a single root element
2. **Use semantic titles**: Make titles descriptive and user-friendly
3. **Provide helpful subtitles**: Explain what the page does
4. **Include relevant sidebar content**: Tips, guides, and contextual help
5. **Use consistent icons**: Follow Material Design icon naming
6. **Test responsive behavior**: Ensure layout works on all devices

## Migration Checklist

To update existing pages to use the new structure:

- [ ] Import PageStructure and SidebarCard components
- [ ] Replace v-container with PageStructure wrapper
- [ ] Move page title and subtitle to PageStructure props
- [ ] Wrap main content in `#main` slot
- [ ] Move sidebar content to `#sidebar` slot (if applicable)
- [ ] Use SidebarCard component for sidebar content
- [ ] Add form-card class to main content cards
- [ ] Test responsive behavior
- [ ] Remove old CSS classes that are no longer needed

## Example Migration

**Before:**

```vue
<template>
  <v-container>
    <div class="d-flex align-center mb-6">
      <BackButton to="/dashboard" />
      <div class="ml-4">
        <h1 class="text-h4 mb-2">Page Title</h1>
        <p class="text-body-1 text-medium-emphasis">Page description</p>
      </div>
    </div>

    <v-row>
      <v-col cols="12" md="8">
        <!-- Main content -->
      </v-col>
      <v-col cols="12" md="4">
        <!-- Sidebar content -->
      </v-col>
    </v-row>
  </v-container>
</template>
```

**After:**

```vue
<template>
  <div>
    <PageStructure
      title="Page Title"
      subtitle="Page description"
      back-button-to="/dashboard"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Main content -->
      </template>

      <template #sidebar>
        <!-- Sidebar content -->
      </template>
    </PageStructure>
  </div>
</template>
```

This structure ensures consistency across all pages while maintaining flexibility for different content types.
