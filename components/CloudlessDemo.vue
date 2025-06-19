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
                <div v-for="source in dataSources" :key="source.name" class="source-item">
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

              <!-- IoT Sensors Section -->
              <div class="sensors-section mt-4">
                <div class="sensors-section-title">
                  <v-icon size="16" color="primary" class="mr-2">mdi-sensors</v-icon>
                  <span class="text-caption font-weight-medium">IoT Sensors & Real-time Data</span>
                </div>
                <div class="sensors-grid">
                  <div v-for="sensor in iotSensors" :key="sensor.id" class="sensor-card">
                    <div
                      class="sensor-indicator"
                      :class="{ active: sensor.active, critical: sensor.critical }"
                    >
                      <v-icon
                        :color="sensor.critical ? 'error' : sensor.active ? 'success' : 'grey'"
                        size="12"
                      >
                        {{ sensor.icon }}
                      </v-icon>
                    </div>
                    <div class="sensor-details">
                      <div class="sensor-name">{{ sensor.name }}</div>
                      <div class="sensor-value" :class="{ critical: sensor.critical }">
                        {{ sensor.value }} {{ sensor.unit }}
                      </div>
                      <div class="sensor-status">{{ sensor.status }}</div>
                    </div>
                    <div class="sensor-signal">
                      <div class="signal-bars">
                        <div
                          v-for="i in 4"
                          :key="i"
                          class="signal-bar"
                          :class="{ active: i <= sensor.signalStrength }"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-3">
                <v-chip-group>
                  <v-chip size="small" color="info" variant="tonal">CSV Files</v-chip>
                  <v-chip size="small" color="success" variant="tonal">APIs</v-chip>
                  <v-chip size="small" color="warning" variant="tonal">Databases</v-chip>
                  <v-chip size="small" color="purple" variant="tonal">Cloud Storage</v-chip>
                  <v-chip size="small" color="primary" variant="tonal">IoT Sensors</v-chip>
                  <v-chip size="small" color="orange" variant="tonal">Real-time Streams</v-chip>
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
                  <span class="validation-metric-label">Data Quality</span>
                  <v-progress-linear
                    :model-value="validationMetrics.quality"
                    color="success"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="validation-metric-value">{{ validationMetrics.quality }}%</span>
                </div>
                <div class="metric-row">
                  <span class="validation-metric-label">Completeness</span>
                  <v-progress-linear
                    :model-value="validationMetrics.completeness"
                    color="info"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="validation-metric-value">{{ validationMetrics.completeness }}%</span>
                </div>
                <div class="metric-row">
                  <span class="validation-metric-label">Consistency</span>
                  <v-progress-linear
                    :model-value="validationMetrics.consistency"
                    color="warning"
                    height="8"
                    rounded
                    class="metric-bar"
                  />
                  <span class="validation-metric-value">{{ validationMetrics.consistency }}%</span>
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
                <div v-for="stage in processingStages" :key="stage.name" class="pipeline-stage">
                  <div class="stage-icon">
                    <v-icon :color="stage.active ? 'primary' : 'grey'" size="16">{{
                      stage.icon
                    }}</v-icon>
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
            <v-icon :color="currentStep >= 4 ? 'white' : 'primary'" size="20"> mdi-brain </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">ML Analytics</h4>
            <p class="step-description">Advanced machine learning insights</p>
            <div v-if="currentStep === 4" class="step-details">
              <div class="ml-models">
                <div v-for="model in mlModels" :key="model.name" class="model-card">
                  <div class="model-header">
                    <v-icon :color="model.color" size="16" class="mr-2">{{ model.icon }}</v-icon>
                    <span class="model-name">{{ model.name }}</span>
                    <v-chip
                      size="x-small"
                      :color="model.status === 'trained' ? 'success' : 'warning'"
                      variant="tonal"
                    >
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
                <div v-for="chart in chartTypes" :key="chart.type" class="chart-item">
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
                <div v-for="report in reportTypes" :key="report.type" class="report-item">
                  <v-icon :color="report.color" size="16" class="mr-2">{{ report.icon }}</v-icon>
                  <span class="report-name">{{ report.name }}</span>
                  <v-chip
                    size="x-small"
                    color="success"
                    variant="tonal"
                    class="ml-auto"
                  >
                    Generated
                  </v-chip>
                </div>
              </div>
              <div class="report-actions mt-3">
                <v-btn
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-download"
                >
                  Download PDF
                </v-btn>
                <v-btn
                  size="small"
                  color="info"
                  variant="tonal"
                  prepend-icon="mdi-share"
                  class="ml-2"
                >
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
                class="mt-2"
                @click="simulateDeploy"
              >
                {{ deploying ? 'Deploying...' : 'Deploy to Cloud' }}
              </v-btn>
            </div>
          </div>
        </div>

        <!-- Step 8: Data Quality Assessment -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 8, completed: currentStep > 8 }"
          @click="setStep(8)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 8 ? 'white' : 'primary'" size="20">
              mdi-shield-check
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Quality Assessment</h4>
            <p class="step-description">Comprehensive data quality analysis</p>
            <div v-if="currentStep === 8" class="step-details">
              <div class="quality-dashboard">
                <div v-for="metric in qualityMetrics" :key="metric.name" class="quality-metric">
                  <div class="metric-header">
                    <v-icon :color="metric.color" size="14" class="mr-1">{{ metric.icon }}</v-icon>
                    <span class="metric-title">{{ metric.name }}</span>
                  </div>
                  <div class="metric-gauge">
                    <v-progress-circular
                      :model-value="metric.score"
                      :color="metric.color"
                      size="32"
                      width="3"
                    >
                      <span class="gauge-text">{{ metric.score }}</span>
                    </v-progress-circular>
                  </div>
                  <div class="metric-issues">
                    <span class="issues-count">{{ metric.issues }} issues</span>
                  </div>
                </div>
              </div>
              <div class="quality-summary mt-2">
                <v-chip
                  size="x-small"
                  :color="
                    overallQuality >= 90 ? 'success' : overallQuality >= 70 ? 'warning' : 'error'
                  "
                  variant="tonal"
                >
                  Overall Score: {{ overallQuality }}%
                </v-chip>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 9: Real-time Streaming -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 9, completed: currentStep > 9 }"
          @click="setStep(9)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 9 ? 'white' : 'primary'" size="20"> mdi-pulse </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Real-time Stream</h4>
            <p class="step-description">Live data processing pipeline</p>
            <div v-if="currentStep === 9" class="step-details">
              <div class="stream-flow">
                <div v-for="node in streamNodes" :key="node.id" class="stream-node">
                  <div
                    class="node-icon"
                    :class="{ active: node.active, processing: node.processing }"
                  >
                    <v-icon :color="node.active ? 'white' : 'primary'" size="12">{{
                      node.icon
                    }}</v-icon>
                  </div>
                  <div class="node-info">
                    <div class="node-name">{{ node.name }}</div>
                    <div class="node-throughput">{{ node.throughput }}/sec</div>
                  </div>
                  <div v-if="node.id < streamNodes.length" class="stream-arrow">
                    <v-icon size="10" color="primary">mdi-arrow-right</v-icon>
                  </div>
                </div>
              </div>
              <div class="stream-metrics mt-2">
                <div class="stream-stat">
                  <v-icon size="12" color="success">mdi-clock-fast</v-icon>
                  <span>{{ streamLatency }}ms latency</span>
                </div>
                <div class="stream-stat">
                  <v-icon size="12" color="info">mdi-database-sync</v-icon>
                  <span>{{ streamThroughput }}/sec throughput</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 10: Advanced Analytics -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 10, completed: currentStep > 10 }"
          @click="setStep(10)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 10 ? 'white' : 'primary'" size="20">
              mdi-chart-analytics
            </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Advanced Analytics</h4>
            <p class="step-description">Deep insights and predictions</p>
            <div v-if="currentStep === 10" class="step-details">
              <div class="analytics-dashboard">
                <div v-for="widget in analyticsWidgets" :key="widget.type" class="analytics-widget">
                  <div class="widget-header">
                    <v-icon :color="widget.color" size="14">{{ widget.icon }}</v-icon>
                    <span class="widget-title">{{ widget.title }}</span>
                  </div>
                  <div class="widget-content">
                    <div class="primary-metric">{{ widget.value }}</div>
                    <div class="metric-change" :class="widget.trend">
                      <v-icon size="10" :color="widget.trend === 'up' ? 'success' : 'error'">
                        {{ widget.trend === 'up' ? 'mdi-trending-up' : 'mdi-trending-down' }}
                      </v-icon>
                      <span>{{ widget.change }}</span>
                    </div>
                  </div>
                  <div class="widget-chart">
                    <svg width="60" height="20" viewBox="0 0 60 20">
                      <path
                        :d="widget.sparkline"
                        :stroke="widget.color"
                        stroke-width="1"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 11: Performance Optimization -->
        <div
          class="workflow-step"
          :class="{ active: currentStep === 11, completed: currentStep > 11 }"
          @click="setStep(11)"
        >
          <div class="step-icon">
            <v-icon :color="currentStep >= 11 ? 'white' : 'primary'" size="20"> mdi-rocket </v-icon>
          </div>
          <div class="step-content">
            <h4 class="step-title">Performance Tuning</h4>
            <p class="step-description">Optimize for speed and efficiency</p>
            <div v-if="currentStep === 11" class="step-details">
              <div class="performance-metrics">
                <div v-for="perf in performanceGauges" :key="perf.name" class="perf-gauge">
                  <div class="gauge-container">
                    <v-progress-circular
                      :model-value="perf.value"
                      :color="perf.color"
                      size="40"
                      width="4"
                    >
                      <span class="gauge-value">{{ perf.value }}%</span>
                    </v-progress-circular>
                  </div>
                  <div class="gauge-label">{{ perf.name }}</div>
                  <div class="gauge-improvement">
                    <v-icon size="10" color="success">mdi-arrow-up</v-icon>
                    <span>+{{ perf.improvement }}%</span>
                  </div>
                </div>
              </div>
              <div class="optimization-tips mt-2">
                <v-chip
                  size="x-small"
                  color="info"
                  variant="tonal"
                  class="mr-1"
                >
                  Cache Optimized
                </v-chip>
                <v-chip
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="mr-1"
                >
                  Memory Efficient
                </v-chip>
                <v-chip size="x-small" color="warning" variant="tonal"> Auto-Scaling </v-chip>
              </div>
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

    <!-- Why Choose Cloudless? -->
    <div class="why-choose-section mt-8">
      <div class="section-header text-center mb-6">
        <h3 class="section-title mb-3">Why Choose Cloudless?</h3>
        <p class="section-subtitle">
          Revolutionizing corporate data intelligence with cutting-edge AI and quantum-ready
          infrastructure
        </p>
      </div>

      <v-row class="mb-6">
        <v-col
          v-for="benefit in coreBenefits"
          :key="benefit.id"
          cols="12"
          md="6"
          lg="3"
        >
          <div class="benefit-card" :class="`benefit-${benefit.theme}`">
            <div class="benefit-icon-container">
              <div class="benefit-icon-bg">
                <v-icon :color="benefit.iconColor" size="32">{{ benefit.icon }}</v-icon>
              </div>
              <div class="benefit-pulse" />
            </div>
            <h5 class="benefit-title">{{ benefit.title }}</h5>
            <p class="benefit-description">{{ benefit.description }}</p>
            <div class="benefit-metrics">
              <span class="benefit-metric-value">{{ benefit.metric }}</span>
              <span class="benefit-metric-label">{{ benefit.metricLabel }}</span>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Department-Specific Solutions -->
      <div class="departments-section">
        <div class="text-center mb-5">
          <h4 class="departments-title">Designed for Enterprise Departments</h4>
          <p class="departments-subtitle">Tailored solutions for every corporate function</p>
        </div>

        <v-row>
          <v-col
            v-for="dept in departmentSolutions"
            :key="dept.id"
            cols="12"
            md="6"
            lg="4"
          >
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon :color="dept.color" size="24">{{ dept.icon }}</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">{{ dept.name }}</h6>
                  <span class="department-tag">{{ dept.tag }}</span>
                </div>
              </div>

              <div class="department-features">
                <div v-for="feature in dept.features" :key="feature" class="feature-item">
                  <v-icon size="12" color="success" class="mr-2">mdi-check-circle</v-icon>
                  <span>{{ feature }}</span>
                </div>
              </div>

              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">{{ dept.impact.value }}</span>
                  <span class="impact-label">{{ dept.impact.label }}</span>
                </div>
                <v-chip size="small" :color="dept.color" variant="tonal">
                  {{ dept.impact.improvement }}
                </v-chip>
              </div>
            </div>
          </v-col>
        </v-row>
      </div>

      <!-- Technology Stack -->
      <div class="tech-stack-section mt-8">
        <div class="text-center mb-5">
          <h4 class="tech-title">Built on Cutting-Edge Technology</h4>
          <p class="tech-subtitle">
            Next-generation infrastructure powering tomorrow's enterprises
          </p>
        </div>

        <div class="tech-categories">
          <div v-for="category in techStack" :key="category.name" class="tech-category">
            <div class="category-header">
              <v-icon :color="category.color" size="20" class="mr-2">{{ category.icon }}</v-icon>
              <span class="category-name">{{ category.name }}</span>
            </div>
            <div class="tech-items">
              <v-chip
                v-for="tech in category.technologies"
                :key="tech.name"
                size="small"
                :color="tech.featured ? category.color : 'default'"
                :variant="tech.featured ? 'flat' : 'tonal'"
                class="ma-1"
              >
                <v-icon v-if="tech.featured" size="12" class="mr-1">mdi-star</v-icon>
                {{ tech.name }}
              </v-chip>
            </div>
          </div>
        </div>
      </div>

      <!-- ROI & Business Impact -->
      <div class="roi-section mt-8">
        <div class="roi-container">
          <div class="roi-header">
            <h4 class="roi-title">Proven Business Impact</h4>
            <p class="roi-subtitle">Real results from Fortune 500 implementations</p>
          </div>

          <v-row class="roi-metrics">
            <v-col
              v-for="roi in roiMetrics"
              :key="roi.id"
              cols="6"
              md="3"
            >
              <div class="roi-metric">
                <div class="roi-icon">
                  <v-icon :color="roi.color" size="20">{{ roi.icon }}</v-icon>
                </div>
                <div class="roi-value">{{ roi.value }}</div>
                <div class="roi-label">{{ roi.label }}</div>
                <div class="roi-timeframe">{{ roi.timeframe }}</div>
              </div>
            </v-col>
          </v-row>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Reactive state
