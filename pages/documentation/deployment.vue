<template>
  <div>
    <LayoutPageStructure
      title="Deployment Documentation"
      subtitle="Learn how to deploy your applications and services"
      back-button-to="/documentation"
      :has-sidebar="false"
      :white-header="true"
    >
      <template #main>
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h5">
            <v-icon start color="primary">mdi-rocket-launch</v-icon>
            Deployment Overview
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Deployment is the process of making your applications and services available to users.
              Our platform provides comprehensive deployment tools for various environments and configurations.
            </p>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Note:</strong> Proper deployment practices ensure reliability, scalability, and security of your applications.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-cloud</v-icon>
            Deployment Environments
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="green" class="mb-2">mdi-laptop</v-icon>
                  <h5 class="text-h6">Development</h5>
                  <p class="text-body-2 mb-3">Local development environment for testing and debugging</p>
                  <v-chip color="success" size="small">Ready</v-chip>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="orange" class="mb-2">mdi-test-tube</v-icon>
                  <h5 class="text-h6">Staging</h5>
                  <p class="text-body-2 mb-3">Pre-production environment for final testing</p>
                  <v-chip color="warning" size="small">Testing</v-chip>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="red" class="mb-2">mdi-earth</v-icon>
                  <h5 class="text-h6">Production</h5>
                  <p class="text-body-2 mb-3">Live environment serving real users</p>
                  <v-chip color="error" size="small">Live</v-chip>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-docker</v-icon>
            Container Deployment
          </v-card-title>
          <v-card-text>
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Docker Configuration</h4>
              <p class="text-body-2 mb-3">
                Our platform supports Docker-based deployments for consistent and reliable application delivery.
              </p>
              
              <v-code-block
                language="dockerfile"
                :code="dockerfileExample"
                class="mb-4"
              />
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Docker Compose</h4>
              <p class="text-body-2 mb-3">
                Use Docker Compose for multi-service deployments:
              </p>
              
              <v-code-block
                language="yaml"
                :code="dockerComposeExample"
                class="mb-4"
              />
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-cog-sync</v-icon>
            CI/CD Pipeline
          </v-card-title>
          <v-card-text>
            <v-stepper v-model="currentStep" class="mb-4">
              <v-stepper-header>
                <v-stepper-item value="1" title="Build" subtitle="Compile and test">
                  <template #icon>
                    <v-icon>mdi-hammer-wrench</v-icon>
                  </template>
                </v-stepper-item>
                
                <v-divider></v-divider>
                
                <v-stepper-item value="2" title="Test" subtitle="Run automated tests">
                  <template #icon>
                    <v-icon>mdi-test-tube</v-icon>
                  </template>
                </v-stepper-item>
                
                <v-divider></v-divider>
                
                <v-stepper-item value="3" title="Deploy" subtitle="Deploy to environment">
                  <template #icon>
                    <v-icon>mdi-rocket-launch</v-icon>
                  </template>
                </v-stepper-item>
              </v-stepper-header>
              
              <v-stepper-window>
                <v-stepper-window-item value="1">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Build Stage</h4>
                    <p class="text-body-2">Compile source code, install dependencies, and create artifacts.</p>
                    <v-alert type="info" variant="tonal" class="mt-2">
                      Build artifacts are cached for faster subsequent builds.
                    </v-alert>
                  </div>
                </v-stepper-window-item>
                
                <v-stepper-window-item value="2">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Test Stage</h4>
                    <p class="text-body-2">Run unit tests, integration tests, and security scans.</p>
                    <v-alert type="success" variant="tonal" class="mt-2">
                      All tests must pass before deployment proceeds.
                    </v-alert>
                  </div>
                </v-stepper-window-item>
                
                <v-stepper-window-item value="3">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Deploy Stage</h4>
                    <p class="text-body-2">Deploy to target environment with zero-downtime updates.</p>
                    <v-alert type="warning" variant="tonal" class="mt-2">
                      Rollback is available if deployment fails.
                    </v-alert>
                  </div>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-shield-check</v-icon>
            Security & Monitoring
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Security Measures</h4>
                <ul class="text-body-2">
                  <li>SSL/TLS encryption for all connections</li>
                  <li>Environment variable management</li>
                  <li>Secrets and API key protection</li>
                  <li>Network security and firewalls</li>
                  <li>Regular security updates</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Monitoring & Alerts</h4>
                <ul class="text-body-2">
                  <li>Application performance monitoring</li>
                  <li>Error tracking and logging</li>
                  <li>Resource usage monitoring</li>
                  <li>Uptime and availability tracking</li>
                  <li>Automated alert notifications</li>
                </ul>
              </v-col>
            </v-row>
            
            <v-alert type="error" variant="tonal" class="mt-4">
              <template #prepend>
                <v-icon>mdi-alert-circle</v-icon>
              </template>
              <strong>Important:</strong> Always test deployments in staging environments before production deployment.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chart-line</v-icon>
            Performance Optimization
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="primary" class="mb-2">mdi-speedometer</v-icon>
                  <h5 class="text-h6">Load Balancing</h5>
                  <p class="text-body-2">Distribute traffic across multiple instances</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="success" class="mb-2">mdi-cache</v-icon>
                  <h5 class="text-h6">Caching</h5>
                  <p class="text-body-2">Implement CDN and application caching</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="info" class="mb-2">mdi-database</v-icon>
                  <h5 class="text-h6">Database</h5>
                  <p class="text-body-2">Optimize database queries and connections</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="warning" class="mb-2">mdi-compress</v-icon>
                  <h5 class="text-h6">Compression</h5>
                  <p class="text-body-2">Enable gzip and asset compression</p>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-help-circle</v-icon>
            Troubleshooting
          </v-card-title>
          <v-card-text>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="error">mdi-alert</v-icon>
                  Deployment Fails
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2">Check build logs, environment variables, and resource limits.</p>
                  <v-btn color="primary" variant="text" size="small" class="mt-2">
                    View Logs
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="warning">mdi-clock-outline</v-icon>
                  Slow Performance
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2">Monitor resource usage, optimize code, and scale resources.</p>
                  <v-btn color="primary" variant="text" size="small" class="mt-2">
                    Performance Metrics
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="info">mdi-connection</v-icon>
                  Connection Issues
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2">Verify network configuration, DNS settings, and firewall rules.</p>
                  <v-btn color="primary" variant="text" size="small" class="mt-2">
                    Network Diagnostics
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Reactive data
const currentStep = ref(1)

// Code examples
const dockerfileExample = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`

const dockerComposeExample = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password`

// SEO Meta Tags
useHead({
  title: 'Deployment Documentation - Cloudless',
  meta: [
    { name: 'description', content: 'Learn how to deploy your applications and services effectively with our comprehensive documentation.' },
    { property: 'og:title', content: 'Deployment Documentation - Cloudless' },
    { property: 'og:description', content: 'Application deployment documentation and best practices' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Deployment Documentation - Cloudless' },
    { name: 'twitter:description', content: 'Application deployment documentation and best practices' }
  ]
})

// Page Meta
definePageMeta({
  title: 'Deployment Documentation',
  description: 'Learn how to deploy your applications and services'
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding-bottom: 1rem;
}

.v-alert {
  border-radius: 8px;
}

.h-100 {
  height: 100%;
}
</style> 