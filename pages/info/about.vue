/* Accessibility button icon color override */
.v-icon.accessibility-icon, .accessibility-btn .v-icon {
  color: #2196f3 !important; /* Material blue */
  z-index: 1000 !important;
  position: relative;
}
/* About Intro Section (compact version) */
.about-intro-section {
  background: rgba(30, 41, 59, 0.82);
  color: #fff;
  margin-bottom: 2.5rem;
  border-radius: 14px;
  box-shadow: 0 4px 18px 0 rgba(31, 38, 135, 0.13);
  border: 1.5px solid rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 1.2rem 0.8rem 1.1rem 0.8rem;
  position: relative;
  z-index: 20;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}
.about-intro-section--compact {
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.9rem 0.7rem 0.9rem 0.7rem;
  border-radius: 10px;
  max-width: 540px;
}
.about-intro-content {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}
.about-intro-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 1px 0 #222;
  margin-bottom: 0.5rem;
  letter-spacing: 0.2px;
}
.about-intro-title--compact {
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}
.about-intro-paragraph {
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.13), 0 1px 0 #222;
  font-size: 1rem;
  line-height: 1.5;
  margin-bottom: 0;
}
.about-intro-paragraph--compact {
  font-size: 0.95rem;
  line-height: 1.45;
}
@media (max-width: 600px) {
  .about-intro-section {
    padding: 0.7rem 0.3rem 0.7rem 0.3rem;
    border-radius: 8px;
    max-width: 98vw;
  }
  .about-intro-section--compact {
    padding: 0.5rem 0.2rem 0.5rem 0.2rem;
    border-radius: 7px;
    max-width: 99vw;
  }
  .about-intro-title {
    font-size: 1rem;
  }
  .about-intro-title--compact {
    font-size: 0.92rem;
  }
  .about-intro-paragraph {
    font-size: 0.92rem;
  }
  .about-intro-paragraph--compact {
    font-size: 0.88rem;
    line-height: 1.35;
  }
}
<template>

  <!-- Hero Section -->
  <section class="about-hero-section glass-hero mb-6">
    <div class="about-hero-content">
      <h1 class="about-hero-title">Welcome to Cloudless</h1>
      <p class="about-hero-subtitle">
        Accelerate your business with AI-driven insights, quantum-ready infrastructure, and secure, scalable solutions.<br>
        <span class="about-hero-highlight">Empowering innovation for tomorrow's enterprises.</span>
      </p>
    </div>
  </section>

  <!-- Department-Specific Solutions (now directly under hero) -->
  <div class="text-center mb-1 mt-2">
    <h3 class="section-title">Department Solutions</h3>
  </div>
  <div class="departments-section mb-1">
    <v-row>
      <v-col
        v-for="dept in departments"
        :key="dept.name"
        cols="12"
        sm="6"
        md="4"
      >
        <div class="department-card modern-card compact-card">
          <div class="department-header">
            <div class="department-icon">
              <v-icon :color="dept.icon.color" size="20">{{ dept.icon.name }}</v-icon>
            </div>
            <div class="department-info">
              <h6 class="department-name">{{ dept.name }}</h6>
              <span class="department-tag">{{ dept.tag }}</span>
            </div>
          </div>
          <div class="department-features">
            <div
              v-for="feature in dept.features"
              :key="feature"
              class="feature-item"
            >
              <v-icon color="success" size="12" class="mr-2">mdi-check-circle</v-icon>
              <span>{{ feature }}</span>
            </div>
          </div>
          <div class="department-impact">
            <div class="impact-metric">
              <span class="impact-value">{{ dept.impact.value }}</span>
              <span class="impact-label">{{ dept.impact.label }}</span>
            </div>
            <v-chip :color="dept.impact.chip.color" variant="tonal" size="small">
              {{ dept.impact.chip.text }}
            </v-chip>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>

  <!-- Technology Stack Title (moved directly under cards) -->
  <div class="text-center mb-2 mt-2">
    <h3 class="section-title">Technology Stack</h3>
    <h4 class="tech-title">Built on Cutting-Edge Technology</h4>
    <p class="tech-subtitle">
      Next-generation infrastructure powering tomorrow's enterprises
    </p>
  </div>


  <!-- Technology Stack (moved directly under cards) -->
  <div class="tech-stack-section mt-2">
    <div class="text-center">
      <h3 class="section-title mb-2">Technology Categories</h3>
    </div>
    <div class="tech-categories">
      <div class="tech-category">
        <div class="category-header">
          <v-icon color="primary" size="20" class="mr-2">mdi-brain</v-icon>
          <span class="category-name">AI & Machine Learning</span>
        </div>
        <div class="tech-items">
          <v-chip
            color="primary"
            variant="flat"
            size="small"
            class="ma-1"
          >
            <v-icon size="12" class="mr-1">mdi-star</v-icon>
            GPT-4 Turbo
          </v-chip>
          <v-chip
            color="primary"
            variant="flat"
            size="small"
            class="ma-1"
          >
            <v-icon size="12" class="mr-1">mdi-star</v-icon>
            TensorFlow Quantum
          </v-chip>
          <v-chip variant="tonal" size="small" class="ma-1">PyTorch Lightning</v-chip>
          <v-chip variant="tonal" size="small" class="ma-1">AutoML</v-chip>
          <v-chip
            color="primary"
            variant="flat"
            size="small"
            class="ma-1"
          >
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
          <v-chip
            color="info"
            variant="flat"
            size="small"
            class="ma-1"
          >
            <v-icon size="12" class="mr-1">mdi-star</v-icon>
            Serverless Edge
          </v-chip>
          <v-chip
            color="info"
            variant="flat"
            size="small"
            class="ma-1"
          >
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
          <v-chip
            color="success"
            variant="flat"
            size="small"
            class="ma-1"
          >
            <v-icon size="12" class="mr-1">mdi-star</v-icon>
            Stream Processing
          </v-chip>
          <v-chip variant="tonal" size="small" class="ma-1">Data Lake</v-chip>
          <v-chip
            color="success"
            variant="flat"
            size="small"
            class="ma-1"
          >
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
          <v-chip
            color="error"
            variant="flat"
            size="small"
            class="ma-1"
          >
            <v-icon size="12" class="mr-1">mdi-star</v-icon>
            Zero Trust Architecture
          </v-chip>
          <v-chip
            color="error"
            variant="flat"
            size="small"
            class="ma-1"
          >
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

  <!-- About Cloudless App & Company Intro (now after tech stack) -->
  <div class="text-center mb-1 mt-2">
    <h3 class="section-title">About the Platform</h3>
  </div>
  <div class="about-intro-section about-intro-section--compact mb-2">
    <div class="about-intro-content">
      <h2 class="about-intro-title about-intro-title--compact">About Cloudless</h2>
      <p class="about-intro-paragraph about-intro-paragraph--compact">
        Cloudless is a next-generation platform designed to empower organizations with advanced AI, quantum-ready infrastructure, and secure, scalable data solutions. Our application streamlines business operations across marketing, sales, and finance, providing real-time analytics, automation, and actionable insights. With a focus on innovation, security, and measurable business impact, Cloudless helps companies accelerate growth, optimize resources, and stay ahead in a rapidly evolving digital landscape. Whether you're a startup or an enterprise, our platform adapts to your needs, ensuring seamless integration and maximum ROI.
      </p>
    </div>
  </div>