const currentStep = ref(1);
const _processingProgress = ref(0);
const _processingText = ref('Initializing...');
const _animatedMetric = ref(0);
const deploying = ref(false);
const demoPlaying = ref(false);
const requestCount = ref(125847);

// Animation intervals
let _processingInterval: NodeJS.Timeout | null = null;
let _metricInterval: NodeJS.Timeout | null = null;
let _requestInterval: NodeJS.Timeout | null = null;

// Data sources for step 1
const dataSources = ref([
  {
    name: 'Customer DB',
    size: '2.5GB',
    color: 'blue',
    icon: 'mdi-database',
    progress: 0,
  },
  {
    name: 'API Feeds',
    size: '450MB',
    color: 'green',
    icon: 'mdi-api',
    progress: 0,
  },
  {
    name: 'CSV Files',
    size: '1.2GB',
    color: 'orange',
    icon: 'mdi-file-delimited',
    progress: 0,
  },
  {
    name: 'Cloud Storage',
    size: '3.8GB',
    color: 'purple',
    icon: 'mdi-cloud',
    progress: 0,
  },
]);

// IoT Sensors data for enhanced data input
const iotSensors = ref([
  {
    id: 1,
    name: 'Temperature',
    value: 72.4,
    unit: '°F',
    icon: 'mdi-thermometer',
    active: true,
    critical: false,
    status: 'Normal',
    signalStrength: 4,
  },
  {
    id: 2,
    name: 'Humidity',
    value: 45.2,
    unit: '%',
    icon: 'mdi-water-percent',
    active: true,
    critical: false,
    status: 'Normal',
    signalStrength: 3,
  },
  {
    id: 3,
    name: 'Pressure',
    value: 1013.2,
    unit: 'hPa',
    icon: 'mdi-gauge',
    active: true,
    critical: true,
    status: 'High',
    signalStrength: 4,
  },
  {
    id: 4,
    name: 'Vibration',
    value: 2.1,
    unit: 'm/s²',
    icon: 'mdi-vibrate',
    active: true,
    critical: false,
    status: 'Normal',
    signalStrength: 2,
  },
  {
    id: 5,
    name: 'Flow Rate',
    value: 15.7,
    unit: 'L/min',
    icon: 'mdi-waves',
    active: false,
    critical: false,
    status: 'Offline',
    signalStrength: 0,
  },
  {
    id: 6,
    name: 'Energy',
    value: 3.4,
    unit: 'kW',
    icon: 'mdi-lightning-bolt',
    active: true,
    critical: false,
    status: 'Normal',
    signalStrength: 4,
  },
]);

