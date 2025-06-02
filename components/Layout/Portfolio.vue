<template>
  <v-container class="portfolio">
    <v-row>
      <v-col cols="12" class="text-center">
        <h1 class="text-h3 font-weight-bold mb-3">Our Portfolio</h1>
        <p class="text-subtitle-1 mb-6">Check out our amazing projects.</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col v-for="project in projects" :key="project.id" cols="12" sm="6" md="4">
        <v-card class="project-card h-100">
          <v-img height="200" :src="project.image" cover class="align-end">
            <v-card-title class="text-white bg-black bg-opacity-60 w-100">
              {{ project.title }}
            </v-card-title>
          </v-img>

          <v-card-text>
            <p>{{ project.description }}</p>
          </v-card-text>

          <v-card-actions>
            <v-btn :to="'/projects/' + project.slug" color="primary" variant="text">
              View Details
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn
              v-if="project.liveUrl"
              :href="project.liveUrl"
              target="_blank"
              variant="tonal"
              prepend-icon="mdi-open-in-new"
            >
              Live Demo
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
// Sample portfolio projects - you should replace with real data
const projects = [
  {
    id: 1,
    title: 'E-Commerce Platform',
    slug: 'e-commerce-platform',
    description:
      'A complete solution for online retail with payment processing and inventory management.',
    image: '/images/projects/project-1.jpg',
    liveUrl: '#',
  },
  {
    id: 2,
    title: 'Healthcare Dashboard',
    slug: 'healthcare-dashboard',
    description:
      'Interactive analytics dashboard for healthcare professionals with real-time patient data.',
    image: '/images/projects/project-2.jpg',
    liveUrl: '#',
  },
  {
    id: 3,
    title: 'Mobile Banking App',
    slug: 'mobile-banking-app',
    description:
      'Secure and user-friendly mobile banking solution with advanced security features.',
    image: '/images/projects/project-3.jpg',
    liveUrl: null,
  },
];
</script>

<style scoped>
.portfolio {
  padding-top: 3rem;
  padding-bottom: 3rem;
}

.project-card {
  transition:
    transform 0.3s,
    box-shadow 0.3s;
}

.project-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}
</style>
