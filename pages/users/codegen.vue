<template>
  <v-container class="py-6">
    <!-- Page Header -->
    <v-row class="mb-6">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold text-primary mb-2">
          <v-icon class="mr-3">mdi-code-braces</v-icon>
          AI Code Generator
        </h1>
        <p class="text-subtitle-1 text-secondary">
          Generate high-quality code using AI. Choose from templates or describe your requirements.
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn
          color="primary"
          variant="elevated"
          size="large"
          @click="openHistory"
        >
          <v-icon start>mdi-history</v-icon>
          Generation History
        </v-btn>
      </v-col>
    </v-row>

    <!-- Quick Start Templates -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
            Quick Start Templates
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col
                v-for="template in codeTemplates"
                :key="template.id"
                cols="12"
                sm="6"
                md="4"
                lg="3"
              >
                <v-card
                  variant="outlined"
                  hover
                  class="h-100"
                  @click="useTemplate(template)"
                >
                  <v-card-text class="text-center pa-4">
                    <v-icon
                      :color="template.color"
                      size="40"
                      class="mb-3"
                    >
                      {{ template.icon }}
                    </v-icon>
                    <h4 class="text-subtitle-1 mb-2">{{ template.name }}</h4>
                    <p class="text-caption text-secondary">
                      {{ template.description }}
                    </p>
                    <v-chip
                      :color="template.color"
                      size="small"
                      variant="outlined"
                      class="mt-2"
                    >
                      {{ template.language }}
                    </v-chip>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Code Generation Form -->
    <v-row>
      <v-col cols="12" md="6">
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-cog</v-icon>
            Code Generation Settings
          </v-card-title>
          <v-card-text>
            <v-form @submit.prevent="generateCode">
              <!-- Language Selection -->
              <v-select
                v-model="form.language"
                :items="programmingLanguages"
                label="Programming Language"
                variant="outlined"
                class="mb-4"
                required
              >
                <template #prepend-inner>
                  <v-icon>mdi-code-tags</v-icon>
                </template>
              </v-select>

              <!-- Framework Selection -->
              <v-select
                v-model="form.framework"
                :items="getFrameworksForLanguage(form.language)"
                label="Framework (Optional)"
                variant="outlined"
                class="mb-4"
                clearable
              >
                <template #prepend-inner>
                  <v-icon>mdi-layers</v-icon>
                </template>
              </v-select>

              <!-- Code Type -->
              <v-select
                v-model="form.codeType"
                :items="codeTypes"
                label="Code Type"
                variant="outlined"
                class="mb-4"
                required
              >
                <template #prepend-inner>
                  <v-icon>mdi-code-braces</v-icon>
                </template>
              </v-select>

              <!-- Description -->
              <v-textarea
                v-model="form.description"
                label="Describe what you want to build"
                placeholder="E.g., A REST API endpoint for user authentication with JWT tokens, input validation, and error handling"
                variant="outlined"
                rows="4"
                class="mb-4"
                required
                counter="500"
                :rules="[v => v.length <= 500 || 'Description must be less than 500 characters']"
              >
                <template #prepend-inner>
                  <v-icon>mdi-text</v-icon>
                </template>
              </v-textarea>

              <!-- Additional Requirements -->
              <v-textarea
                v-model="form.requirements"
                label="Additional Requirements (Optional)"
                placeholder="E.g., Use TypeScript, include unit tests, follow SOLID principles"
                variant="outlined"
                rows="2"
                class="mb-4"
                counter="300"
              >
                <template #prepend-inner>
                  <v-icon>mdi-list-box</v-icon>
                </template>
              </v-textarea>

              <!-- Code Style -->
              <v-select
                v-model="form.codeStyle"
                :items="codeStyles"
                label="Code Style"
                variant="outlined"
                class="mb-4"
              >
                <template #prepend-inner>
                  <v-icon>mdi-palette</v-icon>
                </template>
              </v-select>

              <!-- Options -->
              <div class="mb-4">
                <h4 class="text-subtitle-2 mb-2">Options</h4>
                <v-checkbox
                  v-model="form.includeComments"
                  label="Include detailed comments"
                  color="primary"
                />
                <v-checkbox
                  v-model="form.includeTests"
                  label="Generate unit tests"
                  color="primary"
                />
                <v-checkbox
                  v-model="form.includeDocumentation"
                  label="Include documentation"
                  color="primary"
                />
              </div>

              <!-- Generate Button -->
              <v-btn
                type="submit"
                color="primary"
                variant="elevated"
                size="large"
                block
                :loading="generating"
                :disabled="!canGenerate"
              >
                <v-icon start>mdi-auto-fix</v-icon>
                Generate Code
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <!-- Generated Code Output -->
        <v-card elevation="2" class="mb-4">
          <v-card-title class="d-flex justify-space-between align-center">
            <span>
              <v-icon class="mr-2">mdi-file-code</v-icon>
              Generated Code
            </span>
            <div v-if="generatedCode">
              <v-btn
                variant="text"
                size="small"
                @click="copyToClipboard"
              >
                <v-icon start>mdi-content-copy</v-icon>
                Copy
              </v-btn>
              <v-btn
                variant="text"
                size="small"
                @click="downloadCode"
              >
                <v-icon start>mdi-download</v-icon>
                Download
              </v-btn>
            </div>
          </v-card-title>
          
          <v-card-text v-if="!generatedCode && !generating" class="text-center py-8">
            <v-icon size="60" color="grey-lighten-2" class="mb-4">
              mdi-code-braces-box
            </v-icon>
            <h3 class="text-subtitle-1 mb-2 text-secondary">No Code Generated Yet</h3>
            <p class="text-body-2 text-grey">
              Fill out the form on the left and click "Generate Code" to get started.
            </p>
          </v-card-text>

          <v-card-text v-else-if="generating" class="text-center py-8">
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
              class="mb-4"
            />
            <h3 class="text-subtitle-1 mb-2">Generating Code...</h3>
            <p class="text-body-2 text-secondary">
              AI is analyzing your requirements and generating code.
            </p>
          </v-card-text>

          <v-card-text v-else class="pa-0">
            <div class="code-container" style="max-height: 600px; overflow-y: auto;">
              <pre class="code-block"><code>{{ generatedCode }}</code></pre>
            </div>
          </v-card-text>
        </v-card>

        <!-- Generation Info -->
        <v-card v-if="lastGeneration" elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-information</v-icon>
            Generation Info
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>Language</v-list-item-title>
                <v-list-item-subtitle>{{ lastGeneration.language }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="lastGeneration.framework">
                <v-list-item-title>Framework</v-list-item-title>
                <v-list-item-subtitle>{{ lastGeneration.framework }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Code Type</v-list-item-title>
                <v-list-item-subtitle>{{ lastGeneration.codeType }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Generated</v-list-item-title>
                <v-list-item-subtitle>{{ formatDateTime(lastGeneration.timestamp) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Lines of Code</v-list-item-title>
                <v-list-item-subtitle>{{ generatedCode?.split('\n').length || 0 }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Generation History Dialog -->
    <v-dialog v-model="historyDialog" max-width="800">
      <v-card>
        <v-card-title>
          <v-icon class="mr-2">mdi-history</v-icon>
          Code Generation History
        </v-card-title>
        
        <v-card-text style="max-height: 500px; overflow-y: auto;">
          <v-list v-if="generationHistory.length > 0">
            <v-list-item
              v-for="(generation, index) in generationHistory"
              :key="index"
              class="mb-2"
              @click="loadFromHistory(generation)"
            >
              <template #prepend>
                <v-icon :color="getLanguageColor(generation.language)">
                  {{ getLanguageIcon(generation.language) }}
                </v-icon>
              </template>
              
              <v-list-item-title>{{ generation.description }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ generation.language }} • {{ formatDateTime(generation.timestamp) }}
              </v-list-item-subtitle>
              
              <template #append>
                <v-btn
                  icon="mdi-restore"
                  size="small"
                  variant="text"
                  @click.stop="loadFromHistory(generation)"
                />
              </template>
            </v-list-item>
          </v-list>
          
          <div v-else class="text-center py-8">
            <v-icon size="60" color="grey-lighten-2" class="mb-4">
              mdi-history
            </v-icon>
            <h3 class="text-subtitle-1 mb-2 text-secondary">No History Yet</h3>
            <p class="text-body-2 text-grey">
              Your code generation history will appear here.
            </p>
          </div>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="historyDialog = false">
            Close
          </v-btn>
          <v-btn
            v-if="generationHistory.length > 0"
            color="error"
            variant="outlined"
            @click="clearHistory"
          >
            Clear History
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
// Define page meta
definePageMeta({ layout: 'user' })

// Require authentication for this page
await useAuthRequired()

// Reactive data
const generating = ref(false)
const generatedCode = ref('')
const historyDialog = ref(false)
const lastGeneration = ref(null)
const generationHistory = ref([])

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Form data
const form = reactive({
  language: 'JavaScript',
  framework: '',
  codeType: 'Component',
  description: '',
  requirements: '',
  codeStyle: 'Standard',
  includeComments: true,
  includeTests: false,
  includeDocumentation: false
})

// Data for dropdowns
const programmingLanguages = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C#',
  'PHP',
  'Ruby',
  'Go',
  'Rust',
  'Swift'
]

const codeTypes = [
  'Component',
  'Function',
  'Class',
  'API Endpoint',
  'Database Schema',
  'Test Suite',
  'Configuration',
  'Utility',
  'Module',
  'Service'
]

const codeStyles = [
  'Standard',
  'Clean Code',
  'Functional',
  'Object-Oriented',
  'Minimal',
  'Verbose',
  'Enterprise'
]

// Code templates
const codeTemplates = ref([
  {
    id: 1,
    name: 'REST API',
    description: 'Create a RESTful API endpoint',
    icon: 'mdi-api',
    color: 'blue',
    language: 'Node.js',
    prompt: 'Create a REST API endpoint for user management with CRUD operations'
  },
  {
    id: 2,
    name: 'React Component',
    description: 'Generate a React functional component',
    icon: 'mdi-react',
    color: 'cyan',
    language: 'React',
    prompt: 'Create a reusable React component with props and state management'
  },
  {
    id: 3,
    name: 'Database Model',
    description: 'Create database models and schemas',
    icon: 'mdi-database',
    color: 'green',
    language: 'SQL',
    prompt: 'Create database tables and relationships for an e-commerce system'
  },
  {
    id: 4,
    name: 'Authentication',
    description: 'Generate authentication logic',
    icon: 'mdi-shield-account',
    color: 'orange',
    language: 'Node.js',
    prompt: 'Create user authentication with JWT tokens and password hashing'
  },
  {
    id: 5,
    name: 'Form Validation',
    description: 'Create form validation logic',
    icon: 'mdi-form-select',
    color: 'purple',
    language: 'JavaScript',
    prompt: 'Create comprehensive form validation with error handling'
  },
  {
    id: 6,
    name: 'Unit Tests',
    description: 'Generate unit test suites',
    icon: 'mdi-test-tube',
    color: 'red',
    language: 'Jest',
    prompt: 'Create unit tests with mocking and assertions'
  }
])

// Computed properties
const canGenerate = computed(() => {
  return form.language && form.codeType && form.description.trim().length > 10
})

// Methods
const getFrameworksForLanguage = (language) => {
  const frameworks = {
    'JavaScript': ['React', 'Vue.js', 'Angular', 'Node.js', 'Express'],
    'TypeScript': ['React', 'Vue.js', 'Angular', 'Node.js', 'NestJS'],
    'Python': ['Django', 'Flask', 'FastAPI', 'Pandas', 'NumPy'],
    'Java': ['Spring Boot', 'Spring MVC', 'Hibernate', 'JUnit'],
    'C#': ['.NET Core', 'ASP.NET', 'Entity Framework', 'Blazor'],
    'PHP': ['Laravel', 'Symfony', 'CodeIgniter', 'WordPress'],
    'Ruby': ['Ruby on Rails', 'Sinatra', 'RSpec'],
    'Go': ['Gin', 'Echo', 'Gorilla', 'Fiber'],
    'Rust': ['Actix', 'Rocket', 'Warp'],
    'Swift': ['SwiftUI', 'UIKit', 'Vapor']
  }
  return frameworks[language] || []
}

const useTemplate = (template) => {
  form.description = template.prompt
  form.language = template.language
  
  // Scroll to the form
  nextTick(() => {
    const formElement = document.querySelector('.v-form')
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

const generateCode = async () => {
  if (!canGenerate.value) return
  
  generating.value = true
  
  try {
    // Simulate API call to AI service
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock generated code based on the form inputs
    const mockCode = generateMockCode()
    generatedCode.value = mockCode
    
    // Save to history
    const generation = {
      ...form,
      timestamp: new Date().toISOString(),
      code: mockCode
    }
    
    lastGeneration.value = generation
    generationHistory.value.unshift(generation)
    
    // Keep only last 20 generations
    if (generationHistory.value.length > 20) {
      generationHistory.value = generationHistory.value.slice(0, 20)
    }
    
    showSnackbar('Code generated successfully!', 'success')
    
  } catch (error) {
    console.error('Code generation failed:', error)
    showSnackbar('Failed to generate code. Please try again.', 'error')
  } finally {
    generating.value = false
  }
}

const generateMockCode = () => {
  const { language, codeType, description } = form
  
  const templates = {
    'JavaScript': {
      'Component': `// ${description}
function MyComponent({ title, onAction }) {
  const [state, setState] = useState('')
  
  const handleClick = () => {
    onAction?.(state)
  }
  
  return (
    <div className="component">
      <h2>{title}</h2>
      <input 
        value={state}
        onChange={(e) => setState(e.target.value)}
        placeholder="Enter text..."
      />
      <button onClick={handleClick}>
        Submit
      </button>
    </div>
  )
}

export default MyComponent`,
      'Function': `// ${description}
function processData(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input provided')
  }
  
  const result = input
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  return result
}

export { processData }`,
      'API Endpoint': `// ${description}
const express = require('express')
const router = express.Router()

router.get('/api/data', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    
    // Simulate data fetching
    const data = await fetchData({ page, limit })
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: data.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router`
    },
    'Python': {
      'Function': `# ${description}
def process_data(input_data):
    """
    Process the input data and return formatted result.
    
    Args:
        input_data (str): The input string to process
        
    Returns:
        str: Processed and formatted string
        
    Raises:
        ValueError: If input_data is not a valid string
    """
    if not isinstance(input_data, str) or not input_data.strip():
        raise ValueError("Invalid input provided")
    
    result = input_data.strip().title()
    return result`,
      'Class': `# ${description}
class DataProcessor:
    def __init__(self, config=None):
        self.config = config or {}
        self.processed_count = 0
    
    def process(self, data):
        """Process the provided data."""
        if not data:
            raise ValueError("No data provided")
        
        result = self._transform(data)
        self.processed_count += 1
        return result
    
    def _transform(self, data):
        """Internal transformation logic."""
        return str(data).upper()
    
    def get_stats(self):
        """Get processing statistics."""
        return {
            'processed_count': self.processed_count,
            'config': self.config
        }`
    }
  }
  
  const langTemplates = templates[language] || templates['JavaScript']
  const template = langTemplates[codeType] || langTemplates['Function'] || 'Code will be generated here...'
  
  return template
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    showSnackbar('Code copied to clipboard!', 'success')
  } catch (error) {
    console.error('Failed to copy:', error)
    showSnackbar('Failed to copy code', 'error')
  }
}

const downloadCode = () => {
  const extension = getFileExtension(form.language)
  const fileName = `generated-code-${Date.now()}.${extension}`
  
  const blob = new Blob([generatedCode.value], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  window.URL.revokeObjectURL(url)
  
  showSnackbar(`Code downloaded as ${fileName}`, 'success')
}

const getFileExtension = (language) => {
  const extensions = {
    'JavaScript': 'js',
    'TypeScript': 'ts',
    'Python': 'py',
    'Java': 'java',
    'C#': 'cs',
    'PHP': 'php',
    'Ruby': 'rb',
    'Go': 'go',
    'Rust': 'rs',
    'Swift': 'swift'
  }
  return extensions[language] || 'txt'
}

const openHistory = () => {
  historyDialog.value = true
}

const loadFromHistory = (generation) => {
  Object.assign(form, generation)
  generatedCode.value = generation.code
  lastGeneration.value = generation
  historyDialog.value = false
  showSnackbar('Loaded from history', 'info')
}

const clearHistory = () => {
  generationHistory.value = []
  historyDialog.value = false
  showSnackbar('History cleared', 'info')
}

const formatDateTime = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getLanguageColor = (language) => {
  const colors = {
    'JavaScript': 'yellow',
    'TypeScript': 'blue',
    'Python': 'green',
    'Java': 'orange',
    'C#': 'purple',
    'PHP': 'indigo',
    'Ruby': 'red',
    'Go': 'cyan',
    'Rust': 'brown',
    'Swift': 'orange'
  }
  return colors[language] || 'grey'
}

const getLanguageIcon = (language) => {
  const icons = {
    'JavaScript': 'mdi-language-javascript',
    'TypeScript': 'mdi-language-typescript',
    'Python': 'mdi-language-python',
    'Java': 'mdi-language-java',
    'C#': 'mdi-language-csharp',
    'PHP': 'mdi-language-php',
    'Ruby': 'mdi-language-ruby',
    'Go': 'mdi-language-go',
    'Rust': 'mdi-language-rust',
    'Swift': 'mdi-language-swift'
  }
  return icons[language] || 'mdi-code-tags'
}

const showSnackbar = (message, color = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}
</script>

<style scoped>
.code-container {
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.code-block {
  margin: 0;
  padding: 16px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.v-card {
  transition: transform 0.2s ease-in-out;
}

.v-card:hover {
  transform: translateY(-2px);
}
</style>