// Validation metrics for step 2
const validationMetrics = ref({
  quality: 0,
  completeness: 0,
  consistency: 0,
});

// Processing stages for step 3
const processingStages = ref([
  {
    name: 'Data Cleansing',
    icon: 'mdi-broom',
    progress: 0,
    active: false,
  },
  {
    name: 'Normalization',
    icon: 'mdi-format-align-justify',
    progress: 0,
    active: false,
  },
  {
    name: 'Feature Engineering',
    icon: 'mdi-cogs',
    progress: 0,
    active: false,
  },
  {
    name: 'Data Fusion',
    icon: 'mdi-merge',
    progress: 0,
    active: false,
  },
]);

// Processing stats
const processingSpeed = ref(12);
const memoryUsage = ref(45);

// ML Models for step 4
const mlModels = ref([
  {
    name: 'Classification',
    icon: 'mdi-tag-multiple',
    color: 'blue',
    accuracy: 94.2,
    status: 'trained',
  },
  {
    name: 'Regression',
    icon: 'mdi-trending-up',
    color: 'green',
    accuracy: 91.8,
    status: 'trained',
  },
  {
    name: 'Clustering',
    icon: 'mdi-dots-hexagon',
    color: 'purple',
    accuracy: 87.5,
    status: 'training',
  },
  {
    name: 'Anomaly Detection',
    icon: 'mdi-alert-circle',
    color: 'red',
    accuracy: 96.1,
    status: 'trained',
  },
]);

