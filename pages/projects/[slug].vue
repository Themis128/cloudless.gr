<template>
  <v-container class="pa-0">
    <!-- Back Navigation -->
    <v-row class="mb-6">
      <v-col cols="12">
        <v-btn to="/projects" variant="outlined" prepend-icon="mdi-arrow-left" rounded="lg">
          Back to Projects
        </v-btn>
      </v-col>
    </v-row>

    <!-- Project Header -->
    <v-row justify="center" class="mb-8">
      <v-col cols="12">
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-8">
          <v-card-text class="text-center">
            <div class="text-h1 mb-4">{{ project.icon }}</div>
            <h1 class="text-h2 text-primary font-weight-bold mb-4">{{ project.title }}</h1>
            <p class="text-h6 text-medium-emphasis mx-auto mb-6" style="max-width: 800px">
              {{ project.description }}
            </p>

            <div class="d-flex flex-wrap justify-center ga-2">
              <v-chip
                v-for="tag in project.tags"
                :key="tag"
                color="primary"
                variant="outlined"
                size="large"
              >
                {{ tag }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Project Content -->
    <v-row class="mb-8">
      <v-col cols="12" lg="8">
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-8 h-100">
          <v-card-title class="text-h4 text-primary font-weight-bold mb-4">
            Project Overview
          </v-card-title>
          <v-card-text>
            <div v-html="project.content" class="text-body-1" style="line-height: 1.7"></div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <!-- Technologies Used -->
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="pa-6 mb-6">
          <v-card-title class="text-h5 text-primary font-weight-bold mb-4">
            Technologies Used
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="tech in project.technologies"
                :key="tech"
                prepend-icon="mdi-check-circle"
              >
                <v-list-item-title>{{ tech }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Project Links -->
        <v-card
          v-if="project.links && project.links.length"
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-6"
        >
          <v-card-title class="text-h5 text-primary font-weight-bold mb-4">
            Project Links
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column ga-3">
              <v-btn
                v-for="link in project.links"
                :key="link.url"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                color="primary"
                rounded="lg"
                prepend-icon="mdi-open-in-new"
                block
              >
                {{ link.label }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Call to Action -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          elevation="8"
          rounded="xl"
          color="rgba(255, 255, 255, 0.95)"
          class="pa-8 text-center"
        >
          <v-card-text>
            <h2 class="text-h3 text-primary font-weight-bold mb-4">Interested in Similar Work?</h2>
            <p class="text-body-1 text-medium-emphasis mb-6 mx-auto" style="max-width: 600px">
              We'd love to discuss how we can help bring your project ideas to life with similar
              expertise and innovative solutions.
            </p>
            <v-btn
              to="/contact"
              color="primary"
              size="large"
              rounded="lg"
              variant="elevated"
              prepend-icon="mdi-email"
            >
              Start a Conversation
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from '#imports';

  // Get the slug from the route
  const route = useRoute();
  const slug = route.params.slug as string;

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
    content: string;
    links?: ProjectLink[];
  }

  // This would typically come from an API
  // For now, we're hardcoding project data based on the slug
  const projectsData: Record<string, Project> = {
    'secure-authentication': {
      id: '1',
      slug: 'secure-authentication',
      title: 'Secure Authentication Systems',
      description:
        'Robust authentication and authorization systems with JWT tokens and advanced security features.',
      icon: '🔐',
      tags: ['Security', 'JWT', 'Auth'],
      technologies: ['Node.js', 'JWT', 'OAuth 2.0', 'Passport.js', 'bcrypt'],
      content: `
      <p>Our secure authentication solution provides enterprise-grade security for web applications.
      Featuring advanced password policies, multi-factor authentication, and comprehensive audit logs,
      this system ensures your users' data remains protected.</p>

      <p>Key security features include:</p>
      <ul>
        <li>JWT token authentication with secure refresh mechanisms</li>
        <li>Role-based access control system</li>
        <li>Rate limiting and brute force protection</li>
        <li>Session management with automatic timeouts</li>
        <li>Secure password recovery workflows</li>
      </ul>
    `,
      links: [
        { label: 'Documentation', url: '#' },
        { label: 'Demo', url: '#' },
      ],
    },
    'data-analytics': {
      id: '2',
      slug: 'data-analytics',
      title: 'Data Analytics Dashboards',
      description:
        'Interactive dashboards for data visualization and business intelligence with real-time updates.',
      icon: '📊',
      tags: ['Analytics', 'Charts', 'Real-time'],
      technologies: ['Vue.js', 'D3.js', 'WebSockets', 'MongoDB', 'Express'],
      content: `
      <p>Our data analytics platform transforms complex data into intuitive visualizations,
      enabling businesses to make informed decisions quickly. With real-time updates and
      interactive elements, users can drill down into data points for deeper insights.</p>

      <p>Dashboard features include:</p>
      <ul>
        <li>Customizable widget-based layout</li>
        <li>Multiple visualization types (charts, tables, maps)</li>
        <li>Data filtering and sorting capabilities</li>
        <li>Export options (PDF, CSV, Excel)</li>
        <li>User-specific saved views</li>
      </ul>
    `,
      links: [{ label: 'Live Demo', url: '#' }],
    },
    'cloudless-solutions': {
      id: '3',
      slug: 'cloudless-solutions',
      title: 'Cloudless Solutions',
      description:
        'Serverless architectures and edge computing solutions for maximum performance and scalability.',
      icon: '☁️',
      tags: ['Serverless', 'Edge', 'Cloud'],
      technologies: [
        'AWS Lambda',
        'Vercel Edge Functions',
        'Netlify Functions',
        'CloudFlare Workers',
        'Next.js',
      ],
      content: `
      <p>Our cloudless architecture leverages the power of edge computing and serverless
      functions to deliver exceptional performance with minimal infrastructure management.
      These solutions provide global scalability with reduced latency and operational costs.</p>

      <p>Implementation highlights:</p>
      <ul>
        <li>Global edge network deployment</li>
        <li>Automatic scaling based on demand</li>
        <li>Zero cold-start optimization techniques</li>
        <li>Robust error handling and retry logic</li>
        <li>Comprehensive logging and monitoring</li>
      </ul>
    `,
    },
    default: {
      id: '0',
      slug: 'default',
      title: 'Project Details',
      description: 'Information about this project',
      icon: '🚧',
      tags: ['Project'],
      technologies: ['Various Technologies'],
      content: '<p>Project details not found. Please return to the projects page.</p>',
    },
  };

  // Get project data based on slug
  const project = ref(projectsData[slug as string] || projectsData.default);

  // Set page meta
  definePageMeta({
    layout: 'default',
  });

  // Set page head
  useSeoMeta({
    title: () => `${project.value.title} | Cloudless`,
    description: () => project.value.description,
  });
</script>

<style scoped>
  .project-detail {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .project-header {
    text-align: center;
    margin-bottom: 3rem;
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    padding: 2.5rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .project-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e40af;
    margin-bottom: 1rem;
  }

  .project-description {
    font-size: 1.2rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .project-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .tag {
    background-color: #1e40af;
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .project-content {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2.5rem;
    margin-bottom: 3rem;
  }

  .project-media {
    position: sticky;
    top: 2rem;
    align-self: start;
  }

  .project-image {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .placeholder-image {
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5rem;
    background-color: #f8fafc;
    color: #1e40af;
  }

  .project-details {
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    padding: 2.5rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .project-details h2 {
    font-size: 1.8rem;
    font-weight: 600;
    color: #1e40af;
    margin-bottom: 1.5rem;
  }

  .project-details h3 {
    font-size: 1.3rem;
    font-weight: 600;
    color: #1e40af;
    margin: 1.5rem 0 1rem;
  }

  .project-technologies {
    margin-top: 2rem;
  }

  .project-technologies ul {
    list-style-type: disc;
    padding-left: 1.5rem;
  }

  .project-technologies li {
    margin-bottom: 0.5rem;
    color: #64748b;
  }

  .project-links {
    margin-top: 2rem;
  }

  .links-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
  }

  .project-link {
    background-color: #1e40af;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    text-decoration: none;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .project-link:hover {
    background-color: #1e3a8a;
  }

  .project-navigation {
    margin-top: 3rem;
    text-align: center;
  }

  .back-link {
    display: inline-block;
    background-color: #f8fafc;
    color: #1e40af;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s;
  }

  .back-link:hover {
    background-color: #f1f5f9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .project-content {
      grid-template-columns: 1fr;
    }

    .project-media {
      position: static;
    }

    .project-header {
      padding: 2rem 1.5rem;
    }

    .project-details {
      padding: 2rem 1.5rem;
    }

    .project-header h1 {
      font-size: 2rem;
    }
  }
</style>
