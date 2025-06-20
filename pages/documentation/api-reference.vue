<template>
  <div class="api-reference-page">
    <!-- Header -->
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="navigateTo('/documentation')"
      >
        Back to Documentation
      </v-btn>

      <div class="header-content">
        <h1 class="text-h3 font-weight-bold mb-2">
          <v-icon icon="mdi-api" class="me-3" color="primary" />
          API Reference
        </h1>
        <p class="text-h6 text-medium-emphasis">
          Complete API documentation for the Cloudless.gr platform
        </p>
      </div>
    </div>

    <!-- API Overview -->
    <v-card class="overview-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">API Overview</h3>
        <p class="text-body-1 mb-4">
          The Cloudless.gr REST API allows you to programmatically interact with the platform to
          create projects, train models, manage deployments, and monitor performance. All API
          endpoints use JSON for request and response bodies.
        </p>

        <div class="api-info">
          <v-row>
            <v-col cols="12" md="6">
              <div class="info-item">
                <h4 class="text-h6 font-weight-bold mb-2">Base URL</h4>
                <v-code class="api-code">https://api.cloudless.gr/v1</v-code>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="info-item">
                <h4 class="text-h6 font-weight-bold mb-2">Authentication</h4>
                <v-code class="api-code">Bearer {your-api-token}</v-code>
              </div>
            </v-col>
          </v-row>
        </div>
      </v-card-text>
    </v-card>

    <!-- Quick Start -->
    <v-card class="quickstart-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-rocket-launch" class="me-2" color="primary" />
          Quick Start
        </h3>
        <p class="text-body-1 mb-4">Get started with the API in minutes:</p>

        <v-expansion-panels class="quick-start-panels">
          <v-expansion-panel title="1. Get Your API Key">
            <v-expansion-panel-text>
              <p class="mb-3">Generate an API key from your dashboard:</p>
              <v-code class="api-code d-block mb-3">
                curl -X POST https://api.cloudless.gr/v1/auth/tokens \ -H "Content-Type:
                application/json" \ -d '{"email": "your@email.com", "password": "your-password"}'
              </v-code>
              <v-btn color="primary" variant="outlined" @click="navigateTo('/dashboard/api-keys')">
                Generate API Key
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel title="2. Create Your First Project">
            <v-expansion-panel-text>
              <p class="mb-3">Create a new ML project via API:</p>
              <v-code class="api-code d-block">
                curl -X POST https://api.cloudless.gr/v1/projects \ -H "Authorization: Bearer
                your-api-token" \ -H "Content-Type: application/json" \ -d '{ "name": "My First
                Project", "description": "A simple image classifier", "type": "cv", "framework":
                "tensorflow" }'
              </v-code>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel title="3. Start Training">
            <v-expansion-panel-text>
              <p class="mb-3">Start a training session:</p>
              <v-code class="api-code d-block">
                curl -X POST https://api.cloudless.gr/v1/projects/{id}/training \ -H "Authorization:
                Bearer your-api-token" \ -H "Content-Type: application/json" \ -d '{ "name":
                "Training Session 1", "config": { "epochs": 10, "batch_size": 32, "learning_rate":
                0.001 } }'
              </v-code>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>

    <!-- API Sections -->
    <div class="api-sections">
      <div v-for="section in apiSections" :key="section.title" class="section mb-8">
        <v-card elevation="2">
          <v-card-text class="pa-6">
            <div class="section-header mb-4">
              <h3 class="text-h5 font-weight-bold mb-2">
                <v-icon :icon="section.icon" class="me-3" color="primary" />
                {{ section.title }}
              </h3>
              <p class="text-body-1 text-medium-emphasis">{{ section.description }}</p>
            </div>

            <v-expansion-panels class="endpoint-panels">
              <v-expansion-panel
                v-for="endpoint in section.endpoints"
                :key="endpoint.path"
                :title="`${endpoint.method} ${endpoint.path}`"
              >
                <template #title>
                  <div class="endpoint-title">
                    <v-chip :color="getMethodColor(endpoint.method)" size="small" class="me-3">
                      {{ endpoint.method }}
                    </v-chip>
                    <span class="font-weight-medium">{{ endpoint.path }}</span>
                    <span class="text-body-2 text-medium-emphasis ms-3">{{
                      endpoint.summary
                    }}</span>
                  </div>
                </template>

                <v-expansion-panel-text>
                  <div class="endpoint-content">
                    <p class="text-body-1 mb-4">{{ endpoint.description }}</p>

                    <!-- Parameters -->
                    <div v-if="endpoint.parameters" class="mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Parameters</h4>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Type</th>
                            <th scope="col">Required</th>
                            <th scope="col">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="param in endpoint.parameters" :key="param.name">
                            <td>
                              <code>{{ param.name }}</code>
                            </td>
                            <td>{{ param.type }}</td>
                            <td>
                              <v-chip :color="param.required ? 'error' : 'success'" size="x-small">
                                {{ param.required ? 'Yes' : 'No' }}
                              </v-chip>
                            </td>
                            <td>{{ param.description }}</td>
                          </tr>
                        </tbody>
                      </v-table>
                    </div>

                    <!-- Request Example -->
                    <div v-if="endpoint.requestExample" class="mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Request Example</h4>
                      <v-code class="api-code d-block">{{ endpoint.requestExample }}</v-code>
                    </div>

                    <!-- Response Example -->
                    <div v-if="endpoint.responseExample" class="mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Response Example</h4>
                      <v-code class="api-code d-block">{{ endpoint.responseExample }}</v-code>
                    </div>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- SDKs and Libraries -->
    <v-card class="sdks-card" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-code-braces" class="me-2" color="primary" />
          SDKs and Libraries
        </h3>
        <p class="text-body-1 mb-4">
          Use our official SDKs and libraries to integrate with the Cloudless.gr API:
        </p>

        <v-row>
          <v-col v-for="sdk in sdks" :key="sdk.name" cols="12" md="6" lg="4">
            <v-card class="sdk-card h-100" elevation="1">
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                  <v-icon :icon="sdk.icon" color="primary" class="me-3" />
                  <h4 class="text-h6 font-weight-medium">{{ sdk.name }}</h4>
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ sdk.description }}</p>
                <v-code class="api-code d-block mb-3">{{ sdk.install }}</v-code>
                <v-btn
                  :href="sdk.github"
                  target="_blank"
                  variant="outlined"
                  size="small"
                  prepend-icon="mdi-github"
                >
                  View on GitHub
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'API Reference - Documentation',
  description: 'Complete API documentation for the Cloudless.gr platform',
  layout: 'documentation',
});

interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface APIEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters?: APIParameter[];
  requestExample?: string;
  responseExample?: string;
}

interface APISection {
  title: string;
  description: string;
  icon: string;
  endpoints: APIEndpoint[];
}

const apiSections: APISection[] = [
  {
    title: 'Authentication',
    description: 'Manage API tokens and authenticate requests',
    icon: 'mdi-lock',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/tokens',
        summary: 'Create API token',
        description: 'Generate a new API token for authentication',
        parameters: [
          { name: 'email', type: 'string', required: true, description: 'User email address' },
          { name: 'password', type: 'string', required: true, description: 'User password' },
        ],
        requestExample: `curl -X POST https://api.cloudless.gr/v1/auth/tokens \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'`,
        responseExample: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2025-07-20T10:30:00Z",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}`,
      },
    ],
  },
  {
    title: 'Projects',
    description: 'Create and manage ML projects',
    icon: 'mdi-folder',
    endpoints: [
      {
        method: 'GET',
        path: '/projects',
        summary: 'List projects',
        description: 'Retrieve all projects for the authenticated user',
        responseExample: `{
  "projects": [
    {
      "id": "proj_123",
      "name": "Image Classifier",
      "description": "CNN for image classification",
      "type": "cv",
      "status": "active",
      "created_at": "2025-06-20T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1
  }
}`,
      },
      {
        method: 'POST',
        path: '/projects',
        summary: 'Create project',
        description: 'Create a new ML project',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Project name' },
          {
            name: 'description',
            type: 'string',
            required: false,
            description: 'Project description',
          },
          {
            name: 'type',
            type: 'string',
            required: true,
            description: 'Project type (cv, nlp, etc.)',
          },
          { name: 'framework', type: 'string', required: false, description: 'ML framework' },
        ],
        requestExample: `curl -X POST https://api.cloudless.gr/v1/projects \\
  -H "Authorization: Bearer your-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Project",
    "description": "A new ML project",
    "type": "cv",
    "framework": "tensorflow"
  }'`,
        responseExample: `{
  "id": "proj_456",
  "name": "My Project",
  "description": "A new ML project",
  "type": "cv",
  "framework": "tensorflow",
  "status": "draft",
  "created_at": "2025-06-20T11:00:00Z"
}`,
      },
    ],
  },
  {
    title: 'Training',
    description: 'Manage model training sessions',
    icon: 'mdi-brain',
    endpoints: [
      {
        method: 'POST',
        path: '/projects/{id}/training',
        summary: 'Start training',
        description: 'Start a new training session for a project',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
          { name: 'name', type: 'string', required: true, description: 'Training session name' },
          { name: 'config', type: 'object', required: true, description: 'Training configuration' },
        ],
        requestExample: `curl -X POST https://api.cloudless.gr/v1/projects/proj_123/training \\
  -H "Authorization: Bearer your-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Training Session 1",
    "config": {
      "epochs": 50,
      "batch_size": 32,
      "learning_rate": 0.001
    }
  }'`,
      },
    ],
  },
  {
    title: 'Deployments',
    description: 'Deploy and manage model endpoints',
    icon: 'mdi-cloud-upload',
    endpoints: [
      {
        method: 'POST',
        path: '/projects/{id}/deployments',
        summary: 'Create deployment',
        description: 'Deploy a trained model to production',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Project ID' },
          {
            name: 'model_version_id',
            type: 'string',
            required: true,
            description: 'Model version to deploy',
          },
          {
            name: 'environment',
            type: 'string',
            required: false,
            description: 'Deployment environment',
          },
        ],
      },
    ],
  },
];

