<template>
  <v-container class="project-page py-8">
    <v-row>
      <v-col cols="12">
        <v-breadcrumbs :items="breadcrumbs" class="px-0"></v-breadcrumbs>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="8">
        <h1 class="text-h3 font-weight-bold mb-4">{{ project.title }}</h1>

        <v-img :src="project.image" height="400" cover class="rounded-lg mb-6"></v-img>

        <v-card class="mb-6">
          <v-card-text>
            <div class="text-body-1 mb-4">{{ project.description }}</div>

            <v-divider class="my-4"></v-divider>

            <div class="d-flex flex-wrap mb-4">
              <v-chip
                v-for="tech in project.technologies"
                :key="tech"
                color="primary"
                variant="tonal"
                class="mr-2 mb-2"
              >
                {{ tech }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Project Details</v-card-title>
          <v-card-text>
            <p>{{ project.fullDescription }}</p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="mb-6">
          <v-card-title>Project Information</v-card-title>
          <v-list>
            <v-list-item>
              <v-list-item-title>Client</v-list-item-title>
              <v-list-item-subtitle>{{ project.client }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Date</v-list-item-title>
              <v-list-item-subtitle>{{ project.date }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Category</v-list-item-title>
              <v-list-item-subtitle>{{ project.category }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-card-actions>
            <v-btn
              v-if="project.liveUrl"
              :href="project.liveUrl"
              target="_blank"
              color="primary"
              prepend-icon="mdi-open-in-new"
              block
              class="mb-2"
            >
              View Live Project
            </v-btn>
            <v-btn
              v-if="project.githubUrl"
              :href="project.githubUrl"
              target="_blank"
              variant="outlined"
              prepend-icon="mdi-github"
              block
            >
              View Source Code
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card>
          <v-card-title>Related Projects</v-card-title>
          <v-list>            <v-list-item
              v-for="relatedProject in relatedProjects"
              :key="relatedProject.id"
              :to="`/projects/${relatedProject.slug}`"
            >
              <template v-slot:[`prepend`]>
                <v-avatar size="40" class="mr-2">
                  <v-img :src="relatedProject.image" cover></v-img>
                </v-avatar>
              </template>
              <v-list-item-title>{{ relatedProject.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  fullDescription: string;
  image: string;
  client: string;
  date: string;
  category: string;
  technologies: string[];
  liveUrl?: string;
  githubUrl?: string;
}

interface RelatedProject {
  id: string;
  slug: string;
  title: string;
  image: string;
}

interface Breadcrumb {
  title: string;
  disabled: boolean;
  to?: string;
}

const route = useRoute();

// Get project slug from route params
const projectSlug = computed(() => String(route.params.slug || ''));

// Example project data (in a real app, this would be fetched based on the slug)
const project = ref<Project>({
  id: '1',
  slug: projectSlug.value || 'e-commerce-platform',
  title: 'E-Commerce Platform',
  description:
    'A complete solution for online retail with payment processing and inventory management.',
  fullDescription:
    'This comprehensive e-commerce platform provides businesses with everything they need to sell products online. Features include inventory management, secure payment processing, customer accounts, order tracking, and a responsive design for mobile shoppers. Built with Vue.js, Nuxt, and integrated with multiple payment gateways.',
  image: '/images/projects/project-1.jpg',
  client: 'RetailTech Inc.',
  date: 'January 2025',
  category: 'Web Development',
  technologies: ['Vue.js', 'Nuxt', 'Node.js', 'MongoDB', 'Stripe API'],
  liveUrl: 'https://example.com',
  githubUrl: 'https://github.com/example/project',
});

// Breadcrumbs for navigation
const breadcrumbs = computed<Breadcrumb[]>(() => [
  {
    title: 'Home',
    disabled: false,
    to: '/',
  },
  {
    title: 'Projects',
    disabled: false,
    to: '/projects',
  },
  {
    title: project.value.title,
    disabled: true,
  },
]);

// Related projects
const relatedProjects: RelatedProject[] = [
  {
    id: '2',
    slug: 'healthcare-dashboard',
    title: 'Healthcare Dashboard',
    image: '/images/projects/project-2.jpg',
  },
  {
    id: '3',
    slug: 'mobile-banking-app',
    title: 'Mobile Banking App',
    image: '/images/projects/project-3.jpg',
  },
];
</script>

<style scoped>
/* Additional custom styling if needed */
</style>
