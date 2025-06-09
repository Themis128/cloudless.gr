<template>
  <v-container class="py-8" fluid>
    <!-- Header Section -->
    <v-row justify="center" class="mb-12">
      <v-col cols="12" sm="10" md="8" class="text-center">
        <h1 class="text-h2 font-weight-bold text-primary">Code Generation Tools</h1>
        <div class="text-subtitle-1 mx-auto mt-4">
          Powerful AI-assisted code generation tools to accelerate your development workflow and
          boost productivity with intelligent code suggestions and automation.
        </div>
      </v-col>
    </v-row>

    <!-- Tools Grid Section -->
    <v-row>
      <!-- AI Code Assistant Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" :class="{ 'primary-gradient': true }" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary" class="pa-2 mr-3" size="56">
              <span class="text-h4">🤖</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">AI Code Assistant</div>
              <v-chip color="success" size="small" class="mt-1">Available</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Intelligent code completion and generation powered by advanced language models. Get
              context-aware suggestions for functions, components, and entire modules.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in [
                  'Multi-language support',
                  'Context-aware',
                  'Real-time suggestions',
                ]"
                :key="i"
                color="primary"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="primary" variant="elevated" block size="large"> Try AI Assistant </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Component Generator Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary lighten-4" class="pa-2 mr-3" size="56">
              <span class="text-h4">⚡</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">Component Generator</div>
              <v-chip color="success" size="small" class="mt-1">Available</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Generate Vue.js, React, and other framework components with proper structure, styling,
              and functionality based on your specifications.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in [
                  'Vue.js Components',
                  'React Components',
                  'Custom Templates',
                ]"
                :key="i"
                color="primary"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="primary" variant="tonal" block size="large"> Generate Components </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- API Generator Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary lighten-4" class="pa-2 mr-3" size="56">
              <span class="text-h4">🗄️</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">API Generator</div>
              <v-chip color="success" size="small" class="mt-1">Available</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Automatically generate REST API endpoints, database models, and documentation from
              schemas or existing database structures.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in ['REST APIs', 'Database Models', 'Auto Documentation']"
                :key="i"
                color="primary"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="primary" variant="tonal" block size="large"> Create APIs </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- CSS Generator Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="primary lighten-4" class="pa-2 mr-3" size="56">
              <span class="text-h4">🎨</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">CSS Generator</div>
              <v-chip color="success" size="small" class="mt-1">Available</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Generate optimized CSS styles, animations, and responsive layouts with modern design
              patterns and best practices.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in ['Tailwind CSS', 'CSS Animations', 'Responsive Design']"
                :key="i"
                color="primary"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="primary" variant="tonal" block size="large"> Style Generator </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Test Generator Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="grey lighten-3" class="pa-2 mr-3" size="56">
              <span class="text-h4">🧪</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">Test Generator</div>
              <v-chip color="grey" size="small" class="mt-1">Coming Soon</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Automatically generate comprehensive unit tests, integration tests, and end-to-end
              test suites for your applications.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in ['Unit Tests', 'Integration Tests', 'E2E Tests']"
                :key="i"
                color="grey"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="grey" variant="tonal" block size="large" disabled> Coming Soon </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Documentation Generator Card -->
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <div class="d-flex align-center mb-4">
            <v-avatar color="grey lighten-3" class="pa-2 mr-3" size="56">
              <span class="text-h4">📚</span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-medium">Documentation Generator</div>
              <v-chip color="grey" size="small" class="mt-1">Coming Soon</v-chip>
            </div>
          </div>

          <v-card-text class="pt-0 pb-4">
            <p class="mb-4">
              Generate comprehensive documentation from your code comments, API definitions, and
              project structure automatically.
            </p>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="(feature, i) in ['API Docs', 'Code Comments', 'Interactive Docs']"
                :key="i"
                color="grey"
                variant="outlined"
                class="mr-2 mb-2"
                size="small"
              >
                {{ feature }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions class="pt-0">
            <v-btn color="grey" variant="tonal" block size="large" disabled> Coming Soon </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Demo Section -->
    <v-row class="my-12">
      <v-col cols="12" class="text-center">
        <h2 class="text-h3 font-weight-bold text-primary mb-4">See it in Action</h2>
        <p class="text-subtitle-1 mx-auto" style="max-width: 700px">
          Experience our code generation tools with live examples and interactive demos.
        </p>
      </v-col>
    </v-row>

    <v-row justify="center" class="mb-16">
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <v-card-title class="text-h5 font-weight-medium">Interactive Code Demo</v-card-title>
          <v-card-text>
            <p>Try our AI code assistant in a live coding environment.</p>
          </v-card-text>
          <v-card-actions>
            <v-btn to="/responsive-demo" color="primary" variant="tonal" block>
              View Demo <v-icon end icon="mdi-arrow-right"></v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <v-card-title class="text-h5 font-weight-medium">Component Library</v-card-title>
          <v-card-text>
            <p>Browse generated components and see the code behind them.</p>
          </v-card-text>
          <v-card-actions>
            <v-btn color="grey" variant="tonal" block disabled> Coming Soon </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-4 h-100" elevation="3" rounded="lg">
          <v-card-title class="text-h5 font-weight-medium">API Playground</v-card-title>
          <v-card-text>
            <p>Test generated APIs and explore their capabilities.</p>
          </v-card-text>
          <v-card-actions>
            <v-btn color="grey" variant="tonal" block disabled> Coming Soon </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Pricing Section -->
    <v-row class="my-12">
      <v-col cols="12" class="text-center">
        <h2 class="text-h3 font-weight-bold text-primary mb-4">Pricing Plans</h2>
      </v-col>
    </v-row>

    <v-row justify="center" class="mb-16">
      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-6 h-100" elevation="3" rounded="lg">
          <v-card-title class="text-h4 font-weight-medium text-primary mb-4 text-center">
            Free
          </v-card-title>

          <div class="text-h3 font-weight-bold text-primary text-center mb-6">
            $0<span class="text-body-1 text-grey">/month</span>
          </div>

          <v-list density="compact" class="mb-4 bg-transparent">
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Basic code completion"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="50 generations/month"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Community support"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-close-circle"
              title="Advanced AI features"
              class="text-grey-darken-1"
              density="compact"
            ></v-list-item>
          </v-list>

          <v-card-actions class="pt-4">
            <v-btn block size="large" color="blue-grey" variant="elevated"> Get Started </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-6 h-100 primary-border scale-up" elevation="8" rounded="lg">
          <div class="featured-tag">Most Popular</div>

          <v-card-title class="text-h4 font-weight-medium text-primary mb-4 text-center">
            Pro
          </v-card-title>

          <div class="text-h3 font-weight-bold text-primary text-center mb-6">
            $29<span class="text-body-1 text-grey">/month</span>
          </div>

          <v-list density="compact" class="mb-4 bg-transparent">
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Advanced AI assistance"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Unlimited generations"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Custom templates"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Priority support"
              density="compact"
            ></v-list-item>
          </v-list>

          <v-card-actions class="pt-4">
            <v-btn block size="large" color="primary" variant="elevated"> Subscribe Now </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="pa-6 h-100" elevation="3" rounded="lg">
          <v-card-title class="text-h4 font-weight-medium text-primary mb-4 text-center">
            Enterprise
          </v-card-title>

          <div class="text-h3 font-weight-bold text-primary text-center mb-6">
            $99<span class="text-body-1 text-grey">/month</span>
          </div>

          <v-list density="compact" class="mb-4 bg-transparent">
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="All Pro features"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Team collaboration"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Custom AI training"
              density="compact"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-check-circle"
              title="Dedicated support"
              density="compact"
            ></v-list-item>
          </v-list>

          <v-card-actions class="pt-4">
            <v-btn block size="large" color="indigo" variant="elevated"> Contact Sales </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- CTA Section -->
    <v-row class="my-16">
      <v-col cols="12">
        <v-card class="pa-8 text-center" color="primary" rounded="lg" elevation="10">
          <v-card-title class="text-h3 font-weight-bold text-white mb-4">
            Boost Your Productivity Today
          </v-card-title>

          <v-card-text>
            <p class="text-h6 text-white-darken-2 mb-8" style="max-width: 700px; margin: 0 auto">
              Join thousands of developers who already use our AI-powered code generation tools to
              write better code faster.
            </p>

            <div class="d-flex flex-wrap justify-center gap-4">
              <v-btn size="x-large" color="white" class="px-8"> Get Started Free </v-btn>

              <v-btn size="x-large" variant="outlined" color="white" class="px-8">
                Schedule Demo
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  // Set page meta
  definePageMeta({
    layout: 'default',
  });
</script>

<style scoped>
  .primary-gradient {
    background: linear-gradient(
      145deg,
      rgba(239, 246, 255, 0.3),
      rgba(224, 242, 254, 0.3)
    ) !important;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  :deep(.v-card) {
    background: rgba(255, 255, 255, 0.3) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
  }

  :deep(.v-list) {
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  :deep(.v-btn) {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }

  .primary-border {
    border: 2px solid rgba(var(--v-theme-primary), 0.3) !important;
  }

  .scale-up {
    transform: scale(1.05);
  }

  .featured-tag {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(90deg, #1976d2 0%, #42a5f5 100%);
    color: white;
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  /* Responsive adjustments */
  @media (max-width: 960px) {
    .scale-up {
      transform: none;
    }
  }
</style>
