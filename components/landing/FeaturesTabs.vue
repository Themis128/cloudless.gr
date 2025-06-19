<template>
  <section class="tabs-section">
    <v-container>
      <div class="section-header text-center mb-8">
        <h2 class="section-title text-h4 font-weight-bold mb-3">Why Choose Cloudless?</h2>
        <p class="section-subtitle text-h6 mx-auto">
          Everything you need for modern data analytics and cloud workflows
        </p>
      </div>

      <v-tabs
        v-model="activeTab"
        class="features-tabs"
        center-active
        show-arrows
      >
        <v-tab
          v-for="(category, index) in featureCategories"
          :key="index"
          :value="index"
          class="feature-tab"
        >
          <v-icon start>{{ category.icon }}</v-icon>
          {{ category.name }}
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab" class="mt-6">
        <v-tabs-window-item
          v-for="(category, index) in featureCategories"
          :key="index"
          :value="index"
        >
          <v-row>
            <v-col
              v-for="(feature, fIndex) in category.features"
              :key="fIndex"
              cols="12"
              md="4"
            >
              <v-card class="feature-card h-100" elevation="4">
                <v-card-title class="d-flex align-center">
                  <v-icon :color="feature.color" class="me-2">{{ feature.icon }}</v-icon>
                  {{ feature.title }}
                </v-card-title>
                <v-card-text>
                  <p>{{ feature.description }}</p>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-container>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const activeTab = ref(0);

// Feature Categories for Tabs
const featureCategories = [
  {
    name: 'Analytics',
    icon: 'mdi-chart-line',
    features: [
      {
        title: 'Predictive Analytics',
        description: 'Forecast trends and outcomes using advanced machine learning algorithms',
        icon: 'mdi-crystal-ball',
        color: 'primary',
      },
      {
        title: 'Real-time Dashboards',
        description:
          'Monitor your data with live, interactive dashboards that update automatically',
        icon: 'mdi-monitor-dashboard',
        color: 'success',
      },
      {
        title: 'Custom Reports',
        description: 'Generate detailed reports with automated scheduling and distribution',
        icon: 'mdi-file-chart',
        color: 'info',
      },
    ],
  },
  {
    name: 'Data Mining',
    icon: 'mdi-pickaxe',
    features: [
      {
        title: 'Pattern Recognition',
        description: 'Automatically identify patterns and anomalies in your datasets',
        icon: 'mdi-pattern',
        color: 'purple',
      },
      {
        title: 'Classification',
        description:
          'Organize and categorize your data using intelligent classification algorithms',
        icon: 'mdi-tag-multiple',
        color: 'deep-purple',
      },
      {
        title: 'Clustering Analysis',
        description: 'Group similar data points to discover hidden relationships and segments',
        icon: 'mdi-dots-hexagon',
        color: 'indigo',
      },
    ],
  },
  {
    name: 'Integration',
    icon: 'mdi-connection',
    features: [
      {
        title: 'API Connectivity',
        description: 'Connect to any REST API or web service with our flexible connector framework',
        icon: 'mdi-api',
        color: 'teal',
      },
      {
        title: 'Database Support',
        description:
          'Native support for SQL and NoSQL databases including PostgreSQL, MongoDB, and more',
        icon: 'mdi-database',
        color: 'cyan',
      },
      {
        title: 'Cloud Integration',
        description:
          'Seamlessly integrate with AWS, Azure, Google Cloud, and other cloud platforms',
        icon: 'mdi-cloud-sync',
        color: 'light-blue',
      },
    ],
  },
];
</script>

<style scoped>
/* Section Styles */
.tabs-section {
  padding: 2rem 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.02) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  position: relative;
  z-index: 1;
}

.section-header {
  margin-bottom: 2rem;
}

.section-title {
  color: #ffffff;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.6);
  font-weight: 700;
  margin-bottom: 1rem;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  font-weight: 400;
  max-width: 600px;
  margin: 0 auto;
}

/* Tabs Styles */
.features-tabs {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(15px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 2rem;
}

.feature-tab {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.feature-tab.v-tab--selected {
  color: #ffffff;
  font-weight: 600;
}

.feature-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #333333;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 1);
  border-color: rgba(255, 255, 255, 0.5);
}

.feature-card .v-card-title {
  color: #1a1a1a;
  font-weight: 600;
}

.feature-card .v-card-text {
  color: #333333;
}

/* Responsive Design */
@media (max-width: 960px) {
  .tabs-section {
    padding: 3rem 0;
  }
}

@media (max-width: 600px) {
  .section-header {
    margin-bottom: 2rem;
  }
}
</style>
