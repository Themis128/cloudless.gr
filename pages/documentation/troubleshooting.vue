<template>
  <div class="troubleshooting-page">
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
          <v-icon icon="mdi-help-circle" class="me-3" color="primary" />
          Troubleshooting
        </h1>
        <p class="text-h6 text-medium-emphasis">
          Common issues and solutions for the Cloudless.gr platform
        </p>
      </div>
    </div>

    <!-- Search -->
    <v-card class="search-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <v-text-field
          v-model="searchQuery"
          label="Search for issues..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          class="search-field"
          clearable
          @input="filterIssues"
        />

        <div class="search-stats mt-2">
          <v-chip size="small" class="me-2"> {{ filteredIssues.length }} results </v-chip>
          <v-chip
            v-for="category in activeCategories"
            :key="category"
            size="small"
            class="me-2"
            closable
            @click:close="removeCategory(category)"
          >
            {{ category }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>

    <!-- Quick Actions -->
    <v-card class="quick-actions-card mb-8" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">Quick Actions</h3>
        <v-row>
          <v-col v-for="action in quickActions" :key="action.title" cols="12" md="6" lg="3">
            <v-btn
              block
              :color="action.color"
              variant="outlined"
              class="h-100 pa-4"
              :to="action.link"
            >
              <div class="text-center">
                <v-icon :icon="action.icon" size="large" class="mb-2" />
                <div class="text-body-1 font-weight-medium">{{ action.title }}</div>
                <div class="text-body-2 text-medium-emphasis">{{ action.description }}</div>
              </div>
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Issue Categories -->
    <div class="issue-categories">
      <div v-for="category in categories" :key="category.name" class="category-section mb-8">
        <v-card elevation="2">
          <v-card-text class="pa-6">
            <div class="category-header mb-4">
              <h2 class="text-h4 font-weight-bold mb-2">
                <v-icon :icon="category.icon" class="me-3" :color="category.color" />
                {{ category.name }}
              </h2>
              <p class="text-body-1 text-medium-emphasis">{{ category.description }}</p>
            </div>

            <v-expansion-panels class="issue-panels">
              <v-expansion-panel
                v-for="issue in getFilteredIssues(category.name)"
                :key="issue.id"
                :title="issue.title"
              >
                <template #title>
                  <div class="issue-title">
                    <v-chip :color="getSeverityColor(issue.severity)" size="small" class="me-3">
                      {{ issue.severity }}
                    </v-chip>
                    <span class="font-weight-medium">{{ issue.title }}</span>
                  </div>
                </template>

                <v-expansion-panel-text>
                  <div class="issue-content">
                    <div class="issue-description mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Problem</h4>
                      <p class="text-body-1">{{ issue.description }}</p>
                    </div>

                    <div v-if="issue.symptoms" class="issue-symptoms mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Symptoms</h4>
                      <v-list density="compact">
                        <v-list-item v-for="symptom in issue.symptoms" :key="symptom">
                          <template #prepend>
                            <v-icon icon="mdi-alert-circle" size="small" color="warning" />
                          </template>
                          <v-list-item-title>{{ symptom }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </div>

                    <div class="issue-solution mb-4">
                      <h4 class="text-h6 font-weight-bold mb-2">Solution</h4>
                      <div class="solution-steps">
                        <div
                          v-for="(step, index) in issue.solution"
                          :key="index"
                          class="solution-step mb-3"
                        >
                          <div class="step-header mb-2">
                            <v-chip color="primary" size="small" class="me-2">{{
                              index + 1
                            }}</v-chip>
                            <span class="font-weight-medium">{{ step.title }}</span>
                          </div>
                          <p class="text-body-2 mb-2">{{ step.description }}</p>
                          <v-code v-if="step.code" class="solution-code d-block">{{
                            step.code
                          }}</v-code>
                        </div>
                      </div>
                    </div>

                    <div v-if="issue.relatedLinks" class="related-links">
                      <h4 class="text-h6 font-weight-bold mb-2">Related Resources</h4>
                      <div class="links-grid">
                        <v-btn
                          v-for="link in issue.relatedLinks"
                          :key="link.title"
                          :href="link.url"
                          target="_blank"
                          variant="outlined"
                          size="small"
                          class="me-2 mb-2"
                        >
                          {{ link.title }}
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- Contact Support -->
    <v-card class="support-card" elevation="2">
      <v-card-text class="pa-6">
        <h3 class="text-h5 font-weight-bold mb-4">
          <v-icon icon="mdi-headset" class="me-2" color="primary" />
          Still Need Help?
        </h3>
        <p class="text-body-1 mb-4">
          If you can't find a solution to your problem, our support team is here to help.
        </p>

        <v-row>
          <v-col cols="12" md="4">
            <v-card class="support-option h-100" elevation="1">
              <v-card-text class="pa-4 text-center">
                <v-icon icon="mdi-email" size="48" color="primary" class="mb-3" />
                <h4 class="text-h6 font-weight-bold mb-2">Email Support</h4>
                <p class="text-body-2 mb-3">Get detailed help via email</p>
                <v-btn color="primary" href="mailto:support@cloudless.gr"> Contact Support </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card class="support-option h-100" elevation="1">
              <v-card-text class="pa-4 text-center">
                <v-icon icon="mdi-chat" size="48" color="primary" class="mb-3" />
                <h4 class="text-h6 font-weight-bold mb-2">Live Chat</h4>
                <p class="text-body-2 mb-3">Chat with our support team</p>
                <v-btn color="primary" @click="openChat"> Start Chat </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card class="support-option h-100" elevation="1">
              <v-card-text class="pa-4 text-center">
                <v-icon icon="mdi-forum" size="48" color="primary" class="mb-3" />
                <h4 class="text-h6 font-weight-bold mb-2">Community Forum</h4>
                <p class="text-body-2 mb-3">Get help from the community</p>
                <v-btn color="primary" href="https://forum.cloudless.gr" target="_blank">
                  Visit Forum
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
  title: 'Troubleshooting - Documentation',
  description: 'Common issues and solutions for the Cloudless.gr platform',
  layout: 'documentation',
});