// Chart types for step 5
const chartTypes = ref([
  {
    type: 'line',
    name: 'Time Series',
    icon: 'mdi-chart-line',
    color: '#1976d2',
    dataPoints: '12.5K',
    path: 'M2,15 Q10,5 18,10 T38,8',
  },
  {
    type: 'bar',
    name: 'Bar Chart',
    icon: 'mdi-chart-bar',
    color: '#388e3c',
    dataPoints: '8.2K',
    path: 'M5,15 L5,8 M12,15 L12,5 M19,15 L19,12 M26,15 L26,3 M33,15 L33,9',
  },
  {
    type: 'scatter',
    name: 'Scatter Plot',
    icon: 'mdi-chart-scatter-plot',
    color: '#f57c00',
    dataPoints: '15.7K',
    path: 'M5,10 L5,10 M12,6 L12,6 M19,14 L19,14 M26,4 L26,4 M33,11 L33,11',
  },
  {
    type: 'pie',
    name: 'Distribution',
    icon: 'mdi-chart-pie',
    color: '#7b1fa2',
    dataPoints: '6.3K',
    path: 'M20,10 A10,10 0 0,1 30,10 A10,10 0 0,1 20,20 A10,10 0 0,1 10,10 A10,10 0 0,1 20,10',
  },
]);