</template>

<script setup lang="ts">
definePageMeta({ layout: 'info' });

const departments = [
  {
    icon: { color: 'primary', name: 'mdi-chart-line' },
    name: 'Marketing Intelligence',
    tag: 'Revenue Growth',
    features: [
      'Real-time campaign optimization',
      'Predictive customer segmentation',
      'Attribution modeling',
      'Cross-channel analytics'
    ],
    impact: { value: '+340%', label: 'ROI Increase', chip: { color: 'primary', text: '+34% CTR' } }
  },
  {
    icon: { color: 'success', name: 'mdi-target' },
    name: 'Sales Operations',
    tag: 'Pipeline Acceleration',
    features: [
      'Lead scoring automation',
      'Opportunity prediction',
      'Territory optimization',
      'Performance analytics'
    ],
    impact: { value: '+28%', label: 'Conversion Rate', chip: { color: 'success', text: '45% Faster Close' } }
  },
  {
    icon: { color: 'warning', name: 'mdi-currency-usd' },
    name: 'Financial Planning',
    tag: 'Risk Management',
    features: [
      'Automated forecasting',
      'Fraud detection',
      'Compliance monitoring'
    ],
    impact: { value: '67%', label: 'Risk Reduction', chip: { color: 'warning', text: '67% Risk Reduction' } }
  }
];
</script>