interface TroubleshootingIssue {
  id: string;
  title: string;
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  symptoms?: string[];
  solution: Array<{
    title: string;
    description: string;
    code?: string;
  }>;
  relatedLinks?: Array<{
    title: string;
    url: string;
  }>;
}

const searchQuery = ref('');
const activeCategories = ref<string[]>([]);
const filteredIssues = ref<TroubleshootingIssue[]>([]);

const quickActions = [
  {
    title: 'System Status',
    description: 'Check platform status',
    icon: 'mdi-server',
    color: 'success',
    link: 'https://status.cloudless.gr',
  },
  {
    title: 'API Docs',
    description: 'View API reference',
    icon: 'mdi-api',
    color: 'info',
    link: '/documentation/api-reference',
  },
  {
    title: 'User Guide',
    description: 'Read user guide',
    icon: 'mdi-book',
    color: 'primary',
    link: '/documentation/user-guide',
  },
  {
    title: 'Contact Support',
    description: 'Get direct help',
    icon: 'mdi-headset',
    color: 'warning',
    link: 'mailto:support@cloudless.gr',
  },
];

const categories = [
  {
    name: 'Authentication',
    description: 'Login, registration, and account access issues',
    icon: 'mdi-lock',
    color: 'primary',
  },
  {
    name: 'Projects',
    description: 'Project creation, management, and configuration',
    icon: 'mdi-folder',
    color: 'success',
  },
  {
    name: 'Training',
    description: 'Model training, data upload, and experiment tracking',
    icon: 'mdi-brain',
    color: 'info',
  },
  {
    name: 'Deployment',
    description: 'Model deployment, API endpoints, and scaling',
    icon: 'mdi-cloud',
    color: 'warning',
  },
  {
    name: 'API',
    description: 'REST API, authentication tokens, and integration',
    icon: 'mdi-api',
    color: 'error',
  },
  {
    name: 'Performance',
    description: 'Speed, resource usage, and optimization',
    icon: 'mdi-speedometer',
    color: 'purple',
  },
];