// Report types for step 6
const reportTypes = ref([
  {
    type: 'executive',
    name: 'Executive Summary',
    icon: 'mdi-account-tie',
    color: 'blue',
  },
  {
    type: 'technical',
    name: 'Technical Analysis',
    icon: 'mdi-cog',
    color: 'green',
  },
  {
    type: 'insights',
    name: 'Key Insights',
    icon: 'mdi-lightbulb',
    color: 'orange',
  },
  {
    type: 'recommendations',
    name: 'Recommendations',
    icon: 'mdi-clipboard-check',
    color: 'purple',
  },
]);

// Processing texts for animation
const _processingTexts = [
  'Initializing...',
  'Analyzing data patterns...',
  'Applying ML algorithms...',
  'Optimizing performance...',
  'Finalizing results...',
];

// Core benefits for Why Choose Cloudless section
const coreBenefits = ref([
  {
    id: 1,
    title: 'Quantum-Ready Architecture',
    description:
      'Future-proof infrastructure built for quantum computing integration and exponential data growth.',
    icon: 'mdi-atom',
    iconColor: 'primary',
    theme: 'quantum',
    metric: '1000x',
    metricLabel: 'Faster Processing',
  },
  {
    id: 2,
    title: 'AI-Native Platform',
    description:
      'GPT-4 powered analytics with autonomous decision-making and predictive intelligence.',
    icon: 'mdi-robot',
    iconColor: 'success',
    theme: 'ai',
    metric: '95%',
    metricLabel: 'Accuracy Rate',
  },
  {
    id: 3,
    title: 'Zero-Code Innovation',
    description:
      'Revolutionary visual programming with natural language processing for instant deployment.',
    icon: 'mdi-auto-fix',
    iconColor: 'warning',
    theme: 'innovation',
    metric: '10min',
    metricLabel: 'Setup Time',
  },
  {
    id: 4,
    title: 'Enterprise Security',
    description:
      'Military-grade encryption with blockchain validation and quantum-resistant protocols.',
    icon: 'mdi-shield-check',
    iconColor: 'error',
    theme: 'security',
    metric: '99.99%',
    metricLabel: 'Uptime SLA',
  },
]);

// Department-specific solutions
const departmentSolutions = ref([
  {
    id: 1,
    name: 'Marketing Intelligence',
    tag: 'Revenue Growth',
    icon: 'mdi-chart-line',
    color: 'primary',
    features: [
      'Real-time campaign optimization',
      'Predictive customer segmentation',
      'Attribution modeling',
      'Cross-channel analytics',
    ],
    impact: {
      value: '+340%',
      label: 'ROI Increase',
      improvement: '+34% CTR',
    },
  },
  {
    id: 2,
    name: 'Sales Operations',
    tag: 'Pipeline Acceleration',
    icon: 'mdi-target',
    color: 'success',
    features: [
      'Lead scoring automation',
      'Opportunity prediction',
      'Territory optimization',
      'Performance analytics',
    ],
    impact: {
      value: '+28%',
      label: 'Conversion Rate',
      improvement: '45% Faster Close',
    },
  },
  {
    id: 3,
    name: 'Financial Planning',
    tag: 'Risk Management',
    icon: 'mdi-currency-usd',
    color: 'warning',
    features: [
      'Automated forecasting',
      'Fraud detection',
      'Compliance monitoring',
      'Budget optimization',
    ],
    impact: {
      value: '92%',
      label: 'Accuracy',
      improvement: '67% Risk Reduction',
    },
  },
  {
    id: 4,
    name: 'Operations Excellence',
    tag: 'Efficiency Gains',
    icon: 'mdi-cogs',
    color: 'info',
    features: [
      'Supply chain optimization',
      'Predictive maintenance',
      'Quality assurance',
      'Resource allocation',
    ],
    impact: {
      value: '-45%',
      label: 'Operational Costs',
      improvement: '23% Productivity',
    },
  },
  {
    id: 5,
    name: 'Human Resources',
    tag: 'Talent Intelligence',
    icon: 'mdi-account-group',
    color: 'purple',
    features: [
      'Employee sentiment analysis',
      'Performance prediction',
      'Retention modeling',
      'Skills gap analysis',
    ],
    impact: {
      value: '+156%',
      label: 'Employee Satisfaction',
      improvement: '78% Less Turnover',
    },
  },
  {
    id: 6,
    name: 'Customer Success',
    tag: 'Experience Optimization',
    icon: 'mdi-heart',
    color: 'pink',
    features: [
      'Churn prediction',
      'Sentiment tracking',
      'Journey optimization',
      'Personalization engine',
    ],
    impact: {
      value: '+89%',
      label: 'NPS Score',
      improvement: '234% Retention',
    },
  },
]);

