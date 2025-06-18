<template>
  <div class="cloudless-demo">
    <!-- Header Section -->
    <div class="demo-header">
      <div class="header-content">
        <div class="header-title">
          <v-avatar
            size="40"
            class="me-4"
            style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          >
            <v-icon icon="mdi-cloud-braces" size="24" color="white" />
          </v-avatar>
          <div class="title-content">
            <h3 class="text-h5 font-weight-bold mb-1">Cloudless Workflow Demo</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Build powerful analytics without code
            </p>
          </div>
        </div>
        <v-chip
          color="success"
          variant="tonal"
          size="small"
          prepend-icon="mdi-check-circle"
        >
          Live Demo
        </v-chip>
      </div>
    </div>

    <!-- Workflow Steps -->
    <div class="workflow-container mt-4">
      <div class="workflow-steps">
        <!-- Step 1: Data Input -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 1, completed: currentStep > 1 }"
          @click="setStep(1)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 1 ? 'white' : 'primary'" size="20">
              mdi-database-import
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Data Input</h4>
            <p class="step-description">Connect your data sources</p>
            <div v-if="currentStep === 1" class="step-details">
              <div class="data-sources-visual">
                <div class="source-item" v-for="source in dataSources" :key="source.name">
                  <v-avatar :color="source.color" size="32" class="mb-2">
                    <v-icon :icon="source.icon" size="18" color="white" />
                  </v-avatar>
                  <div class="source-info">
                    <div class="source-name">{{ source.name }}</div>
                    <div class="source-size">{{ source.size }}</div>
                    <v-progress-linear
                      :model-value="source.progress"
                      :color="source.color"
                      height="4"
                      rounded
                      class="mt-1"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-3">
                <v-chip-group>
                  <v-chip size="small" color="info" variant="tonal">CSV Files</v-chip>
                  <v-chip size="small" color="success" variant="tonal">APIs</v-chip>
                  <v-chip size="small" color="warning" variant="tonal">Databases</v-chip>
                  <v-chip size="small" color="purple" variant="tonal">Cloud Storage</v-chip>
                </v-chip-group>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Data Validation -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 2, completed: currentStep > 2 }"
          @click="setStep(2)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 2 ? 'white' : 'primary'" size="20">
              mdi-check-circle-outline
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Data Validation</h4>
            <p class="step-description">Automatically validate and clean data</p>
            <div v-if="currentStep === 2" class="step-details">
              <div class="validation-metrics">
                <div class="metric-row">
                  <span class="metric-label">Data Quality</span>
                  <v-progress-linear
                    :model-value="validationMetrics.quality"
                    color="success"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="metric-value">{{ validationMetrics.quality }}%</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Completeness</span>
                  <v-progress-linear
                    :model-value="validationMetrics.completeness"
                    color="info"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="metric-value">{{ validationMetrics.completeness }}%</span>
                </div>
                <div class="metric-row">
                  <span class="metric-label">Consistency</span>
                  <v-progress-linear
                    :model-value="validationMetrics.consistency"
                    color="warning"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="metric-value">{{ validationMetrics.consistency }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Smart Processing -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 3, completed: currentStep > 3 }"
          @click="setStep(3)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 3 ? 'white' : 'primary'" size="20">
              mdi-cog-clockwise
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Smart Processing</h4>
            <p class="step-description">AI-powered data transformation</p>
            <div v-if="currentStep === 3" class="step-details">
              <div class="processing-pipeline">
                <div class="pipeline-stage" v-for="stage in processingStages" :key="stage.name">
                  <div class="stage-icon">
                    <v-icon :color="stage.active ? 'primary' : 'grey'" size="16">{{ stage.icon }}</v-icon>
                  </div>
                  <div class="stage-info">
                    <div class="stage-name">{{ stage.name }}</div>
                    <v-progress-linear
                      :model-value="stage.progress"
                      color="primary"
                      height="4"
                      rounded
                      :class="{ 'opacity-50': !stage.active }"
                    />
                  </div>
                </div>
              </div>
              <div class="processing-stats mt-3">
                <div class="stat-chip">
                  <v-icon size="14" color="success">mdi-speedometer</v-icon>
                  <span>{{ processingSpeed }}x faster</span>
                </div>
                <div class="stat-chip">
                  <v-icon size="14" color="info">mdi-memory</v-icon>
                  <span>{{ memoryUsage }}% memory</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: ML Analytics -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 4, completed: currentStep > 4 }"
          @click="setStep(4)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 4 ? 'white' : 'primary'" size="20">
              mdi-brain
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">ML Analytics</h4>
            <p class="step-description">Advanced machine learning insights</p>
            <div v-if="currentStep === 4" class="step-details">
              <div class="ml-models">
                <div class="model-card" v-for="model in mlModels" :key="model.name">
                  <div class="model-header">
                    <v-icon :color="model.color" size="16" class="mr-2">{{ model.icon }}</v-icon>
                    <span class="model-name">{{ model.name }}</span>
                    <v-chip size="x-small" :color="model.status === 'trained' ? 'success' : 'warning'" variant="tonal">
                      {{ model.status }}
                    </v-chip>
                  </div>
                  <div class="model-accuracy">
                    <span class="accuracy-label">Accuracy</span>
                    <span class="accuracy-value">{{ model.accuracy }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 5: Data Visualization -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 5, completed: currentStep > 5 }"
          @click="setStep(5)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 5 ? 'white' : 'primary'" size="20">
              mdi-chart-line
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Visualization</h4>
            <p class="step-description">Interactive charts and dashboards</p>
            <div v-if="currentStep === 5" class="step-details">
              <div class="chart-previews">
                <div class="chart-item" v-for="chart in chartTypes" :key="chart.type">
                  <div class="chart-icon">
                    <v-icon :color="chart.color" size="20">{{ chart.icon }}</v-icon>
                  </div>
                  <div class="chart-info">
                    <div class="chart-name">{{ chart.name }}</div>
                    <div class="chart-data">{{ chart.dataPoints }} data points</div>
                  </div>
                  <div class="chart-visual">
                    <svg width="40" height="20" viewBox="0 0 40 20">
                      <path
                        :d="chart.path"
                        :stroke="chart.color"
                        stroke-width="1.5"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: Report Generation -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 6, completed: currentStep > 6 }"
          @click="setStep(6)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 6 ? 'white' : 'primary'" size="20">
              mdi-file-document-outline
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Report Generation</h4>
            <p class="step-description">Automated insights and reports</p>
            <div v-if="currentStep === 6" class="step-details">
              <div class="report-preview">
                <div class="report-item" v-for="report in reportTypes" :key="report.type">
                  <v-icon :color="report.color" size="16" class="mr-2">{{ report.icon }}</v-icon>
                  <span class="report-name">{{ report.name }}</span>
                  <v-chip size="x-small" color="success" variant="tonal" class="ml-auto">
                    Generated
                  </v-chip>
                </div>
              </div>
              <div class="report-actions mt-3">
                <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-download">
                  Download PDF
                </v-btn>
                <v-btn size="small" color="info" variant="tonal" prepend-icon="mdi-share" class="ml-2">
                  Share Report
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 7: Deploy -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 7, completed: currentStep > 7 }"
          @click="setStep(7)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 7 ? 'white' : 'primary'" size="20">
              mdi-rocket-launch
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Deploy & Monitor</h4>
            <p class="step-description">One-click cloud deployment</p>
            <div v-if="currentStep === 7" class="step-details">
              <div class="deployment-info">
                <div class="deployment-status">
                  <v-icon color="success" size="16" class="mr-2">mdi-check-circle</v-icon>
                  <span>Deployed to AWS Cloud</span>
                </div>
                <div class="deployment-metrics">
                  <div class="metric-item">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">99.9%</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Response</span>
                    <span class="metric-value">45ms</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Requests</span>
                    <span class="metric-value">{{ requestCount.toLocaleString() }}/day</span>
                  </div>
                </div>
              </div>
              <v-btn
                color="success"
                variant="tonal"
                size="small"
                prepend-icon="mdi-cloud-upload"
                :loading="deploying"
                @click="simulateDeploy"
                class="mt-2"
              >
                {{ deploying ? 'Deploying...' : 'Deploy to Cloud' }}
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive Controls -->
    <div class="demo-controls mt-6">
      <div class="d-flex align-center justify-space-between">
        <div class="demo-info">
          <v-icon color="info" size="16" class="me-2">mdi-information</v-icon>
          <span class="text-body-2 text-medium-emphasis">
            Click any step to see how Cloudless works
          </span>
        </div>
        <div class="demo-actions">
          <v-btn
            variant="outlined"
            size="small"
            prepend-icon="mdi-play"
            :disabled="demoPlaying"
            @click="playDemo"
          >
            {{ demoPlaying ? 'Playing...' : 'Play Demo' }}
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-refresh"
            class="ml-2"
            @click="resetDemo"
          >
            Reset
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Feature Highlights -->
    <div class="feature-highlights mt-6">
      <v-row>
        <v-col cols="12" sm="4">
          <div class="feature-card">
            <v-icon color="primary" size="24" class="mb-2">mdi-mouse</v-icon>
            <h5 class="text-subtitle-1 font-weight-medium mb-1">No Code Required</h5>
            <p class="text-body-2 text-medium-emphasis">
              Build complex workflows with simple drag-and-drop
            </p>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="feature-card">
            <v-icon color="success" size="24" class="mb-2">mdi-brain</v-icon>
            <h5 class="text-subtitle-1 font-weight-medium mb-1">AI-Powered</h5>
            <p class="text-body-2 text-medium-emphasis">
              Intelligent automation for data processing and analysis
            </p>
          </div>
        </v-col>
        <v-col cols="12" sm="4">
          <div class="feature-card">
            <v-icon color="warning" size="24" class="mb-2">mdi-lightning-bolt</v-icon>
            <h5 class="text-subtitle-1 font-weight-medium mb-1">Lightning Fast</h5>
            <p class="text-body-2 text-medium-emphasis">Deploy in minutes, not months</p>
          </div>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