const allIssues: TroubleshootingIssue[] = [
  {
    id: 'auth-001',
    title: 'Cannot log in to account',
    category: 'Authentication',
    severity: 'High',
    description: 'Users unable to access their account due to login failures.',
    symptoms: [
      'Invalid credentials error message',
      'Account locked notification',
      'Email verification required',
    ],
    solution: [
      {
        title: 'Verify Credentials',
        description: 'Double-check your email and password. Ensure caps lock is off.',
      },
      {
        title: 'Reset Password',
        description: 'Use the "Forgot Password" link to reset your password.',
        code: 'Visit: https://cloudless.gr/auth/forgot-password',
      },
      {
        title: 'Check Email Verification',
        description:
          'Ensure your email address is verified. Check spam folder for verification email.',
      },
      {
        title: 'Clear Browser Cache',
        description: 'Clear your browser cache and cookies, then try logging in again.',
      },
    ],
    relatedLinks: [
      { title: 'Password Reset', url: '/auth/forgot-password' },
      { title: 'Account Verification', url: '/auth/verify' },
    ],
  },
  {
    id: 'project-001',
    title: 'Project creation fails',
    category: 'Projects',
    severity: 'Medium',
    description: 'Unable to create new projects due to various errors.',
    symptoms: [
      'Timeout during project creation',
      'Invalid template selection',
      'Resource quota exceeded',
    ],
    solution: [
      {
        title: 'Check Resource Limits',
        description: "Verify you haven't exceeded your plan's project limit.",
      },
      {
        title: 'Validate Template',
        description: 'Ensure the selected template is compatible with your account type.',
      },
      {
        title: 'Retry Creation',
        description: 'Wait a few minutes and try creating the project again.',
      },
    ],
  },
  {
    id: 'training-001',
    title: 'Training job stuck in pending',
    category: 'Training',
    severity: 'High',
    description: 'Training jobs remain in pending status and never start.',
    symptoms: [
      'Job status shows "Pending" for extended period',
      'No training logs generated',
      'Resource allocation issues',
    ],
    solution: [
      {
        title: 'Check Resource Availability',
        description: 'Verify sufficient compute resources are available in your region.',
      },
      {
        title: 'Review Job Configuration',
        description: 'Ensure training configuration is valid and within limits.',
        code: `# Check job status via API
curl -H "Authorization: Bearer your-token" \\
  https://api.cloudless.gr/v1/training/jobs/job_123`,
      },
      {
        title: 'Cancel and Restart',
        description: 'Cancel the stuck job and create a new training session.',
      },
    ],
  },
  {
    id: 'deployment-001',
    title: 'Model deployment returns 500 error',
    category: 'Deployment',
    severity: 'Critical',
    description: 'Deployed model endpoints return internal server errors.',
    symptoms: [
      'HTTP 500 Internal Server Error',
      'Deployment shows as "Running" but fails requests',
      'Model loading errors in logs',
    ],
    solution: [
      {
        title: 'Check Model Compatibility',
        description: 'Verify the model format is supported by the deployment environment.',
      },
      {
        title: 'Review Resource Limits',
        description: 'Ensure sufficient memory and CPU are allocated for model inference.',
      },
      {
        title: 'Check Deployment Logs',
        description: 'Review deployment logs for specific error messages.',
        code: `# Get deployment logs
cloudless deployments logs deployment_123 --tail 100`,
      },
      {
        title: 'Redeploy Model',
        description: 'Try redeploying the model with updated configuration.',
      },
    ],
  },
  {
    id: 'api-001',
    title: 'API requests return 401 Unauthorized',
    category: 'API',
    severity: 'Medium',
    description: 'API calls fail with authentication errors.',
    symptoms: [
      'HTTP 401 Unauthorized response',
      'Invalid API token message',
      'Token expired error',
    ],
    solution: [
      {
        title: 'Verify API Token',
        description: "Check that your API token is valid and hasn't expired.",
      },
      {
        title: 'Check Authorization Header',
        description: 'Ensure the Authorization header is properly formatted.',
        code: `curl -H "Authorization: Bearer YOUR_API_TOKEN" \\
  https://api.cloudless.gr/v1/projects`,
      },
      {
        title: 'Generate New Token',
        description: 'Create a new API token if the current one is expired.',
      },
    ],
  },
  {
    id: 'performance-001',
    title: 'Slow model inference',
    category: 'Performance',
    severity: 'Medium',
    description: 'Model predictions take longer than expected.',
    symptoms: [
      'High response times (>5 seconds)',
      'Timeout errors on large requests',
      'Poor user experience',
    ],
    solution: [
      {
        title: 'Optimize Model Size',
        description: 'Use model compression techniques to reduce inference time.',
      },
      {
        title: 'Increase Resources',
        description: 'Scale up your deployment with more CPU/memory resources.',
      },
      {
        title: 'Use Batch Processing',
        description: 'Process multiple requests together for better throughput.',
        code: `# Batch inference example
{
  "instances": [
    {"input": "data1"},
    {"input": "data2"},
    {"input": "data3"}
  ]
}`,
      },
      {
        title: 'Enable Caching',
        description: 'Use response caching for frequently requested predictions.',
      },
    ],
  },
];

