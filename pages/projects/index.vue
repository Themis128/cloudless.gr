<template>
  <div class="projects-container">
    <div class="projects-header">
      <h1>Our Projects</h1>
      <p class="projects-description">
        Explore our portfolio of innovative solutions and cutting-edge applications.
        Each project showcases our expertise in different technologies and domains.
      </p>
    </div>

    <div class="projects-grid">
      <div 
        v-for="project in projects" 
        :key="project.id" 
        class="project-card"
        @click="navigateToProject(project.slug)"
      >
        <div class="project-image">
          <div class="placeholder-image">
            <span>{{ project.icon }}</span>
          </div>
        </div>
        <div class="project-content">
          <h3>{{ project.title }}</h3>
          <p>{{ project.description }}</p>
          <div class="project-tags">
            <span v-for="tag in project.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <NuxtLink :to="`/projects/${project.slug}`" class="view-project-link">
            View Project Details
          </NuxtLink>
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
import { navigateTo } from '#app'
import { definePageMeta, useSeoMeta } from '#imports'
// Project data interface
interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
  technologies: string[];
  featured?: boolean;
}

// Sample project data - in a real app, this might come from an API
const projects: Project[] = [
  {
    id: '1',
    slug: 'secure-authentication',
    title: 'Secure Authentication Systems',
    description: 'Robust authentication and authorization systems with JWT tokens and advanced security features.',
    icon: '🔐',
    tags: ['Security', 'JWT', 'Auth'],
    technologies: ['Node.js', 'JWT', 'OAuth 2.0', 'Passport.js'],
    featured: true
  },
  {
    id: '2',
    slug: 'data-analytics',
    title: 'Data Analytics Dashboards',
    description: 'Interactive dashboards for data visualization and business intelligence with real-time updates.',
    icon: '📊',
    tags: ['Analytics', 'Charts', 'Real-time'],
    technologies: ['Vue.js', 'D3.js', 'WebSockets', 'MongoDB'],
    featured: true
  },
  {
    id: '3',
    slug: 'cloudless-solutions',
    title: 'Cloudless Solutions',
    description: 'Serverless architectures and edge computing solutions for maximum performance and scalability.',
    icon: '☁️',
    tags: ['Serverless', 'Edge', 'Cloud'],
    technologies: ['AWS Lambda', 'Vercel Edge Functions', 'Cloudflare Workers'],
    featured: true
  },
  {
    id: '4',
    slug: 'e-commerce-platform',
    title: 'E-Commerce Platform',
    description: 'Fully featured e-commerce solution with product management, cart functionality, and payment processing.',
    icon: '🛍️',
    tags: ['E-Commerce', 'Payments', 'Products'],
    technologies: ['Nuxt.js', 'Stripe', 'MongoDB', 'Tailwind CSS']
  },
  {
    id: '5',
    slug: 'mobile-app-sync',
    title: 'Mobile App Sync',
    description: 'Cross-platform synchronization system for mobile applications with offline-first capabilities.',
    icon: '📱',
    tags: ['Mobile', 'Sync', 'Offline'],
    technologies: ['React Native', 'GraphQL', 'Apollo', 'SQLite']
  },
  {
    id: '6',
    slug: 'ai-content-manager',
    title: 'AI Content Manager',
    description: 'AI-powered system for content creation, optimization, and management across multiple platforms.',
    icon: '🤖',
    tags: ['AI', 'Content', 'Automation'],
    technologies: ['Vue.js', 'NLP', 'Python', 'FastAPI']
  }
];

// Navigation function
const navigateToProject = (slug: string): void => {
  navigateTo(`/projects/${slug}`);
};

// Set page meta
definePageMeta({
  layout: 'default'
});

// Set page head
useSeoMeta({
  title: 'Projects | Cloudless',
  description: 'Explore our portfolio of innovative solutions and cutting-edge applications.'
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
  margin-bottom: 3rem;
}

.projects-header h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.projects-description {
  font-size: 1.2rem;
  color: #64748b;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.project-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.project-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.project-image {
  width: 100%;
  overflow: hidden;
}

.placeholder-image {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  background-color: #f8fafc;
  color: #1e40af;
}

.project-content {
  padding: 1.5rem;
}

.project-content h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.75rem;
}

.project-content p {
  color: #64748b;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.tag {
  background-color: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.view-project-link {
  display: inline-block;
  background-color: #1e40af;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
  font-weight: 500;
  transition: background-color 0.2s;
  margin-top: 1rem;
}

.view-project-link:hover {
  background-color: #1e3a8a;
}

.cta-section {
  text-align: center;
  padding: 3rem;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
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
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cta-button {
  display: inline-block;
  background-color: #1e40af;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.2s;
  font-size: 1.1rem;
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
    padding: 2rem 1.5rem;
  }
}
</style>