// Technology stack categories
const techStack = ref([
  {
    name: 'AI & Machine Learning',
    icon: 'mdi-brain',
    color: 'primary',
    technologies: [
      { name: 'GPT-4 Turbo', featured: true },
      { name: 'TensorFlow Quantum', featured: true },
      { name: 'PyTorch Lightning', featured: false },
      { name: 'AutoML', featured: false },
      { name: 'Neural Architecture Search', featured: true },
    ],
  },
  {
    name: 'Cloud Infrastructure',
    icon: 'mdi-cloud',
    color: 'info',
    technologies: [
      { name: 'Kubernetes', featured: false },
      { name: 'Serverless Edge', featured: true },
      { name: 'Multi-Cloud Mesh', featured: true },
      { name: 'CDN Network', featured: false },
      { name: 'Auto-Scaling', featured: false },
    ],
  },
  {
    name: 'Data Processing',
    icon: 'mdi-database',
    color: 'success',
    technologies: [
      { name: 'Apache Spark', featured: false },
      { name: 'Stream Processing', featured: true },
      { name: 'Data Lake', featured: false },
      { name: 'Real-time Analytics', featured: true },
      { name: 'ETL Pipelines', featured: false },
    ],
  },
  {
    name: 'Security & Compliance',
    icon: 'mdi-shield',
    color: 'error',
    technologies: [
      { name: 'Zero Trust Architecture', featured: true },
      { name: 'Blockchain Validation', featured: true },
      { name: 'End-to-End Encryption', featured: false },
      { name: 'GDPR Compliance', featured: false },
      { name: 'SOC2 Type II', featured: false },
    ],
  },
]);

// ROI metrics
const roiMetrics = ref([
  {
    id: 1,
    value: '247%',
    label: 'Average ROI',
    timeframe: 'Within 6 months',
    icon: 'mdi-trending-up',
    color: 'success',
  },
  {
    id: 2,
    value: '89%',
    label: 'Cost Reduction',
    timeframe: 'Year over year',
    icon: 'mdi-currency-usd-off',
    color: 'warning',
  },
  {
    id: 3,
    value: '156%',
    label: 'Productivity Gain',
    timeframe: 'First quarter',
    icon: 'mdi-rocket',
    color: 'primary',
  },
  {
    id: 4,
    value: '99.97%',
    label: 'Uptime Achieved',
    timeframe: 'Enterprise SLA',
    icon: 'mdi-shield-check',
    color: 'info',
  },
]);

// Quality metrics for step 8
const qualityMetrics = ref([
  {
    name: 'Data Accuracy',
    value: 96.8,
    target: 95,
    color: 'success',
    icon: 'mdi-check-circle',
    score: 96.8,
    issues: 2,
  },
  {
    name: 'Completeness',
    value: 94.2,
    target: 90,
    color: 'success',
    icon: 'mdi-database-check',
    score: 94.2,
    issues: 3,
  },
  {
    name: 'Consistency',
    value: 87.5,
    target: 85,
    color: 'warning',
    icon: 'mdi-sync',
    score: 87.5,
    issues: 5,
  },
  {
    name: 'Reliability',
    value: 98.1,
    target: 95,
    color: 'success',
    icon: 'mdi-shield-check',
    score: 98.1,
    issues: 1,
  },
]);

// Overall quality score (computed from quality metrics)
const overallQuality = ref(92.4);

// Stream nodes for step 9
const streamNodes = ref([
  {
    id: 1,
    name: 'Ingestion',
    status: 'active',
    throughput: '12.5k/s',
    color: 'primary',
    icon: 'mdi-import',
    active: true,
    processing: false,
  },
  {
    id: 2,
    name: 'Processing',
    status: 'active',
    throughput: '11.8k/s',
    color: 'success',
    icon: 'mdi-cogs',
    active: true,
    processing: true,
  },
  {
    id: 3,
    name: 'Analysis',
    status: 'active',
    throughput: '11.2k/s',
    color: 'warning',
    icon: 'mdi-chart-line',
    active: true,
    processing: false,
  },
  {
    id: 4,
    name: 'Output',
    status: 'active',
    throughput: '10.9k/s',
    color: 'info',
    icon: 'mdi-export',
    active: true,
    processing: false,
  },
]);

