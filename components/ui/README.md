# UI Components

This directory contains reusable UI components that follow the Vuetify design system and maintain consistency across the application.

## Consistent Styling Architecture

All cards use a unified styling approach through the `CardLayout` component, ensuring:

- **Consistent Spacing**: Uniform padding and margins
- **Consistent Typography**: Standardized font sizes and weights
- **Consistent Interactions**: Unified hover effects and transitions
- **Consistent Loading States**: Standardized loading indicators
- **Responsive Design**: Mobile-first responsive behavior

## CardLayout

The base card wrapper that provides consistent styling for all card components.

### Usage

```vue
<template>
  <CardLayout :title="title" :loading="loading">
    <template #header>
      <!-- Custom header content -->
    </template>
    
    <template #content>
      <!-- Main card content -->
    </template>
    
    <template #actions>
      <!-- Card actions -->
    </template>
  </CardLayout>
</template>
```

### Features

- **Consistent Structure**: Header, content, and actions sections
- **Loading States**: Built-in progress indicators
- **Hover Effects**: Smooth transitions and elevation changes
- **Dark Theme Support**: Automatic dark mode adaptation
- **Responsive Design**: Mobile-optimized layouts

## Dashboard Store

The dashboard state is managed using Pinia store (`stores/dashboardStore.ts`) which provides:

- **Action Cards**: Configurable action buttons with consistent styling
- **Metric Cards**: Dynamic metrics with trend indicators
- **State Management**: Loading states, error handling, and data fetching
- **Consistent Structure**: All cards follow the same data patterns

### Store Usage

```vue
<script setup>
import { useDashboardStore } from '~/stores/dashboardStore'

const dashboardStore = useDashboardStore()

// Fetch data
await dashboardStore.fetchDashboardData()

// Access state
console.log(dashboardStore.actionCards)
console.log(dashboardStore.metricCards)

// Create consistent cards
const newCard = dashboardStore.createActionCard(
  'custom-card',
  'Custom Actions',
  'Your custom actions',
  [
    {
      id: 'action-1',
      label: 'Action 1',
      icon: 'mdi-star',
      color: 'primary',
      variant: 'elevated',
      size: 'large',
      to: '/custom'
    }
  ]
)
</script>
```

## ActionCard

A reusable card component for displaying action buttons with consistent styling.

### Usage with Store

```vue
<template>
  <ActionCard
    v-for="card in dashboardStore.actionCards"
    :key="card.id"
    :title="card.title"
    :subtitle="card.subtitle"
    :loading="card.loading"
    :actions="card.actions"
  />
</template>
```

### Usage with Manual Props

```vue
<template>
  <ActionCard
    title="Quick Actions"
    subtitle="Create, test, or manage your AI components"
    :loading="false"
    :actions="[
      {
        id: 'create-bot',
        label: 'Create Bot',
        icon: 'mdi-plus',
        color: 'primary',
        variant: 'elevated',
        size: 'large',
        to: '/bots/create'
      }
    ]"
  />
</template>
```

### Props

- `title` (string, required): The card title
- `subtitle` (string, required): The card subtitle/description
- `loading` (boolean, optional): Show loading state
- `actions` (ActionButton[], optional): Array of action buttons

### ActionButton Interface

```typescript
interface ActionButton {
  id: string
  label: string
  icon: string
  color: string
  variant: 'elevated' | 'outlined' | 'text' | 'tonal'
  size: 'small' | 'default' | 'large' | 'x-large'
  to?: string
  href?: string
  disabled?: boolean
  onClick?: () => void
}
```

## MetricCard

A reusable card component for displaying metrics and statistics.

### Usage with Store

```vue
<template>
  <MetricCard
    v-for="metric in dashboardStore.metricCards"
    :key="metric.id"
    :title="metric.title"
    :value="metric.value"
    :subtitle="metric.subtitle"
    :icon="metric.icon"
    :icon-color="metric.iconColor"
    :value-color="metric.valueColor"
    :loading="metric.loading"
    :trend="metric.trend"
  />
</template>
```

### Usage with Manual Props

```vue
<template>
  <MetricCard
    title="Total Bots"
    :value="42"
    subtitle="Active bots in system"
    icon="mdi-robot"
    icon-color="primary"
    value-color="primary"
    :loading="false"
    :trend="{
      value: 12,
      direction: 'up',
      color: 'success'
    }"
  />
</template>
```

### Props

- `title` (string, required): The metric title
- `value` (string | number, required): The metric value
- `subtitle` (string, optional): Additional description
- `icon` (string, required): Material Design icon name
- `iconColor` (string, optional): Icon color (default: 'primary')
- `valueColor` (string, optional): Value text color (default: 'primary')
- `loading` (boolean, optional): Show loading state
- `trend` (Trend, optional): Trend indicator data

### Trend Interface

```typescript
interface Trend {
  value: number
  direction: 'up' | 'down' | 'neutral'
  color: string
}
```

## Store Actions

### Dashboard Store Methods

- `fetchDashboardData()`: Fetch dashboard statistics from API
- `addActionCard(card)`: Add a new action card with consistent structure
- `removeActionCard(cardId)`: Remove an action card
- `updateActionCard(cardId, updates)`: Update an action card
- `updateActionCardLoading(cardId, isLoading)`: Update loading state
- `createActionCard(id, title, subtitle, actions)`: Create consistent action card
- `clearError()`: Clear error state

## Consistent Styling Features

### Visual Consistency

- **Card Structure**: All cards use the same layout with header, content, and actions
- **Typography**: Consistent font sizes, weights, and line heights
- **Spacing**: Uniform padding and margins across all cards
- **Colors**: Consistent color palette and theming
- **Borders**: Standardized border radius and border colors

### Interactive Elements

- **Hover Effects**: Smooth elevation changes on hover
- **Loading States**: Consistent progress indicators
- **Button Styling**: Uniform button appearance and behavior
- **Transitions**: Smooth animations for all interactions

### Responsive Design

- **Mobile-First**: Optimized for mobile devices
- **Flexible Layouts**: Adaptive grid systems
- **Touch-Friendly**: Appropriate touch targets and spacing
- **Breakpoint Consistency**: Standard responsive breakpoints

### Accessibility

- **Color Contrast**: WCAG compliant color combinations
- **Focus States**: Clear focus indicators
- **Screen Reader Support**: Proper ARIA labels and roles
- **Keyboard Navigation**: Full keyboard accessibility

## Examples

See `pages/dashboard.vue` for complete usage examples of all components with the store and consistent styling. 