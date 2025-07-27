<template>
  <div class="responsive-demo">
    <div class="info-panel">
      <h2 class="text-2xl font-bold mb-6">Responsive Design Demo</h2>

      <div class="stats-container">
        <v-card class="stat-card" :class="{ active: isMobile }">
          <v-card-text class="text-center">
            <h3 class="text-h6 mb-2">Mobile</h3>
            <div class="icon mb-2">📱</div>
            <div class="status">{{ isMobile ? 'Active' : 'Inactive' }}</div>
          </v-card-text>
        </v-card>

        <v-card class="stat-card" :class="{ active: isTablet }">
          <v-card-text class="text-center">
            <h3 class="text-h6 mb-2">Tablet</h3>
            <div class="icon mb-2">📔</div>
            <div class="status">{{ isTablet ? 'Active' : 'Inactive' }}</div>
          </v-card-text>
        </v-card>

        <v-card class="stat-card" :class="{ active: isDesktop }">
          <v-card-text class="text-center">
            <h3 class="text-h6 mb-2">Desktop</h3>
            <div class="icon mb-2">💻</div>
            <div class="status">{{ isDesktop ? 'Active' : 'Inactive' }}</div>
          </v-card-text>
        </v-card>

        <v-card class="stat-card" :class="{ active: isLargeDesktop }">
          <v-card-text class="text-center">
            <h3 class="text-h6 mb-2">Large Desktop</h3>
            <div class="icon mb-2">🖥️</div>
            <div class="status">{{ isLargeDesktop ? 'Active' : 'Inactive' }}</div>
          </v-card-text>
        </v-card>
      </div>

      <v-card class="info-card mb-4">
        <v-card-title class="text-h6">Screen Information</v-card-title>
        <v-card-text>
          <div class="info-item">
            <span class="label">Screen Width:</span>
            <span class="value">{{ width }}px</span>
          </div>
          <div class="info-item">
            <span class="label">Screen Height:</span>
            <span class="value">{{ height }}px</span>
          </div>
          <div class="info-item">
            <span class="label">Orientation:</span>
            <span class="value">{{ isPortrait ? 'Portrait' : 'Landscape' }}</span>
          </div>
        </v-card-text>
      </v-card>

      <v-card class="info-card">
        <v-card-title class="text-h6">Breakpoints</v-card-title>
        <v-card-text>
          <ul class="breakpoints-list">
            <li>Mobile: &lt; {{ breakpoints.mobile }}px</li>
            <li>Tablet: {{ breakpoints.mobile }}px - {{ breakpoints.tablet - 1 }}px</li>
            <li>Desktop: {{ breakpoints.tablet }}px - {{ breakpoints.desktop - 1 }}px</li>
            <li>Large Desktop: ≥ {{ breakpoints.desktop }}px</li>
          </ul>
        </v-card-text>
      </v-card>
    </div>

    <div class="demo-content">
      <div class="responsive-showcase">
        <v-card class="showcase-card mobile" :class="{ active: isMobile }">
          <v-card-title class="showcase-title">Mobile Content</v-card-title>
          <v-card-text>
            <p>This content is optimized for mobile devices.</p>
            <div class="btn-container">
              <v-btn color="primary" variant="elevated">Click Me</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="showcase-card tablet" :class="{ active: isTablet }">
          <v-card-title class="showcase-title">Tablet Content</v-card-title>
          <v-card-text>
            <p>This content appears differently on tablet screens.</p>
            <div class="btn-container">
              <v-btn color="primary" variant="elevated" class="me-2">Primary</v-btn>
              <v-btn color="secondary" variant="outlined">Secondary</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="showcase-card desktop" :class="{ active: isDesktop || isLargeDesktop }">
          <v-card-title class="showcase-title">Desktop Content</v-card-title>
          <v-card-text>
            <p>This content has additional features on desktop screens.</p>
            <div class="btn-container">
              <v-btn color="primary" variant="elevated" class="me-2">Primary</v-btn>
              <v-btn color="secondary" variant="outlined" class="me-2">Secondary</v-btn>
              <v-btn color="warning" variant="tonal">Tertiary</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { useResponsive } from '~/composables/useResponsive'

  // Get responsive utilities
  const { width, height, isMobile, isTablet, isDesktop, isLargeDesktop, isPortrait, breakpoints } =
    useResponsive()
</script>

<style scoped>
  .responsive-demo {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .info-panel {
    background-color: #f8fafc;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    transition: all 0.3s ease;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  }

  .stat-card.active {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3));
    border-color: rgba(59, 130, 246, 0.4);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 12px 40px 0 rgba(59, 130, 246, 0.45);
  }

  .stat-card.active .v-card-text {
    color: white !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .stat-box h3 {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .stat-box .icon {
    font-size: 2rem;
    margin: 0.5rem 0;
  }

  .stat-box .status {
    font-weight: 500;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .info-card {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    transition: all 0.3s ease;
  }

  .info-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.45);
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-item .label {
    font-weight: 500;
    color: rgba(0, 0, 0, 0.7);
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .info-item .value {
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .breakpoints-list {
    list-style: none;
    padding: 0;
  }

  .breakpoints-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(0, 0, 0, 0.87);
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .breakpoints-list li:last-child {
    border-bottom: none;
  }

  .breakpoints-info ul {
    list-style: none;
    padding: 0;
  }

  .breakpoints-info li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .breakpoints-info li:last-child {
    border-bottom: none;
  }

  .demo-content {
    margin-top: 1rem;
  }

  .responsive-showcase {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .responsive-demo {
      padding: 3rem;
    }

    .responsive-showcase {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
  }

  .showcase-card {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    opacity: 0.4;
    transform: scale(0.95);
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .showcase-card.active {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.45);
  }

  .showcase-title {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(0, 0, 0, 0.87);
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }

  .btn-container {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .btn-container {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .btn-container .v-btn {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .btn-container .v-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  .mobile.active .showcase-title {
    background: linear-gradient(135deg, rgba(251, 113, 133, 0.3), rgba(244, 63, 94, 0.3));
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .tablet.active .showcase-title {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(59, 130, 246, 0.3));
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .desktop.active .showcase-title {
    background: linear-gradient(135deg, rgba(52, 211, 153, 0.3), rgba(16, 185, 129, 0.3));
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: 767px) {
    .showcase-card:not(.active) {
      display: none;
    }
  }
</style>
