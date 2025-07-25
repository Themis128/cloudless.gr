<template>
  <div class="projects-container">
    <div class="projects-header">
      <h1>Our Projects</h1>
      <p class="header-description">
        Explore our portfolio of innovative web development solutions and applications.
      </p>
    </div>

    <div class="projects-grid">
      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>📱</span>
          </div>
        </div>
        <div class="project-content">
          <h3>Mobile-First Web Applications</h3>
          <p>Responsive web applications designed with mobile-first approach for optimal user experience across all devices.</p>
          <div class="project-tags">
            <span class="tag">Vue.js</span>
            <span class="tag">Nuxt.js</span>
            <span class="tag">Responsive</span>
          </div>
        </div>
      </div>

      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>⚡</span>
          </div>
        </div>
        <div class="project-content">
          <h3>High-Performance APIs</h3>
          <p>Scalable backend solutions with optimized APIs for fast data processing and seamless integration.</p>
          <div class="project-tags">
            <span class="tag">Node.js</span>
            <span class="tag">Prisma</span>
            <span class="tag">API</span>
          </div>
        </div>
      </div>

      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>🎨</span>
          </div>
        </div>
        <div class="project-content">
          <h3>Modern UI/UX Design</h3>
          <p>Beautiful, intuitive user interfaces with modern design principles and accessibility standards.</p>
          <div class="project-tags">
            <span class="tag">Design</span>
            <span class="tag">UX/UI</span>
            <span class="tag">Accessibility</span>
          </div>
        </div>
      </div>

      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>🔐</span>
          </div>
        </div>
        <div class="project-content">
          <h3>Secure Authentication Systems</h3>
          <p>Robust authentication and authorization systems with JWT tokens and advanced security features.</p>
          <div class="project-tags">
            <span class="tag">Security</span>
            <span class="tag">JWT</span>
            <span class="tag">Auth</span>
          </div>
        </div>
      </div>

      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>📊</span>
          </div>
        </div>
        <div class="project-content">
          <h3>Data Analytics Dashboards</h3>
          <p>Interactive dashboards for data visualization and business intelligence with real-time updates.</p>
          <div class="project-tags">
            <span class="tag">Analytics</span>
            <span class="tag">Charts</span>
            <span class="tag">Real-time</span>
          </div>
        </div>
      </div>

      <div class="project-card">
        <div class="project-image">
          <div class="placeholder-image">
            <span>☁️</span>
          </div>
        </div>
        <div class="project-content">
          <h3>Cloudless Solutions</h3>
          <p>Serverless architectures and edge computing solutions for maximum performance and scalability.</p>
          <div class="project-tags">
            <span class="tag">Serverless</span>
            <span class="tag">Edge</span>
            <span class="tag">Cloud</span>
          </div>
        </div>
      </div>
    </div>

    <div class="cta-section">
      <h2>Ready to Start Your Project?</h2>
      <p>Let's discuss how we can help bring your ideas to life with our expertise and innovative solutions.</p>
      <NuxtLink to="/contact" class="cta-button">
        Get in Touch
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'
// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.projects-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.projects-header {
  text-align: center;
  margin-bottom: 4rem;
}

.projects-header h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header-description {
  font-size: 1.2rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.project-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.project-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.project-image {
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.placeholder-image {
  font-size: 4rem;
  opacity: 0.8;
}

.project-content {
  padding: 1.5rem;
}

.project-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.75rem;
}

.project-content p {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.6;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background-color: #eff6ff;
  color: #2563eb;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.cta-section {
  text-align: center;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 3rem 2rem;
}

.cta-section h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.cta-section p {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.cta-button {
  display: inline-block;
  background-color: #1e40af;
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.cta-button:hover {
  background-color: #1e3a8a;
}

@media (max-width: 768px) {
  .projects-header h1 {
    font-size: 2.5rem;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .cta-section {
    padding: 2rem 1rem;
  }
}
</style>