// Reactive state
const currentStep = ref(1);
const processingProgress = ref(0);
const processingText = ref('Initializing...');
const animatedMetric = ref(0);
const deploying = ref(false);
const demoPlaying = ref(false);

// Animation intervals
let processingInterval: NodeJS.Timeout | null = null;
let metricInterval: NodeJS.Timeout | null = null;

// Processing texts for animation
const processingTexts = [
  'Initializing...',
  'Analyzing data patterns...',
  'Applying ML algorithms...',
  'Optimizing performance...',
  'Finalizing results...',
];

const setStep = (step: number) => {
  if (demoPlaying.value) return;

  currentStep.value = step;
  startAnimations();
};

const startAnimations = () => {
  // Clear existing intervals
  if (processingInterval) clearInterval(processingInterval);
  if (metricInterval) clearInterval(metricInterval);

  if (currentStep.value === 2) {
    // Processing animation
    processingProgress.value = 0;
    let textIndex = 0;

    processingInterval = setInterval(() => {
      processingProgress.value += 2;

      if (processingProgress.value % 20 === 0) {
        textIndex = (textIndex + 1) % processingTexts.length;
        processingText.value = processingTexts[textIndex];
      }

      if (processingProgress.value >= 100) {
        processingProgress.value = 100;
        processingText.value = 'Complete!';
        if (processingInterval) clearInterval(processingInterval);
      }
    }, 100);
  }

  if (currentStep.value === 3) {
    // Metrics animation
    animatedMetric.value = 0;
    metricInterval = setInterval(() => {
      animatedMetric.value += 1;
      if (animatedMetric.value >= 94) {
        animatedMetric.value = 94;
        if (metricInterval) clearInterval(metricInterval);
      }
    }, 50);
  }
};