<style scoped>
.about-hero-section {
  width: 100%;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 41, 59, 0.55);
  border-radius: 0 0 32px 32px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  position: relative;
  z-index: 30;
  margin-bottom: 2.5rem;
  padding: 3.2rem 1.5rem 2.5rem 1.5rem;
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1.5px solid rgba(255,255,255,0.22);
  overflow: hidden;
}
.glass-hero {
  background: rgba(30, 41, 59, 0.55);
  border-radius: 0 0 32px 32px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  border: 1.5px solid rgba(255,255,255,0.22);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
}
.about-hero-content {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}
.about-hero-title {
  font-size: 3rem;
  font-weight: 900;
  color: #fff;
  margin-bottom: 1.1rem;
  letter-spacing: 0.5px;
  text-shadow: 0 4px 18px rgba(0,0,0,0.18), 0 1px 0 #222;
}
.about-hero-subtitle {
  font-size: 1.35rem;
  color: #e0e7ef;
  font-weight: 400;
  line-height: 1.7;
  margin-bottom: 0;
  text-shadow: 0 2px 8px rgba(0,0,0,0.13);
}
.about-hero-highlight {
  display: block;
  margin-top: 0.7rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: #ffd700;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 8px rgba(60,60,120,0.13);
}
.about-hero-cta {
  font-size: 1.1rem;
  font-weight: 700;
  padding: 0.85rem 2.2rem;
  border-radius: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.13);
  transition: background 0.2s, box-shadow 0.2s;
}
.about-hero-cta:hover {
  background: linear-gradient(90deg, #6366f1 0%, #38bdf8 100%);
  box-shadow: 0 4px 18px rgba(99,102,241,0.18);
}
@media (max-width: 600px) {
  .about-hero-section {
    min-height: 120px;
    padding: 1.2rem 0.5rem 1rem 0.5rem;
    border-radius: 0 0 18px 18px;
  }
  .about-hero-title {
    font-size: 1.6rem;
  }
  .about-hero-subtitle {
    font-size: 1rem;
  }
  .about-hero-highlight {
    font-size: 0.95rem;
  }
  .about-hero-cta {
    font-size: 1rem;
    padding: 0.7rem 1.2rem;
  }
  .about-intro-section {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
    border-radius: 12px;
  }
  .about-intro-title {
    font-size: 1.1rem;
  }
  .about-intro-paragraph {
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .departments-section .v-row {
    flex-direction: column !important;
    gap: 1.2rem;
  }
.department-card.modern-card.compact-card {
  padding: 0.9rem 0.6rem;
  border-radius: 10px;
  min-width: 0;
  margin: 0 auto 1.2rem auto;
  box-shadow: 0 2px 8px 0 rgba(31, 38, 135, 0.08);
  max-width: 340px;
}
.department-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.department-name {
  font-size: 1.05rem;
  font-weight: 600;
}
.department-tag {
  font-size: 0.92rem;
  color: #64748b;
}
.department-features {
  margin: 0.5rem 0 0.3rem 0;
  font-size: 0.95rem;
}
.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.2rem;
}
.department-impact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
}
.impact-metric {
  font-size: 0.92rem;
  font-weight: 500;
}
  .department-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .department-name {
    font-size: 1.1rem;
  }
  .department-tag {
    font-size: 0.9rem;
  }
  .department-features {
    font-size: 0.95rem;
  }
  .impact-metric {
    font-size: 0.95rem;
  }
  .tech-stack-section {
    padding: 0.5rem 0.2rem;
  }
  .tech-title {
    font-size: 1.1rem;
  }
  .tech-subtitle {
    font-size: 0.95rem;
  }
  .tech-categories {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 1.2rem;
    padding-bottom: 0.5rem;
    -webkit-overflow-scrolling: touch;
  }
  .tech-category {
    min-width: 240px;
    flex: 0 0 auto;
    border-radius: 12px;
    padding: 1rem 0.7rem;
    box-shadow: 0 2px 10px 0 rgba(31, 38, 135, 0.10);
    margin-bottom: 0.5rem;
  }
  .category-header {
    font-size: 1rem;
  }
  .tech-items {
    flex-wrap: wrap;
    gap: 0.3rem;
  }
}
.about-main-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #222;
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(60, 60, 120, 0.08);
}

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