const sdks = [
  {
    name: 'Python SDK',
    description: 'Official Python SDK for seamless integration',
    icon: 'mdi-language-python',
    install: 'pip install cloudless-sdk',
    github: 'https://github.com/cloudless-gr/python-sdk',
  },
  {
    name: 'JavaScript SDK',
    description: 'Node.js and browser-compatible JavaScript SDK',
    icon: 'mdi-language-javascript',
    install: 'npm install @cloudless/sdk',
    github: 'https://github.com/cloudless-gr/js-sdk',
  },
  {
    name: 'CLI Tool',
    description: 'Command-line interface for automation',
    icon: 'mdi-console',
    install: 'npm install -g @cloudless/cli',
    github: 'https://github.com/cloudless-gr/cli',
  },
];

const getMethodColor = (method: string) => {
  const colors = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'error',
    PATCH: 'info',
  };
  return colors[method as keyof typeof colors] || 'default';
};
</script>

<style scoped>
.api-reference-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: white;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  text-align: center;
  margin-top: 16px;
}

.overview-card,
.quickstart-card,
.section .v-card,
.sdks-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.api-code {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-x: auto;
}

.info-item {
  margin-bottom: 16px;
}

.quick-start-panels,
.endpoint-panels {
  background: transparent;
}

.endpoint-title {
  display: flex;
  align-items: center;
  width: 100%;
}

.endpoint-content {
  padding-top: 16px;
}

.sdk-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.section {
  margin-bottom: 32px;
}

@media (max-width: 768px) {
  .api-reference-page {
    padding: 16px;
  }

  .endpoint-title {
    flex-direction: column;
    align-items: flex-start;
  }

  .endpoint-title .v-chip {
    margin-bottom: 8px;
    margin-right: 0;
  }
}
</style>
