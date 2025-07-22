<template>
  <div class="components-container">
    <div class="header">
      <h1>Component Library</h1>
      <p>Browse generated components and see the code behind them.</p>
    </div>

    <div class="filters">
      <div class="search-box">
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Search components..."
          class="search-input"
        />
      </div>
      <div class="filter-buttons">
        <button 
          v-for="category in categories" 
          :key="category"
          @click="toggleCategory(category)"
          :class="['filter-btn', { active: selectedCategories.includes(category) }]"
        >
          {{ category }}
        </button>
      </div>
    </div>

    <div class="components-grid">
      <div 
        v-for="component in filteredComponents" 
        :key="component.id"
        class="component-card"
      >
        <div class="component-preview">
          <div class="preview-header">
            <h3>{{ component.name }}</h3>
            <span class="component-type">{{ component.type }}</span>
          </div>
          <div class="preview-content" v-html="component.preview"></div>
        </div>
        <div class="component-info">
          <p class="component-description">{{ component.description }}</p>
          <div class="component-tags">
            <span 
              v-for="tag in component.tags" 
              :key="tag"
              class="tag"
            >
              {{ tag }}
            </span>
          </div>
          <div class="component-actions">
            <button @click="viewCode(component)" class="action-btn">
              View Code
            </button>
            <button @click="copyCode(component)" class="action-btn secondary">
              Copy Code
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Code Modal -->
    <div v-if="showCodeModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedComponent?.name }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <pre class="code-display">{{ selectedComponent?.code }}</pre>
        </div>
        <div class="modal-footer">
          <button @click="copyCode(selectedComponent)" class="copy-btn">
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  title: 'Component Library'
})

const searchTerm = ref('')
const selectedCategories = ref(['all'])
const showCodeModal = ref(false)
const selectedComponent = ref(null)

const categories = ['all', 'UI', 'Form', 'Layout', 'Navigation', 'Data Display']

const components = ref([
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
</script>`
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
</script>`
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
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false
})

const inputClasses = computed(() => [
  'form-input',
  { 'input-error': props.error, 'input-disabled': props.disabled }
])

defineEmits(['update:modelValue', 'blur'])
</script>`
  }
])

const filteredComponents = computed(() => {
  return components.value.filter(component => {
    const matchesSearch = component.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         component.description.toLowerCase().includes(searchTerm.value.toLowerCase())
    
    const matchesCategory = selectedCategories.value.includes('all') || 
                           selectedCategories.value.includes(component.type)
    
    return matchesSearch && matchesCategory
  })
})

const toggleCategory = (category: string) => {
  if (category === 'all') {
    selectedCategories.value = ['all']
  } else {
    const index = selectedCategories.value.indexOf(category)
    if (index > -1) {
      selectedCategories.value.splice(index, 1)
      if (selectedCategories.value.length === 0) {
        selectedCategories.value = ['all']
      }
    } else {
      selectedCategories.value = selectedCategories.value.filter(c => c !== 'all')
      selectedCategories.value.push(category)
    }
  }
}

const viewCode = (component: any) => {
  selectedComponent.value = component
  showCodeModal.value = true
}

const closeModal = () => {
  showCodeModal.value = false
  selectedComponent.value = null
}

const copyCode = async (component: any) => {
  try {
    await navigator.clipboard.writeText(component.code)
    alert('Code copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy code:', error)
    alert('Failed to copy code')
  }
}
</script>

<style scoped>
.components-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header p {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.filters {
  margin-bottom: 2rem;
}

.search-box {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  max-width: 400px;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: #1e40af;
  color: #1e40af;
}

.filter-btn.active {
  background: #1e40af;
  border-color: #1e40af;
  color: white;
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
}

.component-card {
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.component-card:hover {
  border-color: #1e40af;
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.1);
}

.component-preview {
  padding: 1.5rem;
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h3 {
  margin: 0;
  color: #1e40af;
  font-size: 1.25rem;
}

.component-type {
  padding: 0.25rem 0.5rem;
  background: #1e40af;
  color: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.preview-content {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.component-info {
  padding: 1.5rem;
}

.component-description {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.component-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tag {
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  color: #475569;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.component-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #1e40af;
  border-radius: 0.375rem;
  background: #1e40af;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.action-btn:hover {
  background: #1e3a8a;
  border-color: #1e3a8a;
}

.action-btn.secondary {
  background: white;
  color: #1e40af;
}

.action-btn.secondary:hover {
  background: #f8fafc;
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

.modal-body {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.code-display {
  background: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 2px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.copy-btn {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: #059669;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }
  
  .components-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-buttons {
    justify-content: center;
  }
  
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
}
</style> 