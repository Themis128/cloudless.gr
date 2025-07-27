<template>
  <v-container class="deployment-helper-container">
    <div class="text-center mb-8">
      <h1 class="text-h3 font-weight-bold mb-4">Deployment Helper</h1>
      <p class="text-body-1 text-medium-emphasis">
        Generate deployment configurations and scripts for various platforms and environments.
      </p>
    </div>

    <v-row>
      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="text-h5 mb-4">Project Configuration</v-card-title>
          
          <v-form @submit.prevent="generateDeployment">
            <v-text-field
              v-model="projectName"
              label="Project Name"
              placeholder="my-awesome-app"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-select
              v-model="platform"
              label="Deployment Platform"
              :items="[
                { title: 'Docker', value: 'docker' },
                { title: 'Kubernetes', value: 'kubernetes' },
                { title: 'Vercel', value: 'vercel' },
                { title: 'Netlify', value: 'netlify' },
                { title: 'AWS', value: 'aws' },
                { title: 'Google Cloud', value: 'gcp' },
                { title: 'Azure', value: 'azure' },
                { title: 'Heroku', value: 'heroku' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="framework"
              label="Framework"
              :items="[
                { title: 'Nuxt.js', value: 'nuxt' },
                { title: 'Vue.js', value: 'vue' },
                { title: 'React', value: 'react' },
                { title: 'Next.js', value: 'next' },
                { title: 'Express.js', value: 'express' },
                { title: 'FastAPI', value: 'fastapi' },
                { title: 'Django', value: 'django' },
                { title: 'Flask', value: 'flask' }
              ]"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-textarea
              v-model="projectDescription"
              label="Project Description"
              placeholder="Describe your project and any specific requirements..."
              rows="4"
              variant="outlined"
              class="mb-4"
            ></v-textarea>

            <v-checkbox
              v-model="includeDatabase"
              label="Include database configuration"
              class="mb-4"
            ></v-checkbox>

            <v-checkbox
              v-model="includeMonitoring"
              label="Include monitoring and logging"
              class="mb-4"
            ></v-checkbox>

            <v-btn
              color="primary"
              size="large"
              block
              :loading="isGenerating"
              :disabled="!projectName.trim()"
              @click="generateDeployment"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Deployment' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="6">
        <v-card class="pa-6">
          <v-card-title class="d-flex align-center justify-space-between">
            <span class="text-h5">Generated Configuration</span>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              @click="downloadFiles"
              :disabled="!generatedConfig"
            >
              Download Files
            </v-btn>
          </v-card-title>
          
          <v-card-text>
            <div v-if="generatedConfig" class="deployment-output">
              <v-tabs v-model="activeTab" class="mb-4">
                <v-tab value="dockerfile">Dockerfile</v-tab>
                <v-tab value="docker-compose">Docker Compose</v-tab>
                <v-tab value="kubernetes">Kubernetes</v-tab>
                <v-tab value="scripts">Scripts</v-tab>
              </v-tabs>

              <v-window v-model="activeTab">
                <v-window-item value="dockerfile">
                  <v-textarea
                    :model-value="generatedConfig.dockerfile || 'No Dockerfile generated'"
                    readonly
                    variant="outlined"
                    rows="20"
                    class="font-family-monospace"
                    bg-color="grey-lighten-4"
                  ></v-textarea>
                </v-window-item>

                <v-window-item value="docker-compose">
                  <v-textarea
                    :model-value="generatedConfig.dockerCompose || 'No Docker Compose generated'"
                    readonly
                    variant="outlined"
                    rows="20"
                    class="font-family-monospace"
                    bg-color="grey-lighten-4"
                  ></v-textarea>
                </v-window-item>

                <v-window-item value="kubernetes">
                  <v-textarea
                    :model-value="generatedConfig.kubernetes || 'No Kubernetes config generated'"
                    readonly
                    variant="outlined"
                    rows="20"
                    class="font-family-monospace"
                    bg-color="grey-lighten-4"
                  ></v-textarea>
                </v-window-item>

                <v-window-item value="scripts">
                  <v-textarea
                    :model-value="generatedConfig.scripts || 'No scripts generated'"
                    readonly
                    variant="outlined"
                    rows="20"
                    class="font-family-monospace"
                    bg-color="grey-lighten-4"
                  ></v-textarea>
                </v-window-item>
              </v-window>
            </div>
            <div v-else class="text-center text-medium-emphasis pa-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-rocket-launch</v-icon>
              <p>Generated deployment configuration will appear here...</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-8">
      <v-col cols="12">
        <h2 class="text-h4 text-center mb-6">Deployment Templates</h2>
        <v-row>
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadTemplate('nuxt-docker')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-4">mdi-docker</v-icon>
                <h4 class="text-h6 mb-2">Nuxt.js + Docker</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Full-stack Nuxt.js application with Docker
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadTemplate('react-kubernetes')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-4">mdi-kubernetes</v-icon>
                <h4 class="text-h6 mb-2">React + Kubernetes</h4>
                <p class="text-body-2 text-medium-emphasis">
                  React app with Kubernetes deployment and scaling
                </p>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card
              class="example-card"
              @click="loadTemplate('api-server')"
              hover
            >
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-4">mdi-server</v-icon>
                <h4 class="text-h6 mb-2">API Server</h4>
                <p class="text-body-2 text-medium-emphasis">
                  Express.js API with database and monitoring
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
  title: 'Deployment Helper'
})

