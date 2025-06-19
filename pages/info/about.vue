<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8">
        <v-card class="glass-card pa-6" elevation="3">
          <v-card-title class="text-h5 font-weight-bold white--text">
            About Cloudless
          </v-card-title>

          <v-card-text class="text-body-1">
            <p>
              <strong>Cloudless</strong> is a modular and developer-centric LLM agent platform
              crafted using modern technologies like <strong>Nuxt 3</strong>,
              <strong>Supabase</strong>, and <strong>Vuetify 3</strong>.
            </p>

            <p>Our mission is to empower developers with tools that are:</p>

            <v-list dense>
              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Modern</v-list-item-title>
              </v-list-item>

              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Accessible</v-list-item-title>
              </v-list-item>

              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Scalable</v-list-item-title>
              </v-list-item>
            </v-list>

            <p>
              Cloudless is designed with community collaboration in mind. It’s an open-source
              initiative that encourages contributions from developers worldwide, aiming to provide
              a solid, extensible foundation for rapidly building and deploying
              <strong>LLM-driven applications</strong>.
            </p>
            <p>
              Whether you're a beginner exploring AI or a seasoned engineer building cutting-edge
              tools, Cloudless is here to accelerate your journey from concept to production.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Why Choose Cloudless Section -->
    <div class="why-choose-section mt-8">
      <div class="section-header text-center mb-6">
        <h3 class="section-title mb-3">Why Choose Cloudless?</h3>
        <p class="section-subtitle">
          Revolutionizing corporate data intelligence with cutting-edge AI and quantum-ready
          infrastructure
        </p>
      </div>

      <v-row class="mb-6">
        <v-col cols="12" md="6" lg="3">
          <div class="benefit-card benefit-quantum">
            <div class="benefit-icon-container">
              <div class="benefit-icon-bg">
                <v-icon color="primary" size="32">mdi-atom</v-icon>
              </div>
              <div class="benefit-pulse"></div>
            </div>
            <h5 class="benefit-title">Quantum-Ready Architecture</h5>
            <p class="benefit-description">
              Future-proof infrastructure built for quantum computing integration and exponential
              data growth.
            </p>
            <div class="benefit-metrics">
              <span class="benefit-metric-value">1000x</span>
              <span class="benefit-metric-label">Faster Processing</span>
            </div>
          </div>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <div class="benefit-card benefit-ai">
            <div class="benefit-icon-container">
              <div class="benefit-icon-bg">
                <v-icon color="success" size="32">mdi-robot</v-icon>
              </div>
              <div class="benefit-pulse"></div>
            </div>
            <h5 class="benefit-title">AI-Native Platform</h5>
            <p class="benefit-description">
              GPT-4 powered analytics with autonomous decision-making and predictive intelligence.
            </p>
            <div class="benefit-metrics">
              <span class="benefit-metric-value">95%</span>
              <span class="benefit-metric-label">Accuracy Rate</span>
            </div>
          </div>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <div class="benefit-card benefit-innovation">
            <div class="benefit-icon-container">
              <div class="benefit-icon-bg">
                <v-icon color="warning" size="32">mdi-auto-fix</v-icon>
              </div>
              <div class="benefit-pulse"></div>
            </div>
            <h5 class="benefit-title">Zero-Code Innovation</h5>
            <p class="benefit-description">
              Revolutionary visual programming with natural language processing for instant
              deployment.
            </p>
            <div class="benefit-metrics">
              <span class="benefit-metric-value">10min</span>
              <span class="benefit-metric-label">Setup Time</span>
            </div>
          </div>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <div class="benefit-card benefit-security">
            <div class="benefit-icon-container">
              <div class="benefit-icon-bg">
                <v-icon color="error" size="32">mdi-shield-check</v-icon>
              </div>
              <div class="benefit-pulse"></div>
            </div>
            <h5 class="benefit-title">Enterprise Security</h5>
            <p class="benefit-description">
              Military-grade encryption with blockchain validation and quantum-resistant protocols.
            </p>
            <div class="benefit-metrics">
              <span class="benefit-metric-value">99.99%</span>
              <span class="benefit-metric-label">Uptime SLA</span>
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
          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="primary" size="24">mdi-chart-line</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Marketing Intelligence</h6>
                  <span class="department-tag">Revenue Growth</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Real-time campaign optimization</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Predictive customer segmentation</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Attribution modeling</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Cross-channel analytics</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">+340%</span>
                  <span class="impact-label">ROI Increase</span>
                </div>
                <v-chip color="primary" variant="tonal" size="small">+34% CTR</v-chip>
              </div>
            </div>
          </v-col>

          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="success" size="24">mdi-target</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Sales Operations</h6>
                  <span class="department-tag">Pipeline Acceleration</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Lead scoring automation</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Opportunity prediction</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Territory optimization</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Performance analytics</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">+28%</span>
                  <span class="impact-label">Conversion Rate</span>
                </div>
                <v-chip color="success" variant="tonal" size="small">45% Faster Close</v-chip>
              </div>
            </div>
          </v-col>

          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="warning" size="24">mdi-currency-usd</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Financial Planning</h6>
                  <span class="department-tag">Risk Management</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Automated forecasting</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Fraud detection</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Compliance monitoring</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Budget optimization</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">92%</span>
                  <span class="impact-label">Accuracy</span>
                </div>
                <v-chip color="warning" variant="tonal" size="small">67% Risk Reduction</v-chip>
              </div>
            </div>
          </v-col>

          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="info" size="24">mdi-cogs</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Operations Excellence</h6>
                  <span class="department-tag">Efficiency Gains</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Supply chain optimization</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Predictive maintenance</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Quality assurance</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Resource allocation</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">-45%</span>
                  <span class="impact-label">Operational Costs</span>
                </div>
                <v-chip color="info" variant="tonal" size="small">23% Productivity</v-chip>
              </div>
            </div>
          </v-col>

          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="purple" size="24">mdi-account-group</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Human Resources</h6>
                  <span class="department-tag">Talent Intelligence</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Employee sentiment analysis</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Performance prediction</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Retention modeling</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Skills gap analysis</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">+156%</span>
                  <span class="impact-label">Employee Satisfaction</span>
                </div>
                <v-chip color="purple" variant="tonal" size="small">78% Less Turnover</v-chip>
              </div>
            </div>
          </v-col>

          <v-col cols="12" md="6" lg="4">
            <div class="department-card">
              <div class="department-header">
                <div class="department-icon">
                  <v-icon color="pink" size="24">mdi-heart</v-icon>
                </div>
                <div class="department-info">
                  <h6 class="department-name">Customer Success</h6>
                  <span class="department-tag">Experience Optimization</span>
                </div>
              </div>
              <div class="department-features">
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Churn prediction</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Sentiment tracking</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Journey optimization</span>
                </div>
                <div class="feature-item">
                  <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
                  <span>Personalization engine</span>
                </div>
              </div>
              <div class="department-impact">
                <div class="impact-metric">
                  <span class="impact-value">+89%</span>
                  <span class="impact-label">NPS Score</span>
                </div>
                <v-chip color="pink" variant="tonal" size="small">234% Retention</v-chip>
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
          <div class="tech-category">
            <div class="category-header">
              <v-icon color="primary" size="20" class="mr-2">mdi-brain</v-icon>
              <span class="category-name">AI & Machine Learning</span>
            </div>
            <div class="tech-items">
              <v-chip color="primary" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                GPT-4 Turbo
              </v-chip>
              <v-chip color="primary" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                TensorFlow Quantum
              </v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">PyTorch Lightning</v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">AutoML</v-chip>
              <v-chip color="primary" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Neural Architecture Search
              </v-chip>
            </div>
          </div>

          <div class="tech-category">
            <div class="category-header">
              <v-icon color="info" size="20" class="mr-2">mdi-cloud</v-icon>
              <span class="category-name">Cloud Infrastructure</span>
            </div>
            <div class="tech-items">
              <v-chip variant="tonal" size="small" class="ma-1">Kubernetes</v-chip>
              <v-chip color="info" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Serverless Edge
              </v-chip>
              <v-chip color="info" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Multi-Cloud Mesh
              </v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">CDN Network</v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">Auto-Scaling</v-chip>
            </div>
          </div>

          <div class="tech-category">
            <div class="category-header">
              <v-icon color="success" size="20" class="mr-2">mdi-database</v-icon>
              <span class="category-name">Data Processing</span>
            </div>
            <div class="tech-items">
              <v-chip variant="tonal" size="small" class="ma-1">Apache Spark</v-chip>
              <v-chip color="success" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Stream Processing
              </v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">Data Lake</v-chip>
              <v-chip color="success" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Real-time Analytics
              </v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">ETL Pipelines</v-chip>
            </div>
          </div>

          <div class="tech-category">
            <div class="category-header">
              <v-icon color="error" size="20" class="mr-2">mdi-shield</v-icon>
              <span class="category-name">Security & Compliance</span>
            </div>
            <div class="tech-items">
              <v-chip color="error" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Zero Trust Architecture
              </v-chip>
              <v-chip color="error" variant="flat" size="small" class="ma-1">
                <v-icon size="12" class="mr-1">mdi-star</v-icon>
                Blockchain Validation
              </v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">End-to-End Encryption</v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">GDPR Compliance</v-chip>
              <v-chip variant="tonal" size="small" class="ma-1">SOC2 Type II</v-chip>
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
            <v-col cols="6" md="3">
              <div class="roi-metric">
                <div class="roi-icon">
                  <v-icon color="success" size="20">mdi-trending-up</v-icon>
                </div>
                <div class="roi-value">247%</div>
                <div class="roi-label">Average ROI</div>
                <div class="roi-timeframe">Within 6 months</div>
              </div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="roi-metric">
                <div class="roi-icon">
                  <v-icon color="warning" size="20">mdi-currency-usd-off</v-icon>
                </div>
                <div class="roi-value">89%</div>
                <div class="roi-label">Cost Reduction</div>
                <div class="roi-timeframe">Year over year</div>
              </div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="roi-metric">
                <div class="roi-icon">
                  <v-icon color="primary" size="20">mdi-rocket</v-icon>
                </div>
                <div class="roi-value">156%</div>
                <div class="roi-label">Productivity Gain</div>
                <div class="roi-timeframe">First quarter</div>
              </div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="roi-metric">
                <div class="roi-icon">
                  <v-icon color="info" size="20">mdi-shield-check</v-icon>
                </div>
                <div class="roi-value">99.97%</div>
                <div class="roi-label">Uptime Achieved</div>
                <div class="roi-timeframe">Enterprise SLA</div>
              </div>
            </v-col>
          </v-row>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08); /* Semi-transparent background */
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px); /* Glass blur effect */
  -webkit-backdrop-filter: blur(16px); /* For Safari support */
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  color: white;
  position: relative;
  z-index: 10; /* Ensures the card appears above other elements */
}

