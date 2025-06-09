<template>
  <v-container>
    <!-- Projects Header -->
    <v-row justify="center" class="mb-10">
      <v-col cols="12" class="text-center">
        <h1 class="text-h2 text-primary font-weight-bold mb-4">Our Projects</h1>
        <p class="text-h6 text-medium-emphasis mx-auto" style="max-width: 600px">
          Explore our portfolio of innovative web development solutions and applications.
        </p>
      </v-col>
    </v-row>

    <!-- Projects Grid -->
    <v-row class="mb-10">
      <v-col v-for="project in projects" :key="project.title" cols="12" md="6" lg="4">
        <v-card elevation="8" rounded="xl" color="rgba(255, 255, 255, 0.95)" class="h-100" hover>
          <v-card-text class="pa-0">
            <!-- Project Image/Icon -->
            <div
              class="d-flex align-center justify-center"
              style="height: 200px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            >
              <div class="text-h1" style="opacity: 0.8">{{ project.icon }}</div>
            </div>

            <!-- Project Content -->
            <div class="pa-6">
              <v-card-title class="text-h5 text-primary font-weight-bold mb-3 pa-0">
                {{ project.title }}
              </v-card-title>

              <p class="text-body-2 text-medium-emphasis mb-4" style="line-height: 1.6">
                {{ project.description }}
              </p>

              <!-- Project Tags -->
              <div class="d-flex flex-wrap ga-2">
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
            </div>
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
            <p class="text-body-1 text-medium-emphasis mb-6 mx-auto" style="max-width: 500px">
              Let's discuss how we can help bring your ideas to life with our expertise and
              innovative solutions.
            </p>
            <v-btn
              to="/contact"
              color="primary"
              size="large"
              rounded="lg"
              variant="elevated"
              prepend-icon="mdi-chat"
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
  // Set page meta
  definePageMeta({
    layout: 'default',
  });

  // Set page head
  useHead({
    title: 'Projects - Cloudless.gr',
    meta: [
      {
        name: 'description',
        content:
          'Explore our portfolio of innovative web development solutions and applications. From mobile-first web apps to secure authentication systems.',
      },
      {
        property: 'og:title',
        content: 'Projects - Cloudless.gr',
      },
      {
        property: 'og:description',
        content: 'Explore our portfolio of innovative web development solutions and applications.',
      },
    ],
  });

  // Projects data
  const projects = [
    {
      icon: '📱',
      title: 'Mobile-First Web Applications',
      description:
        'Responsive web applications designed with mobile-first approach for optimal user experience across all devices.',
      tags: ['Vue.js', 'Nuxt.js', 'Responsive'],
    },
    {
      icon: '⚡',
      title: 'High-Performance APIs',
      description:
        'Scalable backend solutions with optimized APIs for fast data processing and seamless integration.',
      tags: ['Node.js', 'Prisma', 'API'],
    },
    {
      icon: '🎨',
      title: 'Modern UI/UX Design',
      description:
        'Beautiful, intuitive user interfaces with modern design principles and accessibility standards.',
      tags: ['Design', 'UX/UI', 'Accessibility'],
    },
    {
      icon: '🔐',
      title: 'Secure Authentication Systems',
      description:
        'Robust authentication and authorization systems with JWT tokens and advanced security features.',
      tags: ['Security', 'JWT', 'Auth'],
    },
    {
      icon: '📊',
      title: 'Data Analytics Dashboards',
      description:
        'Interactive dashboards for data visualization and business intelligence with real-time updates.',
      tags: ['Analytics', 'Charts', 'Real-time'],
    },
    {
      icon: '☁️',
      title: 'Cloudless Solutions',
      description:
        'Serverless architectures and edge computing solutions for maximum performance and scalability.',
      tags: ['Serverless', 'Edge', 'Cloud'],
    },
  ];
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
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
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
