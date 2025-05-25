<template>
  <div class="sitemap-container">
    <h1 class="page-title">Sitemap</h1>
    
    <div class="sitemap-content">
      <div class="sitemap-section">
        <h2 class="section-title">Main Navigation</h2>
        <ul class="sitemap-links">
          <li>
            <NuxtLink to="/" class="sitemap-link">Home</NuxtLink>
            <p class="link-description">Welcome to Cloudless - Cloud solutions and web development services</p>
          </li>
          <li>
            <NuxtLink to="/projects" class="sitemap-link">Projects</NuxtLink>
            <p class="link-description">Explore our portfolio of client projects and case studies</p>
          </li>
          <li>
            <NuxtLink to="/about" class="sitemap-link">About Us</NuxtLink>
            <p class="link-description">Learn about our company, mission, vision, and team</p>
          </li>
          <li>
            <NuxtLink to="/contact" class="sitemap-link">Contact</NuxtLink>
            <p class="link-description">Get in touch with our team for inquiries and quotes</p>
          </li>
          <li>
            <NuxtLink to="/codegen" class="sitemap-link">Codegen</NuxtLink>
            <p class="link-description">Our code generation and AI development tools</p>
          </li>
        </ul>
      </div>
      
      <div class="sitemap-section">
        <h2 class="section-title">User Account & Dashboard</h2>
        <ul class="sitemap-links">
          <li>
            <NuxtLink to="/auth/login" class="sitemap-link">Login</NuxtLink>
            <p class="link-description">Sign in to your account</p>
          </li>
          <li>
            <NuxtLink to="/auth/signup" class="sitemap-link">Sign Up</NuxtLink>
            <p class="link-description">Create a new account</p>
          </li>
          <li>
            <NuxtLink to="/auth/forgot-password" class="sitemap-link">Forgot Password</NuxtLink>
            <p class="link-description">Reset your account password</p>
          </li>
          <li>
            <NuxtLink to="/dashboard" class="sitemap-link">Dashboard</NuxtLink>
            <p class="link-description">User dashboard with activity overview</p>
          </li>
          <li>
            <NuxtLink to="/profile" class="sitemap-link">Profile</NuxtLink>
            <p class="link-description">Manage your user profile</p>
          </li>
          <li>
            <NuxtLink to="/settings" class="sitemap-link">Settings</NuxtLink>
            <p class="link-description">Configure your account preferences</p>
          </li>
        </ul>
      </div>
      
      <div class="sitemap-section">
        <h2 class="section-title">Projects & Services</h2>
        <ul class="sitemap-links">
          <li>
            <NuxtLink to="/projects" class="sitemap-link">All Projects</NuxtLink>
            <p class="link-description">Browse our complete project portfolio</p>
          </li>
          <li v-for="(project, index) in featuredProjects" :key="index">
            <NuxtLink :to="`/projects/${project.slug}`" class="sitemap-link">{{ project.title }}</NuxtLink>
            <p class="link-description">{{ project.shortDescription }}</p>
          </li>
        </ul>
      </div>
      
      <div class="sitemap-section">
        <h2 class="section-title">Resources & Information</h2>
        <ul class="sitemap-links">
          <li>
            <NuxtLink to="/faq" class="sitemap-link">FAQ</NuxtLink>
            <p class="link-description">Frequently asked questions</p>
          </li>
          <li>
            <NuxtLink to="/terms" class="sitemap-link">Terms & Privacy</NuxtLink>
            <p class="link-description">Terms of service and privacy policy</p>
          </li>
          <li>
            <NuxtLink to="/responsive-demo" class="sitemap-link">Responsive Demo</NuxtLink>
            <p class="link-description">Demo of our responsive design capabilities</p>
          </li>
        </ul>
      </div>
      
      <div v-if="isAdmin" class="sitemap-section admin-section">
        <h2 class="section-title">Admin Area</h2>
        <ul class="sitemap-links">
          <li>
            <NuxtLink to="/admin/dashboard" class="sitemap-link">Admin Dashboard</NuxtLink>
            <p class="link-description">Overview of site analytics and activity</p>
          </li>
          <li>
            <NuxtLink to="/admin/users" class="sitemap-link">User Management</NuxtLink>
            <p class="link-description">Manage user accounts and permissions</p>
          </li>
          <li>
            <NuxtLink to="/admin/projects" class="sitemap-link">Project Management</NuxtLink>
            <p class="link-description">Create and edit project listings</p>
          </li>
          <li>
            <NuxtLink to="/admin/contact-submissions" class="sitemap-link">Contact Submissions</NuxtLink>
            <p class="link-description">View and manage contact form submissions</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';

interface Project {
  title: string;
  slug: string;
  shortDescription: string;
}

const { isLoggedIn, currentUser } = useUserAuth();

const isAdmin = computed(() => {
  return currentUser.value?.role === 'admin';
});

// Featured projects - in a real app, these would be fetched from an API or database
const featuredProjects = ref<Project[]>([
  {
    title: 'E-commerce Platform',
    slug: 'e-commerce-platform',
    shortDescription: 'A full-featured online store with product management and checkout'
  },
  {
    title: 'Health & Fitness App',
    slug: 'health-fitness-app',
    shortDescription: 'Mobile application for tracking workouts and nutrition'
  },
  {
    title: 'Corporate Website Redesign',
    slug: 'corporate-website-redesign',
    shortDescription: 'Modern redesign of a corporate website with improved UX'
  },
  {
    title: 'AI Content Generator',
    slug: 'ai-content-generator',
    shortDescription: 'Tool that leverages machine learning to generate content'
  }
]);
</script>

<style scoped>
.sitemap-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-title {
  font-size: 2.25rem;
  margin-bottom: 2rem;
  color: #1e40af;
  text-align: center;
  font-weight: 700;
}

.sitemap-content {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.sitemap-section {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  padding: 1.5rem 2rem;
  border: 1px solid rgba(219, 234, 254, 0.6);
}

.section-title {
  font-size: 1.5rem;
  color: #1e40af;
  margin-top: 0;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(219, 234, 254, 0.8);
  font-weight: 600;
}

.sitemap-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.sitemap-links li {
  padding: 0.5rem 0;
}

.sitemap-link {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  margin-bottom: 0.25rem;
  transition: color 0.2s;
}

.sitemap-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.link-description {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.4;
}

.admin-section {
  background: rgba(243, 244, 246, 0.85);
  border-color: rgba(156, 163, 175, 0.4);
}

@media (max-width: 768px) {
  .sitemap-links {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .section-title {
    font-size: 1.35rem;
  }
}
</style>