// Stream performance metrics
const streamLatency = ref(15);
const streamThroughput = ref('10.9k');

// Analytics widgets for step 10
const analyticsWidgets = ref([
  {
    type: 'trend',
    title: 'Performance Trends',
    value: '+23.4%',
    color: 'success',
    icon: 'mdi-trending-up',
    trend: 'up',
    change: '+5.2%',
    sparkline: 'M2,15 Q10,5 18,10 T38,8',
  },
  {
    type: 'prediction',
    title: 'Predictive Insights',
    value: '94.2%',
    color: 'primary',
    icon: 'mdi-crystal-ball',
    trend: 'up',
    change: '+2.1%',
    sparkline: 'M2,12 L8,8 L15,14 L22,6 L28,10 L35,4',
  },
  {
    type: 'correlation',
    title: 'Data Correlations',
    value: '0.87',
    color: 'info',
    icon: 'mdi-connection',
    trend: 'down',
    change: '-0.03',
    sparkline: 'M2,8 L8,12 L15,6 L22,10 L28,14 L35,11',
  },
  {
    type: 'anomaly',
    title: 'Anomaly Detection',
    value: '3 alerts',
    color: 'warning',
    icon: 'mdi-alert-circle',
    trend: 'up',
    change: '+1',
    sparkline: 'M2,15 L8,15 L15,8 L22,15 L28,12 L35,15',
  },
]);

// Performance gauges for step 11
const performanceGauges = ref([
  {
    name: 'CPU Usage',
    value: 34,
    max: 100,
    unit: '%',
    color: 'success',
    icon: 'mdi-cpu-64-bit',
    improvement: 12,
  },
  {
    name: 'Memory',
    value: 67,
    max: 100,
    unit: '%',
    color: 'warning',
    icon: 'mdi-memory',
    improvement: 8,
  },
  {
    name: 'Throughput',
    value: 89,
    max: 100,
    unit: '%',
    color: 'success',
    icon: 'mdi-speedometer',
    improvement: 23,
  },
  {
    name: 'Latency',
    value: 23,
    max: 100,
    unit: 'ms',
    color: 'success',
    icon: 'mdi-timer',
    improvement: 45,
  },
]);

// Functions
const setStep = (step: number) => {
  currentStep.value = step;
};

const playDemo = () => {
  if (demoPlaying.value) return;

  demoPlaying.value = true;
  let step = 1;

  const playInterval = setInterval(() => {
    currentStep.value = step;
    step++;

    if (step > 11) {
      clearInterval(playInterval);
      demoPlaying.value = false;
      currentStep.value = 1;
    }
  }, 2000);
};

const resetDemo = () => {
  currentStep.value = 1;
  demoPlaying.value = false;
  deploying.value = false;
};

const simulateDeploy = () => {
  if (deploying.value) return;

  deploying.value = true;

  setTimeout(() => {
    deploying.value = false;
  }, 3000);
};
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

