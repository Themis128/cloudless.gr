<template>
  <v-container class="database-generator-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">Database Generator</h1>
      <p class="text-body-1 text-medium-emphasis">
        Generate database schemas, migrations, and queries from your models with AI assistance.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Input</v-card-title>
          
          <v-form @submit.prevent="generateDatabase">
            <v-textarea
              v-model="modelInput"
              label="Model Definition"
              placeholder="Paste your model definitions here..."
              rows="12"
              variant="outlined"
              class="mb-4 font-family-monospace"
              auto-grow
            ></v-textarea>

            <v-select
              v-model="databaseType"
              label="Database Type"
              :items="[
                { title: 'PostgreSQL', value: 'postgresql' },
                { title: 'MySQL', value: 'mysql' },
                { title: 'SQLite', value: 'sqlite' },
                { title: 'MongoDB', value: 'mongodb' },
                { title: 'Prisma Schema', value: 'prisma' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="outputType"
              label="Output Type"
              :items="[
                { title: 'SQL Schema', value: 'schema' },
                { title: 'Migration Script', value: 'migration' },
                { title: 'Prisma Schema', value: 'prisma' },
                { title: 'TypeORM Entity', value: 'typeorm' },
                { title: 'Sequelize Model', value: 'sequelize' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-checkbox
              v-model="includeIndexes"
              label="Include indexes and constraints"
              class="mb-4"
            ></v-checkbox>

            <v-btn
              color="primary"
              size="large"
              block
              :loading="isGenerating"
              :disabled="!modelInput.trim()"
              @click="generateDatabase"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Database' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Generated Database</span>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              @click="copyToClipboard"
              :disabled="!generatedOutput"
            >
              Copy to Clipboard
            </v-btn>
          </v-card-title>
          
          <v-card-text>
            <v-textarea
              v-if="generatedOutput"
              :model-value="generatedOutput"
              readonly
              variant="outlined"
              rows="25"
              class="font-family-monospace"
              bg-color="grey-lighten-4"
            ></v-textarea>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-database</v-icon>
              <p>Generated database code will appear here...</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-8">
      <v-col cols="12">
        <h2 class="text-h4 text-center mb-6">Example Models</h2>
        <v-row>
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('user-model')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-account</v-icon>
                <h4 class="text-h6 mb-2">User Model</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Basic user model with authentication fields
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('ecommerce-model')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-4">mdi-cart</v-icon>
                <h4 class="text-h6 mb-2">E-commerce Model</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Product, order, and customer models
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadExample('blog-model')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-4">mdi-post</v-icon>
                <h4 class="text-h6 mb-2">Blog Model</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Blog post and comment models
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

definePageMeta({
  title: 'Database Generator'
})

// Use tools store
const toolsStore = useToolsStore()

// Reactive state
const modelInput = ref('')
const databaseType = ref('postgresql')
const outputType = ref('schema')
const includeIndexes = ref(true)
const isGenerating = ref(false)
const generatedOutput = ref('')

const examples = {
  'user-model': `class User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}`,
  'ecommerce-model': `class Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: string[];
  createdAt: Date;
}

class Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
  createdAt: Date;
}

class Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  address: Address;
  phone: string;
  createdAt: Date;
}`,
  'blog-model': `class Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  published: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  approved: boolean;
  createdAt: Date;
}`
}

const loadExample = (exampleKey: string) => {
  modelInput.value = examples[exampleKey as keyof typeof examples]
}

const generateDatabase = async () => {
  if (!modelInput.value.trim()) {
    alert('Please enter model definitions')
    return
  }

  isGenerating.value = true
  generatedOutput.value = ''

  const startTime = Date.now()

  try {
    const prompt = `Generate ${outputType.value} for ${databaseType.value} database from the following model definitions:

${modelInput.value}

Please include:
- Proper table/collection structure
- Data types and constraints
- ${includeIndexes.value ? 'Indexes and foreign key relationships' : 'Basic structure only'}
- ${outputType.value === 'migration' ? 'Migration script with up/down methods' : 'Schema definition'}

Format the output as clean, well-structured ${outputType.value === 'prisma' ? 'Prisma schema' : 'SQL'} code.`

    const response = await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt }
    }) as any

    generatedOutput.value = response?.response || response || 'Failed to generate database code'
    
    // Record tool usage
    const duration = Date.now() - startTime
    toolsStore.recordToolUsage('database-generator', true, duration)
  } catch (error) {
    console.error('Error generating database:', error)
    generatedOutput.value = 'Error generating database code. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

const copyToClipboard = async () => {
  if (!generatedOutput.value) return
  
  try {
    await navigator.clipboard.writeText(generatedOutput.value)
    alert('Database code copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
    alert('Failed to copy to clipboard')
  }
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('database-generator')
})
</script>

<style scoped>
.database-generator-container {
  max-width: 1200px;
  margin: 0 auto;
}

.example-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.example-card:hover {
  transform: translateY(-2px);
}

.font-family-monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style> 