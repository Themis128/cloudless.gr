<template>
  <div class="components-container">
    <div class="components-header">
      <h1>Component Library</h1>
      <p>Browse and explore our collection of reusable UI components with live examples and code snippets.</p>
    </div>

    <div class="components-grid">
      <div v-for="component in components" :key="component.id" class="component-card">
        <div class="component-preview">
          <component :is="component.component" v-bind="component.props" />
        </div>
        
        <div class="component-info">
          <h3>{{ component.name }}</h3>
          <p>{{ component.description }}</p>
          
          <div class="component-tags">
            <span v-for="tag in component.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          
          <div class="component-actions">
            <button @click="viewCode(component)" class="view-code-btn">View Code</button>
            <button @click="copyCode(component)" class="copy-btn">Copy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Code Modal -->
    <div v-if="showCodeModal" class="modal-backdrop" @click="closeCodeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedComponent?.name }} - Code</h3>
          <button @click="closeCodeModal" class="close-btn">&times;</button>
        </div>
        
        <div class="code-container">
          <div class="code-tabs">
            <button 
              v-for="tab in codeTabs" 
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="['tab-btn', { active: activeTab === tab.id }]"
            >
              {{ tab.label }}
            </button>
          </div>
          
          <div class="code-content">
            <pre v-if="activeTab === 'vue'" class="code-block">{{ selectedComponent?.vueCode }}</pre>
            <pre v-else-if="activeTab === 'typescript'" class="code-block">{{ selectedComponent?.typescriptCode }}</pre>
            <pre v-else-if="activeTab === 'css'" class="code-block">{{ selectedComponent?.cssCode }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Page meta
definePageMeta({
  title: 'Component Library'
})

// Sample components data
const components = ref([
  {
    id: 1,
    name: 'Button',
    description: 'A versatile button component with multiple variants and states.',
    tags: ['Vue 3', 'TypeScript', 'Tailwind'],
    component: 'ButtonComponent',
    props: { variant: 'primary', size: 'md', children: 'Click me' },
    vueCode: `<template>
  <button 
    :class="buttonClasses" 
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

const buttonClasses = computed(() => [
  'px-4 py-2 rounded font-medium transition-colors',
  {
    'bg-blue-600 text-white hover:bg-blue-700': props.variant === 'primary',
    'bg-gray-200 text-gray-800 hover:bg-gray-300': props.variant === 'secondary',
    'border border-blue-600 text-blue-600 hover:bg-blue-50': props.variant === 'outline',
    'opacity-50 cursor-not-allowed': props.disabled
  }
])
</script>`,
    typescriptCode: `interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
}

interface ButtonEmits {
  click: []
}`,
    cssCode: `.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--primary {
  background-color: #2563eb;
  color: white;
}

.button--primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.button--secondary {
  background-color: #e5e7eb;
  color: #374151;
}

.button--secondary:hover:not(:disabled) {
  background-color: #d1d5db;
}

.button--outline {
  border: 1px solid #2563eb;
  color: #2563eb;
  background-color: transparent;
}

.button--outline:hover:not(:disabled) {
  background-color: #eff6ff;
}`
  },
  {
    id: 2,
    name: 'Card',
    description: 'A flexible card component for displaying content in containers.',
    tags: ['Vue 3', 'CSS Grid', 'Responsive'],
    component: 'CardComponent',
    props: { title: 'Card Title', children: 'Card content goes here...' },
    vueCode: `<template>
  <div class="card">
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <h3 class="card-title">{{ title }}</h3>
      </slot>
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
  title?: string
}

defineProps<Props>()
</script>`,
    typescriptCode: `interface CardProps {
  title?: string
}

interface CardSlots {
  default: []
  header?: []
  footer?: []
}`,
    cssCode: `.card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.card-body {
  padding: 1.5rem;
}

.card-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}`
  },
  {
    id: 3,
    name: 'Modal',
    description: 'A modal dialog component with backdrop and animations.',
    tags: ['Vue 3', 'Teleport', 'Transitions'],
    component: 'ModalComponent',
    props: { isOpen: true, title: 'Modal Title', children: 'Modal content...' },
    vueCode: `<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-backdrop" @click="close">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button @click="close" class="close-btn">&times;</button>
          </div>
          
          <div class="modal-body">
            <slot />
          </div>
          
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const close = () => emit('close')
</script>`,
    typescriptCode: `interface ModalProps {
  isOpen: boolean
  title?: string
}

interface ModalEmits {
  close: []
}

interface ModalSlots {
  default: []
  footer?: []
}`,
    cssCode: `.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}`
  }
])

// Modal state
const showCodeModal = ref(false)
const selectedComponent = ref<any>(null)
const activeTab = ref('vue')

const codeTabs = [
  { id: 'vue', label: 'Vue Template' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'css', label: 'CSS' }
]

// Methods
const viewCode = (component: any) => {
  selectedComponent.value = component
  showCodeModal.value = true
  activeTab.value = 'vue'
}

const closeCodeModal = () => {
  showCodeModal.value = false
  selectedComponent.value = null
}

const copyCode = async (component: any) => {
  const code = component.vueCode
  try {
    await navigator.clipboard.writeText(code)
    alert('Code copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}
</script>

<style scoped>
.components-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.components-header {
  text-align: center;
  margin-bottom: 3rem;
}

.components-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.components-header p {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
}

.component-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid rgba(219, 234, 254, 0.6);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.component-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.component-preview {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.component-info h3 {
  color: #1e40af;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}

.component-info p {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.component-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.component-actions {
  display: flex;
  gap: 0.5rem;
}

.view-code-btn,
.copy-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.view-code-btn {
  background: #2563eb;
  color: white;
}

.view-code-btn:hover {
  background: #1d4ed8;
}

.copy-btn {
  background: #f3f4f6;
  color: #374151;
}

.copy-btn:hover {
  background: #e5e7eb;
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
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1e40af;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
}

.close-btn:hover {
  color: #374151;
}

.code-container {
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-weight: 500;
}

.tab-btn.active {
  color: #1e40af;
  border-bottom-color: #1e40af;
}

.code-content {
  flex: 1;
  overflow: auto;
}

.code-block {
  margin: 0;
  padding: 1rem;
  background: #1e293b;
  color: #e2e8f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .components-grid {
    grid-template-columns: 1fr;
  }
  
  .components-header h1 {
    font-size: 2rem;
  }
  
  .modal-content {
    width: 95%;
  }
}
</style> 