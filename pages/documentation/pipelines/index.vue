<template>
  <div class="pipelines-documentation-page">
    <LayoutPageStructure
      title="Pipeline Builder Documentation"
      subtitle="Build powerful data processing pipelines with our visual builder"
      :show-back-button="true"
      back-button-to="/documentation"
    >
      <template #main>
        <div class="documentation-content">
          <!-- Quick Navigation -->
          <v-card class="mb-6" elevation="2">
            <v-card-title class="text-h6 bg-primary text-white">
              <v-icon class="mr-2">mdi-map</v-icon>
              Quick Navigation
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col
                  v-for="section in quickNav"
                  :key="section.id"
                  cols="12"
                  sm="6"
                  md="4"
                >
                  <v-btn
                    :to="section.link"
                    variant="outlined"
                    class="w-100 text-left justify-start"
                    :prepend-icon="section.icon"
                  >
                    {{ section.title }}
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Introduction Section -->
          <div id="introduction" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-timeline</v-icon>
              Introduction to Pipeline Builder
            </h2>
            
            <v-card class="mb-4" elevation="1">
              <v-card-text>
                <p class="text-body-1 mb-4">
                  The Cloudless.gr Pipeline Builder is a powerful visual tool for creating data processing workflows. 
                  Transform raw data into actionable insights with our drag-and-drop interface, no coding required.
                </p>
                
                <div class="feature-grid">
                  <div
                    v-for="feature in introFeatures"
                    :key="feature.title"
                    class="feature-item"
                  >
                    <v-icon :color="feature.color" size="32" class="mb-2">
                      {{ feature.icon }}
                    </v-icon>
                    <h4 class="text-h6 mb-2">{{ feature.title }}</h4>
                    <p class="text-body-2">{{ feature.description }}</p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>

          <!-- Pipeline Components Section -->
          <div id="components" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-puzzle</v-icon>
              Pipeline Components
            </h2>
            
            <v-row>
              <v-col
                v-for="component in pipelineComponents"
                :key="component.title"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card class="h-100" elevation="2">
                  <v-card-title class="text-h6">
                    <v-icon :color="component.color" class="mr-2">
                      {{ component.icon }}
                    </v-icon>
                    {{ component.title }}
                  </v-card-title>
                  <v-card-text>
                    <p class="mb-3">{{ component.description }}</p>
                    <div class="component-examples">
                      <h4 class="text-subtitle-2 mb-2">Examples:</h4>
                      <v-chip
                        v-for="example in component.examples"
                        :key="example"
                        size="small"
                        class="mr-1 mb-1"
                        variant="outlined"
                      >
                        {{ example }}
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Use Cases Section -->
          <div id="use-cases" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-lightbulb</v-icon>
              Common Use Cases
            </h2>
            
            <v-expansion-panels class="mb-4" multiple>
              <v-expansion-panel
                v-for="useCase in useCases"
                :key="useCase.title"
                :title="useCase.title"
              >
                <template #title>
                  <div class="d-flex align-center">
                    <v-icon :color="useCase.color" class="mr-3">
                      {{ useCase.icon }}
                    </v-icon>
                    <span class="text-h6">{{ useCase.title }}</span>
                  </div>
                </template>
                
                <template #text>
                  <div class="pa-4">
                    <p class="mb-4">{{ useCase.description }}</p>
                    
                    <div v-if="useCase.steps">
                      <h4 class="text-subtitle-1 mb-2">Pipeline Steps:</h4>
                      <ol>
                        <li v-for="step in useCase.steps" :key="step" class="mb-1">
                          {{ step }}
                        </li>
                      </ol>
                    </div>
                    
                    <div v-if="useCase.benefits">
                      <h4 class="text-subtitle-1 mb-2">Benefits:</h4>
                      <ul>
                        <li v-for="benefit in useCase.benefits" :key="benefit">
                          {{ benefit }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- Best Practices Section -->
          <div id="best-practices" class="section mb-8">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-star</v-icon>
              Best Practices
            </h2>
            
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              Follow these guidelines to create efficient and maintainable pipelines.
            </v-alert>
            
            <v-row>
              <v-col
                v-for="practice in bestPractices"
                :key="practice.title"
                cols="12"
                md="6"
              >
                <v-card class="h-100" elevation="1">
                  <v-card-title class="text-h6">
                    <v-icon :color="practice.color" class="mr-2">
                      {{ practice.icon }}
                    </v-icon>
                    {{ practice.title }}
                  </v-card-title>
                  <v-card-text>
                    <ul>
                      <li
                        v-for="tip in practice.tips"
                        :key="tip"
                        class="mb-2"
                      >
                        {{ tip }}
                      </li>
                    </ul>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Resources Section -->
          <div id="resources" class="section">
            <h2 class="text-h4 mb-4">
              <v-icon class="mr-2" color="primary">mdi-book-open</v-icon>
              Additional Resources
            </h2>
            
            <v-row>
              <v-col
                v-for="resource in resources"
                :key="resource.title"
                cols="12"
                sm="6"
                md="4"
              >
                <v-card class="h-100" elevation="2" :to="resource.link">
                  <v-card-title class="text-h6">
                    <v-icon :color="resource.color" class="mr-2">
                      {{ resource.icon }}
                    </v-icon>
                    {{ resource.title }}
                  </v-card-title>
                  <v-card-text>
                    <p>{{ resource.description }}</p>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :to="resource.link"
                      color="primary"
                      variant="text"
                    >
                      Learn More
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </div>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import PageStructure from '~/components/layout/PageStructure.vue'

// Set page meta
useHead({
  title: 'Pipeline Builder Documentation - Cloudless.gr',
  meta: [
    { name: 'description', content: 'Build powerful data processing pipelines with Cloudless.gr Pipeline Builder. Visual workflow creation for data transformation and analysis.' },
    { property: 'og:title', content: 'Pipeline Builder Documentation - Cloudless.gr' },
    { property: 'og:description', content: 'Create data processing pipelines with our visual builder.' }
  ]
})

// Quick navigation items
const quickNav = [
  { id: 'introduction', title: 'Introduction', link: '#introduction', icon: 'mdi-timeline' },
  { id: 'components', title: 'Components', link: '#components', icon: 'mdi-puzzle' },
  { id: 'use-cases', title: 'Use Cases', link: '#use-cases', icon: 'mdi-lightbulb' },
  { id: 'best-practices', title: 'Best Practices', link: '#best-practices', icon: 'mdi-star' },
  { id: 'resources', title: 'Resources', link: '#resources', icon: 'mdi-book-open' }
]

// Introduction features
const introFeatures = [
  {
    title: 'Visual Builder',
    description: 'Drag-and-drop interface for creating complex data workflows',
    icon: 'mdi-view-dashboard',
    color: 'primary'
  },
  {
    title: 'Data Sources',
    description: 'Connect to databases, APIs, files, and streaming sources',
    icon: 'mdi-database',
    color: 'secondary'
  },
  {
    title: 'Transformations',
    description: 'Clean, filter, aggregate, and transform your data',
    icon: 'mdi-auto-fix',
    color: 'success'
  },
  {
    title: 'Real-time Processing',
    description: 'Process data streams in real-time with low latency',
    icon: 'mdi-lightning-bolt',
    color: 'warning'
  }
]

// Pipeline components
const pipelineComponents = [
  {
    title: 'Data Sources',
    description: 'Connect to various data sources and ingest data into your pipeline.',
    icon: 'mdi-database',
    color: 'primary',
    examples: ['CSV Files', 'APIs', 'Databases', 'Streams']
  },
  {
    title: 'Transformers',
    description: 'Process and transform data using various operations and functions.',
    icon: 'mdi-auto-fix',
    color: 'secondary',
    examples: ['Filters', 'Aggregations', 'Joins', 'Calculations']
  },
  {
    title: 'Validators',
    description: 'Ensure data quality and validate data against schemas and rules.',
    icon: 'mdi-check-circle',
    color: 'success',
    examples: ['Schema Validation', 'Data Quality', 'Business Rules']
  },
  {
    title: 'Outputs',
    description: 'Send processed data to destinations like databases, APIs, or files.',
    icon: 'mdi-export',
    color: 'info',
    examples: ['Databases', 'APIs', 'Files', 'Dashboards']
  },
  {
    title: 'Monitors',
    description: 'Track pipeline performance, errors, and data quality metrics.',
    icon: 'mdi-chart-line',
    color: 'warning',
    examples: ['Performance', 'Error Tracking', 'Data Quality']
  },
  {
    title: 'Triggers',
    description: 'Automatically start pipelines based on events or schedules.',
    icon: 'mdi-timer',
    color: 'error',
    examples: ['Scheduled', 'Event-driven', 'Manual']
  }
]

// Use cases
const useCases = [
  {
    title: 'Data ETL (Extract, Transform, Load)',
    description: 'Extract data from multiple sources, transform it according to business rules, and load it into a data warehouse.',
    icon: 'mdi-database-sync',
    color: 'primary',
    steps: [
      'Extract data from source systems',
      'Clean and validate the data',
      'Apply business transformations',
      'Load into target data warehouse',
      'Generate data quality reports'
    ],
    benefits: [
      'Automated data processing',
      'Improved data quality',
      'Reduced manual effort',
      'Faster insights delivery'
    ]
  },
  {
    title: 'Real-time Analytics',
    description: 'Process streaming data to provide real-time insights and analytics for business decision making.',
    icon: 'mdi-chart-line',
    color: 'success',
    steps: [
      'Connect to streaming data sources',
      'Apply real-time transformations',
      'Calculate aggregations and metrics',
      'Update dashboards and alerts',
      'Store processed data for historical analysis'
    ],
    benefits: [
      'Immediate insights',
      'Proactive decision making',
      'Reduced latency',
      'Better user experience'
    ]
  },
  {
    title: 'Data Quality Monitoring',
    description: 'Continuously monitor data quality and alert stakeholders when issues are detected.',
    icon: 'mdi-shield-check',
    color: 'warning',
    steps: [
      'Define data quality rules',
      'Monitor data streams',
      'Detect anomalies and errors',
      'Generate alerts and reports',
      'Track quality metrics over time'
    ],
    benefits: [
      'Early problem detection',
      'Improved data reliability',
      'Reduced downstream errors',
      'Better compliance'
    ]
  }
]

// Best practices
const bestPractices = [
  {
    title: 'Pipeline Design',
    icon: 'mdi-pencil-ruler',
    color: 'primary',
    tips: [
      'Keep pipelines modular and reusable',
      'Use descriptive names for components',
      'Document data transformations clearly',
      'Plan for error handling and recovery',
      'Consider scalability from the start'
    ]
  },
  {
    title: 'Performance Optimization',
    icon: 'mdi-speedometer',
    color: 'success',
    tips: [
      'Use appropriate data partitioning',
      'Optimize transformation operations',
      'Implement caching where beneficial',
      'Monitor resource usage',
      'Test with realistic data volumes'
    ]
  },
  {
    title: 'Data Quality',
    icon: 'mdi-check-decagram',
    color: 'warning',
    tips: [
      'Validate data at each step',
      'Implement data quality checks',
      'Handle missing and invalid data',
      'Maintain data lineage tracking',
      'Regular quality audits'
    ]
  },
  {
    title: 'Monitoring & Maintenance',
    icon: 'mdi-monitor-dashboard',
    color: 'info',
    tips: [
      'Set up comprehensive monitoring',
      'Create alerts for failures',
      'Track performance metrics',
      'Regular pipeline health checks',
      'Plan for maintenance windows'
    ]
  }
]

// Resources
const resources = [
  {
    title: 'Quick Start Guide',
    description: 'Get started with your first pipeline in minutes',
    icon: 'mdi-rocket-launch',
    color: 'primary',
    link: '/documentation/pipelines/quick-start'
  },
  {
    title: 'API Reference',
    description: 'Complete API documentation for pipeline integration',
    icon: 'mdi-api',
    color: 'secondary',
    link: '/api-reference'
  },
  {
    title: 'Video Tutorials',
    description: 'Step-by-step video guides for pipeline building',
    icon: 'mdi-play-circle',
    color: 'success',
    link: '/tutorials'
  },
  {
    title: 'Community Forum',
    description: 'Connect with other pipeline builders and get help',
    icon: 'mdi-forum',
    color: 'info',
    link: '/community'
  },
  {
    title: 'Pipeline Templates',
    description: 'Pre-built templates for common use cases',
    icon: 'mdi-file-document-multiple',
    color: 'warning',
    link: '/pipelines/templates'
  },
  {
    title: 'Support Center',
    description: 'Get help from our support team',
    icon: 'mdi-help-circle',
    color: 'error',
    link: '/support'
  }
]
</script>

<style scoped>
.pipelines-documentation-page {
  background-color: #f8f9fa;
  min-height: 100vh;
}

.documentation-content {
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  scroll-margin-top: 80px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.feature-item {
  text-align: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.component-examples {
  margin-top: 1rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style> 