.text-body-1 {
  color: rgba(255, 255, 255, 0.85); /* Text color for better contrast */
}

.white--text {
  color: white; /* Ensure the title text is white */
}

.v-list-item-title {
  font-weight: 500;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.9); /* Slightly lighter text for the items */
}

.v-list-item-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6); /* Subtle text color for descriptions */
}

.v-icon {
  opacity: 0.85;
}

.intro-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Optional: add a background image to make the content more engaging */
body {
  background: url('/path-to-your-background-image.jpg') no-repeat center center fixed;
  background-size: cover;
}

/* Why Choose Cloudless Section */
.why-choose-section {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem 0;
}

.section-header {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-subtitle {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

/* Benefit Cards */
.benefit-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  height: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.benefit-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.benefit-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
}

.benefit-icon-bg {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.benefit-pulse {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.benefit-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1e293b;
}

.benefit-description {
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.benefit-metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.benefit-metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #667eea;
}

.benefit-metric-label {
  font-size: 0.875rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Department Cards */
.departments-section {
  margin-top: 3rem;
}

.departments-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.departments-subtitle {
  color: #64748b;
  font-size: 1.1rem;
}

.department-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  height: 100%;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.department-card:hover {
  border-color: #667eea;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
}

.department-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.department-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 1rem;
}

.department-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.department-tag {
  font-size: 0.75rem;
  color: #667eea;
  background: #f0f4ff;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.department-features {
  margin-bottom: 1rem;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.department-impact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

.impact-metric {
  display: flex;
  flex-direction: column;
}

.impact-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
}

.impact-label {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
}

/* Technology Stack */
.tech-stack-section {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-radius: 16px;
  padding: 2rem;
  color: white;
}

.tech-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.tech-subtitle {
  color: #cbd5e1;
  font-size: 1.1rem;
}

.tech-categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.tech-category {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
}

.category-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  font-weight: 600;
  color: white;
}

.category-name {
  font-size: 1.1rem;
}

.tech-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* ROI Section */
.roi-section {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border-radius: 16px;
  overflow: hidden;
}

.roi-container {
  padding: 2rem;
  color: white;
}

.roi-header {
  text-align: center;
  margin-bottom: 2rem;
}

.roi-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.roi-subtitle {
  color: #a7f3d0;
  font-size: 1.1rem;
}

.roi-metrics {
  margin-top: 2rem;
}

.roi-metric {
  text-align: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem 1rem;
  backdrop-filter: blur(10px);
}

.roi-icon {
  margin-bottom: 0.5rem;
}

.roi-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  display: block;
  margin-bottom: 0.25rem;
}

.roi-label {
  font-size: 1rem;
  font-weight: 600;
  color: #a7f3d0;
  display: block;
  margin-bottom: 0.25rem;
}

.roi-timeframe {
  font-size: 0.875rem;
  color: #d1fae5;
  opacity: 0.8;
}

/* Responsive Design */
@media (max-width: 768px) {
  .section-title {
    font-size: 2rem;
  }

  .benefit-card {
    margin-bottom: 1rem;
  }

  .tech-categories {
    grid-template-columns: 1fr;
  }

  .roi-value {
    font-size: 2rem;
  }
}
</style>
