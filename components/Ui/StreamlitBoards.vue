<template>
  <v-container fluid class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <div class="text-center mb-8">
          <h2 class="text-h3 font-weight-bold mb-4">Interactive Dashboards</h2>
          <p class="text-h6 text-medium-emphasis">
            Explore live data visualization and analytics dashboards built with Streamlit
          </p>
        </div>

        <v-row>
          <v-col v-for="dashboard in dashboards" :key="dashboard.id" cols="12" md="6" lg="4">
            <v-card class="dashboard-card h-100" elevation="3" hover>
              <v-img
                :src="dashboard.thumbnail"
                :alt="dashboard.title"
                height="200"
                cover
                class="align-end"
              >
                <div class="dashboard-overlay">
                  <v-chip
                    :color="dashboard.status === 'active' ? 'success' : 'warning'"
                    size="small"
                    variant="elevated"
                  >
                    {{ dashboard.status.toUpperCase() }}
                  </v-chip>
                </div>
              </v-img>

              <v-card-title class="text-h6">
                {{ dashboard.title }}
              </v-card-title>

              <v-card-text>
                <p class="text-body-2 mb-3">
                  {{ dashboard.description }}
                </p>

                <div class="mb-3">
                  <v-chip
                    v-for="tech in dashboard.technologies"
                    :key="tech"
                    class="me-1 mb-1"
                    size="x-small"
                    variant="outlined"
                  >
                    {{ tech }}
                  </v-chip>
                </div>

                <div class="d-flex align-center text-caption text-medium-emphasis">
                  <v-icon size="small" class="me-1">mdi-chart-line</v-icon>
                  {{ dashboard.dataPoints }} data points
                  <v-spacer />
                  <v-icon size="small" class="me-1">mdi-update</v-icon>
                  {{ formatRelativeTime(new Date(dashboard.lastUpdated)) }}
                </div>
              </v-card-text>

              <v-card-actions>
                <v-btn
                  :disabled="dashboard.status !== 'active'"
                  color="primary"
                  variant="elevated"
                  size="small"
                  :href="dashboard.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  append-icon="mdi-open-in-new"
                >
                  Launch Dashboard
                </v-btn>

                <v-spacer />

                <v-btn
                  v-if="dashboard.githubUrl"
                  icon="mdi-github"
                  variant="text"
                  size="small"
                  :href="dashboard.githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <div class="text-center mt-8">
          <v-alert type="info" variant="tonal" class="mb-4">
            <template v-slot:prepend>
              <v-icon>mdi-information</v-icon>
            </template>
            Dashboards may take a moment to load as they're hosted on free-tier services
          </v-alert>

          <v-btn color="primary" variant="outlined" size="large" href="/projects">
            View All Projects
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { useDateFormatting } from '~/composables/useDateFormatting';

  const { formatRelativeTime } = useDateFormatting();

  interface Dashboard {
    id: string;
    title: string;
    description: string;
    url: string;
    githubUrl?: string;
    thumbnail: string;
    status: 'active' | 'maintenance' | 'inactive';
    technologies: string[];
    dataPoints: string;
    lastUpdated: string;
  }

  const dashboards: Dashboard[] = [
    {
      id: 'analytics-dashboard',
      title: 'Web Analytics Dashboard',
      description:
        'Real-time website traffic analysis with interactive charts and key performance indicators.',
      url: 'https://cloudless-analytics.streamlit.app/',
      githubUrl: 'https://github.com/cloudlessuser/analytics-dashboard',
      thumbnail: '/images/dashboards/analytics-thumb.png',
      status: 'active',
      technologies: ['Streamlit', 'Pandas', 'Plotly', 'Google Analytics API'],
      dataPoints: '10K+',
      lastUpdated: '2024-12-15T10:30:00Z',
    },
    {
      id: 'financial-tracker',
      title: 'Financial Data Tracker',
      description:
        'Personal finance tracking with expense categorization and budget visualization.',
      url: 'https://cloudless-finance.streamlit.app/',
      githubUrl: 'https://github.com/cloudlessuser/finance-tracker',
      thumbnail: '/images/dashboards/finance-thumb.png',
      status: 'active',
      technologies: ['Streamlit', 'SQLite', 'Chart.js', 'Python'],
      dataPoints: '5K+',
      lastUpdated: '2024-12-10T14:20:00Z',
    },
    {
      id: 'weather-insights',
      title: 'Weather Insights Board',
      description: 'Historical weather data analysis with predictive modeling and climate trends.',
      url: 'https://cloudless-weather.streamlit.app/',
      thumbnail: '/images/dashboards/weather-thumb.png',
      status: 'maintenance',
      technologies: ['Streamlit', 'OpenWeather API', 'Scikit-learn', 'Matplotlib'],
      dataPoints: '50K+',
      lastUpdated: '2024-12-05T09:15:00Z',
    },
  ];
</script>

<style scoped>
  .dashboard-card {
    transition:
      transform 0.2s ease-in-out,
      box-shadow 0.2s ease-in-out;
  }

  .dashboard-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }

  .dashboard-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
  }
</style>