// Use tools store
const toolsStore = useToolsStore()

// Reactive state
const projectName = ref('')
const platform = ref('docker')
const framework = ref('nuxt')
const projectDescription = ref('')
const includeDatabase = ref(true)
const includeMonitoring = ref(true)
const isGenerating = ref(false)
const generatedConfig = ref<any>(null)
const activeTab = ref('dockerfile')

const templates = {
  'nuxt-docker': {
    projectName: 'nuxt-app',
    platform: 'docker',
    framework: 'nuxt',
    projectDescription: 'Full-stack Nuxt.js application with SSR, API routes, and database integration',
    includeDatabase: true,
    includeMonitoring: true
  },
  'react-kubernetes': {
    projectName: 'react-app',
    platform: 'kubernetes',
    framework: 'react',
    projectDescription: 'React frontend application with Kubernetes deployment and scaling',
    includeDatabase: false,
    includeMonitoring: true
  },
  'api-server': {
    projectName: 'api-server',
    platform: 'docker',
    framework: 'express',
    projectDescription: 'Express.js API server with MongoDB database and monitoring',
    includeDatabase: true,
    includeMonitoring: true
  }
}

const loadTemplate = (templateKey: string) => {
  const template = templates[templateKey as keyof typeof templates]
  projectName.value = template.projectName
  platform.value = template.platform
  framework.value = template.framework
  projectDescription.value = template.projectDescription
  includeDatabase.value = template.includeDatabase
  includeMonitoring.value = template.includeMonitoring
}

const generateDeployment = async () => {
  if (!projectName.value.trim()) {
    alert('Please enter a project name')
    return
  }

  isGenerating.value = true
  generatedConfig.value = null

  const startTime = Date.now()

  try {
    const prompt = `Generate deployment configuration for a ${framework.value} project named "${projectName.value}" on ${platform.value} platform.

Project Description: ${projectDescription.value}
Include Database: ${includeDatabase.value}
Include Monitoring: ${includeMonitoring.value}

Please generate:
1. Dockerfile for containerization
2. Docker Compose file for local development
3. Kubernetes manifests for production deployment
4. Deployment scripts and documentation

Format the response as JSON with the following structure:
{
  "dockerfile": "Dockerfile content",
  "dockerCompose": "docker-compose.yml content",
  "kubernetes": "Kubernetes YAML content",
  "scripts": "Deployment scripts content"
}`

    const response = await $fetch('/api/generate', {
      method: 'POST',
      body: { prompt }
    }) as any

    const responseText = response?.response || response || 'Failed to generate deployment config'
    
    try {
      // Try to parse JSON response
      generatedConfig.value = JSON.parse(responseText)
    } catch (parseError) {
      // If not JSON, create a basic config
      generatedConfig.value = {
        dockerfile: responseText,
        dockerCompose: '# Docker Compose configuration\n# Generated for ' + projectName.value,
        kubernetes: '# Kubernetes manifests\n# Generated for ' + projectName.value,
        scripts: '# Deployment scripts\n# Generated for ' + projectName.value
      }
    }
    
    // Record tool usage
    const duration = Date.now() - startTime
    toolsStore.recordToolUsage('deployment-helper', true, duration)
  } catch (error) {
    console.error('Error generating deployment:', error)
    generatedConfig.value = {
      dockerfile: '# Error generating deployment configuration',
      dockerCompose: '# Please try again',
      kubernetes: '# Error occurred',
      scripts: '# Generation failed'
    }
  } finally {
    isGenerating.value = false
  }
}

const downloadFiles = () => {
  if (!generatedConfig.value) return
  
  // Create a zip file with all generated files
  const files = [
    { name: 'Dockerfile', content: generatedConfig.value.dockerfile || '' },
    { name: 'docker-compose.yml', content: generatedConfig.value.dockerCompose || '' },
    { name: 'kubernetes.yaml', content: generatedConfig.value.kubernetes || '' },
    { name: 'deploy.sh', content: generatedConfig.value.scripts || '' }
  ]
  
  // For now, just download the Dockerfile
  const dataStr = generatedConfig.value.dockerfile || 'No content generated'
  const dataBlob = new Blob([dataStr], { type: 'text/plain' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Dockerfile'
  link.click()
  URL.revokeObjectURL(url)
}

// Record tool usage on mount
onMounted(() => {
  toolsStore.recordToolUsage('deployment-helper')
})
</script>

<style scoped>
.deployment-helper-container {
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

.deployment-output {
  max-height: 600px;
  overflow-y: auto;
}
</style> 