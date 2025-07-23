import { defineEventHandler, getQuery, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pagination parameters'
      })
    }

    // Mock components data for now
    const mockComponents = [
      {
        id: 1,
        name: 'Button',
        type: 'UI',
        description: 'A versatile button component with multiple variants and states.',
        tags: ['Vue', 'TypeScript', 'Responsive'],
        preview: '<button class="btn btn-primary">Click me</button>',
        code: `<template>
  <button
    :class="buttonClasses"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false
})

const buttonClasses = computed(() => [
  'btn',
  \`btn-\${props.variant}\`,
  \`btn-\${props.size}\`,
  { 'btn-disabled': props.disabled }
])
</script>`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: 'Card',
        type: 'Layout',
        description: 'A flexible card component for displaying content in containers.',
        tags: ['Vue', 'CSS Grid', 'Flexbox'],
        preview: '<div class="card"><h3>Card Title</h3><p>Card content goes here...</p></div>',
        code: `<template>
  <div :class="cardClasses">
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  padding?: 'none' | 'small' | 'medium' | 'large'
  shadow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padding: 'medium',
  shadow: true
})

const cardClasses = computed(() => [
  'card',
  \`card-padding-\${props.padding}\`,
  { 'card-shadow': props.shadow }
])
</script>`,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        name: 'Input',
        type: 'Form',
        description: 'A form input component with validation and error states.',
        tags: ['Vue', 'Form', 'Validation'],
        preview: '<input type="text" placeholder="Enter text..." class="form-input" />',
        code: `<template>
  <div class="input-wrapper">
    <label v-if="label" :for="id" class="input-label">
      {{ label }}
    </label>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="inputClasses"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="$emit('blur', $event)"
    />
    <div v-if="error" class="input-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  label?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false
})

const id = computed(() => \`input-\${Math.random().toString(36).substr(2, 9)}\`)

const inputClasses = computed(() => [
  'form-input',
  { 'input-error': props.error }
])
</script>`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // Simple pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedComponents = mockComponents.slice(startIndex, endIndex)

    return {
      success: true,
      data: paginatedComponents,
      total: mockComponents.length,
      page,
      pages: Math.ceil(mockComponents.length / limit)
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve components',
      data: { error: error.message }
    })
  }
}) 