/* Data Sources Visual Styles */
.data-sources-visual {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.source-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.source-info {
  text-align: center;
  width: 100%;
}

.source-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.source-size {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}

/* Validation Metrics Styles */
.validation-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.validation-metric-label {
  flex: 0 0 80px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.metric-bar {
  flex: 1;
}

.validation-metric-value {
  flex: 0 0 40px;
  text-align: right;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Processing Pipeline Styles */
.processing-pipeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pipeline-stage {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.stage-icon {
  flex: 0 0 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-info {
  flex: 1;
}

.stage-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.processing-stats {
  display: flex;
  gap: 12px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
}

/* ML Models Styles */
.ml-models {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.model-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.model-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
  margin-left: 4px;
}

.model-accuracy {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.accuracy-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
}

.accuracy-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Chart Previews Styles */
.chart-previews {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.chart-icon {
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-info {
  flex: 1;
}

.chart-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.chart-data {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
}

.chart-visual {
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Report Preview Styles */
.report-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.report-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.report-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

.report-actions {
  display: flex;
  gap: 8px;
}

/* Deployment Info Styles */
.deployment-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deployment-status {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.deployment-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.metric-item .metric-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2px;
}

.metric-item .metric-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Quality Assessment Styles */
.quality-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.quality-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.metric-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.metric-title {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 2px;
}

.metric-gauge {
  margin-bottom: 4px;
}

.gauge-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.metric-issues {
  text-align: center;
}

.issues-count {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.7);
}

.quality-summary {
  display: flex;
  justify-content: center;
}

/* Stream Flow Styles */
.stream-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.stream-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.node-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  transition: all 0.3s ease;
}

.node-icon.active {
  background: rgba(25, 118, 210, 0.8);
  box-shadow: 0 0 8px rgba(25, 118, 210, 0.4);
}

.node-icon.processing {
  background: rgba(255, 193, 7, 0.8);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.node-info {
  text-align: center;
}

.node-name {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.node-throughput {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.7);
}

.stream-arrow {
  display: flex;
  align-items: center;
  margin: 0 4px;
}

.stream-metrics {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.stream-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
}

/* Analytics Dashboard Styles */
.analytics-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.analytics-widget {
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.widget-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.widget-title {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 4px;
}

.widget-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.primary-metric {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.metric-change {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.65rem;
}

.metric-change.up {
  color: rgba(76, 175, 80, 0.9);
}

.metric-change.down {
  color: rgba(244, 67, 54, 0.9);
}

.widget-chart {
  display: flex;
  justify-content: center;
}

/* Performance Optimization Styles */
.performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 8px;
}

.perf-gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  backdrop-filter: blur(5px);
}

.gauge-container {
  margin-bottom: 6px;
}

.gauge-value {
  font-size: 0.65rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.gauge-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  margin-bottom: 4px;
}

.gauge-improvement {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.6rem;
  color: rgba(76, 175, 80, 0.9);
}

.optimization-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

/* IoT Sensors Styles */
.sensors-section {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sensors-section-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
}

.sensors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.sensor-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.sensor-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.sensor-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  transition: all 0.3s ease;
}

.sensor-indicator.active {
  background: rgba(76, 175, 80, 0.2);
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
}

.sensor-indicator.critical {
  background: rgba(244, 67, 54, 0.2);
  box-shadow: 0 0 8px rgba(244, 67, 54, 0.3);
  animation: pulse-critical 2s infinite;
}

@keyframes pulse-critical {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.sensor-details {
  text-align: center;
  flex: 1;
}

.sensor-name {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.sensor-value {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 2px;
}

.sensor-value.critical {
  color: rgba(244, 67, 54, 0.9);
}

.sensor-status {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
}

.sensor-signal {
  display: flex;
  justify-content: center;
}

.signal-bars {
  display: flex;
  align-items: end;
  gap: 1px;
}

.signal-bar {
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.signal-bar:nth-child(1) {
  height: 4px;
}
.signal-bar:nth-child(2) {
  height: 6px;
}
.signal-bar:nth-child(3) {
  height: 8px;
}
.signal-bar:nth-child(4) {
  height: 10px;
}

.signal-bar.active {
  background: rgba(76, 175, 80, 0.8);
}

/* Why Choose Cloudless Styles */
.why-choose-section {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(21, 101, 192, 0.02) 100%);
  border-radius: 16px;
  padding: 32px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.section-header {
  margin-bottom: 32px;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  max-width: 600px;
  margin: 0 auto;
}

/* Benefit Cards */
.benefit-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(15px);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  transition: all 0.4s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.benefit-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.benefit-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.12);
}

.benefit-card:hover::before {
  opacity: 1;
}

.benefit-icon-container {
  position: relative;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.benefit-icon-bg {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.benefit-pulse {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.2);
  animation: benefit-pulse 3s infinite;
  z-index: 1;
}

@keyframes benefit-pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.3;
  }
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
}

.benefit-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 12px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.benefit-description {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
  margin-bottom: 16px;
  flex: 1;
}

.benefit-metrics {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: auto;
}

.benefit-metric-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.benefit-metric-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4px;
}

/* Department Solutions */
.departments-section {
  margin-top: 48px;
}

.departments-title {
  font-size: 1.6rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.departments-subtitle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
}

.department-card {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.department-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.1);
}

.department-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.department-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.department-info {
  flex: 1;
}

.department-name {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.department-tag {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.department-features {
  flex: 1;
  margin-bottom: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.9);
}

.department-impact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.impact-metric {
  display: flex;
  flex-direction: column;
}

.impact-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #ffffff;
}

.impact-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Technology Stack */
.tech-stack-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tech-title {
  font-size: 1.4rem;
  font-weight: 600;
  color: #ffffff;
}

.tech-subtitle {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
}

.tech-categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.tech-category {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
}

.category-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.category-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.tech-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ROI Section */
.roi-section {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(56, 142, 60, 0.05) 100%);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.roi-container {
  text-align: center;
}

.roi-title {
  font-size: 1.4rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.roi-subtitle {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 24px;
}

.roi-metrics {
  margin-top: 24px;
}

.roi-metric {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.roi-metric:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.roi-icon {
  margin-bottom: 8px;
}

.roi-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.roi-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.roi-timeframe {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Enhanced Mobile Responsiveness */
@media (max-width: 768px) {
  .sensors-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .tech-categories {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .section-title {
    font-size: 1.6rem;
  }

  .why-choose-section {
    padding: 24px 16px;
  }
}

@media (max-width: 480px) {
  .sensors-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .section-title {
    font-size: 1.4rem;
  }
}
</style>