const getSeverityColor = (severity: string) => {
  const colors = {
    Low: 'success',
    Medium: 'warning',
    High: 'error',
    Critical: 'red-darken-2',
  };
  return colors[severity as keyof typeof colors] || 'default';
};

const getFilteredIssues = (category: string) => {
  return filteredIssues.value.filter((issue) => issue.category === category);
};

const filterIssues = () => {
  const query = searchQuery.value.toLowerCase();
  if (!query && activeCategories.value.length === 0) {
    filteredIssues.value = allIssues;
    return;
  }

  filteredIssues.value = allIssues.filter((issue) => {
    const matchesSearch =
      !query ||
      issue.title.toLowerCase().includes(query) ||
      issue.description.toLowerCase().includes(query) ||
      issue.symptoms?.some((symptom) => symptom.toLowerCase().includes(query));

    const matchesCategory =
      activeCategories.value.length === 0 || activeCategories.value.includes(issue.category);

    return matchesSearch && matchesCategory;
  });
};

const removeCategory = (category: string) => {
  activeCategories.value = activeCategories.value.filter((c) => c !== category);
  filterIssues();
};

const openChat = () => {
  // Implement chat functionality
  console.log('Opening chat...');
};

// Initialize
onMounted(() => {
  filteredIssues.value = allIssues;
});
</script>

<style scoped>
.troubleshooting-page {
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

.search-card,
.quick-actions-card,
.category-section .v-card,
.support-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.search-field {
  margin-bottom: 16px;
}

.search-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-section {
  margin-bottom: 32px;
}

.issue-title {
  display: flex;
  align-items: center;
  width: 100%;
}

.issue-content {
  padding-top: 16px;
}

.solution-code {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-x: auto;
  margin-top: 8px;
}

.solution-step {
  border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
  padding-left: 16px;
  position: relative;
}

.solution-step::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 4px;
  width: 12px;
  height: 12px;
  background: rgba(var(--v-theme-primary), 0.8);
  border-radius: 50%;
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.links-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.support-option {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.issue-panels {
  background: transparent;
}

@media (max-width: 768px) {
  .troubleshooting-page {
    padding: 16px;
  }

  .issue-title {
    flex-direction: column;
    align-items: flex-start;
  }

  .issue-title .v-chip {
    margin-bottom: 8px;
    margin-right: 0;
  }
}
</style>