.modern-about-card {
  background: #fff !important;
  border-radius: 20px;
  box-shadow: 0 8px 32px 0 rgba(60, 60, 120, 0.10), 0 1.5px 6px 0 rgba(102, 126, 234, 0.08);
  color: #1e293b;
  padding: 2.5rem 2rem;
  max-width: 900px;
  margin: 0 auto;
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



.v-icon {
  opacity: 0.85;
}
/* Accessibility button icon color override (if present) */
.v-icon.accessibility-icon, .accessibility-btn .v-icon {
  color: #ffd700 !important;
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
  position: relative;
  z-index: 0;
}

/* Why Choose Cloudless Section */
.why-choose-section {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem 0;
  position: relative;
  z-index: 2;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  /* Glassmorphism effect */
}

@media (max-width: 1024px) {
  .why-choose-section {
    padding: 1.2rem 0.5rem;
  }
}

.section-header {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  background: none;
  color: #fff !important;
}

.section-subtitle {
  font-size: 1.1rem;
  color: #fff !important;
  max-width: 600px;
  margin: 0 auto;
}

/* Benefit Cards */
.benefit-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 16px;
  box-shadow: 0 2px 12px 0 rgba(60, 60, 120, 0.07);
  color: #26324d;
  margin-bottom: 1.5rem;
}

.benefit-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.benefit-quantum {
  border-left: 6px solid #1976d2;
}

.benefit-ai {
  border-left: 6px solid #43a047;
}

.benefit-innovation {
  border-left: 6px solid #ffa000;
}

.benefit-security {
  border-left: 6px solid #e53935;
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
  background: #fff !important;
  border-radius: 14px;
  box-shadow: 0 2px 8px 0 rgba(60, 60, 120, 0.06);
  color: #26324d;
  transition: all 0.3s ease;
}

.department-card:hover {
  border-color: #667eea;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
}

.modern-card {
  border: none;
  background: #fff !important;
  border-radius: 18px;
  box-shadow: 0 8px 32px 0 rgba(60, 60, 120, 0.10), 0 1.5px 6px 0 rgba(102, 126, 234, 0.08);
  transition: box-shadow 0.3s, transform 0.3s;
  padding: 2rem 1.5rem;
  position: relative;
  overflow: hidden;
}

.modern-card:hover {
  box-shadow: 0 16px 48px 0 rgba(102, 126, 234, 0.18), 0 4px 16px 0 rgba(60, 60, 120, 0.10);
  transform: translateY(-6px) scale(1.03);
}

.department-header {
  display: flex;
  align-items: center;
  margin-bottom: 1.25rem;
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
  box-shadow: 0 2px 8px 0 rgba(102, 126, 234, 0.10);
}

.department-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.department-tag {
  font-size: 0.8rem;
  color: #fff;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 0.3rem;
  display: inline-block;
}

.department-features {
  margin-bottom: 1.2rem;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
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
  font-size: 1.3rem;
  font-weight: 700;
  color: #059669;
}

.impact-label {
  font-size: 0.8rem;
  color: #64748b;
  text-transform: uppercase;
}

/* Technology Stack */
.tech-stack-section {
  background: rgba(30, 41, 59, 0.55); /* semi-transparent dark glass */
  border-radius: 16px;
  padding: 2rem;
  color: white;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  /* Glassmorphism effect */
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
  background: rgba(255, 255, 255, 0.18); /* semi-transparent glass */
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  padding: 1.2rem 0.7rem;
  color: white;
}

@media (max-width: 768px) {
  .roi-container {
    padding: 0.6rem 0.2rem;
  }
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

  .tech-stack-section {
    padding: 1rem 0.3rem;
  }

  .roi-container {
    padding: 1rem 0.3rem;
  }
}

@media (max-width: 1024px) {
  .why-choose-section {
    padding: 1.2rem 0.5rem;
  }
}
@media (max-width: 768px) {
  .why-choose-section {
    padding: 0.5rem 0.2rem;
    margin: 1rem 0;
  }
  .section-title {
    font-size: 1.5rem;
  }
  .section-header {
    margin-bottom: 1rem;
  }
  .benefit-card {
    margin-bottom: 1.2rem;
    padding: 1.2rem 0.8rem;
  }
  .benefit-title {
    font-size: 1rem;
  }
  .benefit-description {
    font-size: 0.95rem;
  }
  .benefit-metric-value {
    font-size: 1.1rem;
  }
  .benefit-icon-container, .benefit-icon-bg {
    width: 48px;
    height: 48px;
  }
}
</style>