const simulateDeploy = async () => {
  deploying.value = true;
  await new Promise((resolve) => setTimeout(resolve, 2000));
  deploying.value = false;

  // Show success notification
  // You can add a toast notification here
};

const playDemo = async () => {
  demoPlaying.value = true;

  for (let step = 1; step <= 4; step++) {
    currentStep.value = step;
    startAnimations();
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  demoPlaying.value = false;
};

const resetDemo = () => {
  currentStep.value = 1;
  processingProgress.value = 0;
  processingText.value = 'Initializing...';
  animatedMetric.value = 0;
  deploying.value = false;
  demoPlaying.value = false;

  if (processingInterval) clearInterval(processingInterval);
  if (metricInterval) clearInterval(metricInterval);
};

onMounted(() => {
  startAnimations();
});

onUnmounted(() => {
  if (processingInterval) clearInterval(processingInterval);
  if (metricInterval) clearInterval(metricInterval);
});
</script>

<style scoped>
.cloudless-demo {
  width: 100%;
  max-width: 100%;
}

.demo-header {
  margin-bottom: 18px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
}

.title-content h3 {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  line-height: 1.2;
  font-size: 1.4rem;
  font-weight: 700;
}

.title-content p {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: 500;
}

.workflow-container {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.workflow-step {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.workflow-step:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
}

.workflow-step.active {
  border-color: rgba(25, 118, 210, 0.4);
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.9) 0%, rgba(21, 101, 192, 0.9) 100%);
  backdrop-filter: blur(20px);
  color: white;
  box-shadow: 0 4px 16px rgba(25, 118, 210, 0.3);
}

.workflow-step.active .step-title,
.workflow-step.active .step-description {
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.workflow-step.completed {
  border-color: rgba(76, 175, 80, 0.4);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.9) 0%, rgba(56, 142, 60, 0.9) 100%);
  backdrop-filter: blur(20px);
  color: white;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
}

.workflow-step.completed .step-title,
.workflow-step.completed .step-description {
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.step-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(25, 118, 210, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.workflow-step.active .step-icon,
.workflow-step.completed .step-icon {
  background: rgba(255, 255, 255, 0.2);
}

.step-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 4px;
  color: #1a1a1a;
  line-height: 1.3;
}

.step-description {
  font-size: 0.8rem;
  color: #444;
  margin-bottom: 6px;
  line-height: 1.4;
}

.step-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.processing-animation {
  min-height: 40px;
}

.analytics-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.metric-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 100px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.metric-value {
  font-weight: 600;
  font-size: 1rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.metric-label {
  font-size: 0.7rem;
  opacity: 0.9;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.demo-controls {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 20px;
}

.demo-info {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: 500;
}

.feature-highlights {
  margin-top: 24px;
}

.feature-card {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-card h5 {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-size: 1rem;
  font-weight: 600;
}

.feature-card p {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  font-size: 0.85rem;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.12);
}

@media (max-width: 600px) {
  .workflow-steps {
    grid-template-columns: 1fr;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .analytics-preview {
    flex-direction: column;
  }

  .metric-card {
    min-width: auto;
  }

  .title-content h3 {
    font-size: 1.2rem;
  }
}
</style>
