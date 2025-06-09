<template>
  <v-container class="pa-0">
    <!-- Header Section -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-8 text-center"
        >
          <v-card-text>
            <h1 class="text-h2 text-primary font-weight-bold mb-6">Our Projects</h1>
            <p class="text-h6 text-medium-emphasis mx-auto" style="max-width: 800px">
              Explore our portfolio of innovative solutions and cutting-edge applications. Each
              project showcases our expertise in different technologies and domains.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Projects Grid -->
    <v-row class="mb-8">
      <v-col v-for="project in projects" :key="project.id" cols="12" sm="6" lg="4">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="h-100"
          hover
          @click="navigateToProject(project.slug)"
          style="cursor: pointer"
        >
          <v-card-text class="pa-6">
            <div class="text-center mb-4">
              <div class="text-h1 mb-2">{{ project.icon }}</div>
              <h3 class="text-h5 text-primary font-weight-bold mb-3">{{ project.title }}</h3>
              <p class="text-body-2 text-medium-emphasis mb-4" style="line-height: 1.6">
                {{ project.description }}
              </p>
            </div>

            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip
                v-for="tag in project.tags"
                :key="tag"
                size="small"
                color="primary"
                variant="outlined"
              >
                {{ tag }}
              </v-chip>
            </div>

            <v-btn
              :to="`/projects/${project.slug}`"
              color="primary"
              variant="outlined"
              rounded="lg"
              block
              prepend-icon="mdi-arrow-right"
            >
              View Project Details
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- CTA Section -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-8 text-center"
        >
          <v-card-text>
            <h2 class="text-h3 text-primary font-weight-bold mb-4">Ready to Start Your Project?</h2>
            <p class="text-body-1 text-medium-emphasis mb-6 mx-auto" style="max-width: 600px">
              Let's discuss how we can help bring your ideas to life with our expertise and
              innovative solutions.
            </p>
            <v-btn
              to="/contact"
              color="primary"
              size="large"
              rounded="lg"
              variant="elevated"
              prepend-icon="mdi-email"
            >
              Get in Touch
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  // Project data interface
  interface ProjectLink {
    label: string;
    url: string;
  }

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
      description:
        'Robust authentication and authorization systems with JWT tokens and advanced security features.',
      icon: '🔐',
      tags: ['Security', 'JWT', 'Auth'],
      technologies: ['Node.js', 'JWT', 'OAuth 2.0', 'Passport.js'],
      featured: true,
    },
    {
      id: '2',
      slug: 'data-analytics',
      title: 'Data Analytics Dashboards',
      description:
        'Interactive dashboards for data visualization and business intelligence with real-time updates.',
      icon: '📊',
      tags: ['Analytics', 'Charts', 'Real-time'],
      technologies: ['Vue.js', 'D3.js', 'WebSockets', 'MongoDB'],
      featured: true,
    },
    {
      id: '3',
      slug: 'cloudless-solutions',
      title: 'Cloudless Solutions',
      description:
        'Serverless architectures and edge computing solutions for maximum performance and scalability.',
      icon: '☁️',
      tags: ['Serverless', 'Edge', 'Cloud'],
      technologies: ['AWS Lambda', 'Vercel Edge Functions', 'Cloudflare Workers'],
      featured: true,
    },
    {
      id: '4',
      slug: 'e-commerce-platform',
      title: 'E-Commerce Platform',
      description:
        'Fully featured e-commerce solution with product management, cart functionality, and payment processing.',
      icon: '🛍️',
      tags: ['E-Commerce', 'Payments', 'Products'],
      technologies: ['Nuxt.js', 'Stripe', 'MongoDB', 'Tailwind CSS'],
    },
    {
      id: '5',
      slug: 'mobile-app-sync',
      title: 'Mobile App Sync',
      description:
        'Cross-platform synchronization system for mobile applications with offline-first capabilities.',
      icon: '📱',
      tags: ['Mobile', 'Sync', 'Offline'],
      technologies: ['React Native', 'GraphQL', 'Apollo', 'SQLite'],
    },
    {
      id: '6',
      slug: 'ai-content-manager',
      title: 'AI Content Manager',
      description:
        'AI-powered system for content creation, optimization, and management across multiple platforms.',
      icon: '🤖',
      tags: ['AI', 'Content', 'Automation'],
      technologies: ['Vue.js', 'NLP', 'Python', 'FastAPI'],
    },
  ];

  // Navigation function
  const navigateToProject = (slug: string): void => {
    navigateTo(`/projects/${slug}`);
  };

  // Set page meta
  definePageMeta({
    layout: 'default',
  });

  // Set page head
  useSeoMeta({
    title: 'Projects | Cloudless',
    description: 'Explore our portfolio of innovative solutions and cutting-edge applications.',
  });
</script>
